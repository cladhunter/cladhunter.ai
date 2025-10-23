import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

const eventSchema = z.object({
  idempotencyKey: z.string().min(1).max(255),
  userId: z.string().min(1).max(128),
  eventType: z.string().min(1).max(64),
  amount: z.coerce.number().int().min(0),
  metadata: z.record(z.string(), z.unknown()).optional(),
  occurredAt: z.string().datetime().optional(),
});

type EventPayload = z.infer<typeof eventSchema>;

type EventRow = {
  id: string;
  user_id: string;
  event_type: string;
  amount: number;
  metadata: Record<string, unknown> | null;
  idempotency_key: string;
  ip_address: string | null;
  occurred_at: string | null;
  created_at?: string;
};

type CreditLedgerRow = {
  id: string;
  user_id: string;
  event_id: string;
  amount: number;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at?: string;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_EVENTS_PER_USER = 30;
const RATE_LIMIT_MAX_EVENTS_PER_IP = 60;

class RateLimitError extends Error {}

let cachedSupabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (cachedSupabase) {
    return cachedSupabase;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    process.env.SUPABASE_SECRET ??
    process.env.SUPABASE_SERVICE_KEY ??
    null;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service role credentials are not configured.');
  }

  cachedSupabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return cachedSupabase;
}

async function readRequestBody(req: VercelRequest): Promise<Buffer> {
  if (req.body) {
    if (typeof req.body === 'string') {
      return Buffer.from(req.body);
    }

    if (Buffer.isBuffer(req.body)) {
      return req.body;
    }

    return Buffer.from(JSON.stringify(req.body));
  }

  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks);
}

function sanitizeMetadata(metadata?: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }

  const entries = Object.entries(metadata).filter(([, value]) => value !== undefined);
  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries);
}

function decodeSignature(signature: string): Buffer | null {
  const trimmed = signature.trim();
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    return Buffer.from(trimmed, 'hex');
  }

  try {
    return Buffer.from(trimmed, 'base64');
  } catch (error) {
    return null;
  }
}

function verifySignature(rawBody: Buffer, signature: string): boolean {
  const secret = process.env.TRACK_HMAC_SECRET;
  if (!secret) {
    throw new Error('TRACK_HMAC_SECRET is not configured.');
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest();
  const provided = decodeSignature(signature);

  if (!provided || provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

function getSignatureHeader(req: VercelRequest): string | null {
  const raw = req.headers['x-track-signature'] ?? req.headers['x-signature'];
  if (!raw) {
    return null;
  }

  return Array.isArray(raw) ? raw[0] : raw;
}

function getRequestIp(req: VercelRequest): string | null {
  const header = req.headers['x-forwarded-for'];
  if (Array.isArray(header)) {
    const candidate = header[0]?.split(',')[0]?.trim();
    if (candidate) {
      return candidate;
    }
  } else if (typeof header === 'string') {
    const candidate = header.split(',')[0]?.trim();
    if (candidate) {
      return candidate;
    }
  }

  const remoteAddress = req.socket?.remoteAddress;
  return remoteAddress ?? null;
}

async function enforceRateLimit(
  client: SupabaseClient,
  userId: string,
  ipAddress: string | null,
): Promise<void> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

  const [{ count: userCount, error: userError }, ipResult] = await Promise.all([
    client
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', windowStart),
    ipAddress
      ? client
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('ip_address', ipAddress)
          .gte('created_at', windowStart)
      : Promise.resolve({ count: 0, error: null } as {
          count: number | null;
          error: PostgrestError | null;
        }),
  ]);

  if (userError) {
    throw userError;
  }

  if (ipResult.error) {
    throw ipResult.error;
  }

  if ((userCount ?? 0) >= RATE_LIMIT_MAX_EVENTS_PER_USER) {
    throw new RateLimitError('User rate limit exceeded.');
  }

  if (ipAddress && (ipResult.count ?? 0) >= RATE_LIMIT_MAX_EVENTS_PER_IP) {
    throw new RateLimitError('IP rate limit exceeded.');
  }
}

function isUniqueViolation(error: PostgrestError | null): boolean {
  return Boolean(error && error.code === '23505');
}

async function fetchExistingEvent(
  client: SupabaseClient,
  idempotencyKey: string,
): Promise<EventRow | null> {
  const { data, error } = await client
    .from('events')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as EventRow | null) ?? null;
}

async function fetchExistingLedger(
  client: SupabaseClient,
  eventId: string,
): Promise<CreditLedgerRow | null> {
  const { data, error } = await client
    .from('credit_ledger')
    .select('*')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as CreditLedgerRow | null) ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed.' });
    return;
  }

  let rawBody: Buffer;
  try {
    rawBody = await readRequestBody(req);
  } catch (error) {
    res.status(400).json({ error: 'Failed to read request body.' });
    return;
  }

  if (!rawBody.length) {
    res.status(400).json({ error: 'Request body is empty.' });
    return;
  }

  const signature = getSignatureHeader(req);
  if (!signature) {
    res.status(401).json({ error: 'Missing HMAC signature.' });
    return;
  }

  try {
    if (!verifySignature(rawBody, signature)) {
      res.status(401).json({ error: 'Invalid HMAC signature.' });
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signature verification failed.';
    res.status(500).json({ error: message });
    return;
  }

  let payload: EventPayload;
  try {
    const json = JSON.parse(rawBody.toString('utf8'));
    const result = eventSchema.safeParse(json);
    if (!result.success) {
      res.status(400).json({
        error: 'Payload validation failed.',
        issues: result.error.format(),
      });
      return;
    }
    payload = result.data;
  } catch (error) {
    res.status(400).json({ error: 'Invalid JSON payload.' });
    return;
  }

  let client: SupabaseClient;
  try {
    client = getSupabaseClient();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to initialize Supabase client.';
    res.status(500).json({ error: message });
    return;
  }

  const ipAddress = getRequestIp(req);

  try {
    await enforceRateLimit(client, payload.userId, ipAddress);
  } catch (error) {
    if (error instanceof RateLimitError) {
      res.status(429).json({ error: error.message });
      return;
    }

    const message = error instanceof Error ? error.message : 'Rate limit check failed.';
    res.status(500).json({ error: message });
    return;
  }

  const metadata = sanitizeMetadata({
    ...payload.metadata,
    userAgent: req.headers['user-agent'],
  });

  const eventInsert = {
    id: uuidv4(),
    user_id: payload.userId,
    event_type: payload.eventType,
    amount: payload.amount,
    metadata,
    idempotency_key: payload.idempotencyKey,
    ip_address: ipAddress,
    occurred_at: payload.occurredAt ?? null,
  } satisfies Omit<EventRow, 'created_at'>;

  let deduped = false;
  let eventRecord: EventRow | null = null;

  const insertResult = await client
    .from('events')
    .insert(eventInsert)
    .select('*')
    .single();
  const insertError = insertResult.error as PostgrestError | null;
  const insertedEvent = insertResult.data as EventRow | null;

  if (insertError) {
    if (isUniqueViolation(insertError)) {
      deduped = true;
      eventRecord = await fetchExistingEvent(client, payload.idempotencyKey);
      if (!eventRecord) {
        res.status(500).json({ error: 'Existing event not found for idempotency key.' });
        return;
      }
    } else {
      res.status(500).json({ error: insertError.message });
      return;
    }
  } else {
    eventRecord = insertedEvent;
  }

  let creditLedgerId: string | null = null;
  if (!deduped && payload.amount > 0 && eventRecord) {
    const creditInsert = {
      id: uuidv4(),
      user_id: payload.userId,
      event_id: eventRecord.id,
      amount: payload.amount,
      reason: payload.eventType,
      metadata,
    } satisfies Omit<CreditLedgerRow, 'created_at'>;

    const creditResult = await client
      .from('credit_ledger')
      .insert(creditInsert)
      .select('*')
      .single();
    const creditError = creditResult.error as PostgrestError | null;
    const creditRow = creditResult.data as CreditLedgerRow | null;

    if (creditError) {
      if (isUniqueViolation(creditError)) {
        const existingLedger = await fetchExistingLedger(client, eventRecord.id);
        if (existingLedger) {
          creditLedgerId = existingLedger.id;
        }
      } else {
        res.status(500).json({ error: creditError.message });
        return;
      }
    } else {
      creditLedgerId = creditRow?.id ?? null;
    }
  } else if (deduped && eventRecord) {
    const existingLedger = await fetchExistingLedger(client, eventRecord.id);
    creditLedgerId = existingLedger?.id ?? null;
  }

  if (!eventRecord) {
    res.status(500).json({ error: 'Unable to resolve event record.' });
    return;
  }

  res.status(200).json({
    deduped,
    eventId: eventRecord.id,
    creditLedgerId,
  });
}
