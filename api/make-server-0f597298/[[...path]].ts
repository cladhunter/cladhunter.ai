import type { VercelRequest, VercelResponse } from '@vercel/node';

const IGNORED_REQUEST_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'accept-encoding',
]);

function assertSupabaseConfig() {
  const supabaseUrl =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    null;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_ROLE ??
    process.env.SUPABASE_SECRET ??
    process.env.SUPABASE_SERVICE_KEY ??
    null;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase service credentials are not configured.');
  }

  return { supabaseUrl: supabaseUrl.replace(/\/+$/, ''), serviceRoleKey };
}

async function readRequestBody(req: VercelRequest): Promise<Buffer | undefined> {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return undefined;
  }

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

  return chunks.length > 0 ? Buffer.concat(chunks) : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { supabaseUrl, serviceRoleKey } = assertSupabaseConfig();

    const pathSegments = req.query.path;
    const segments = Array.isArray(pathSegments)
      ? pathSegments
      : typeof pathSegments === 'string' && pathSegments.length > 0
        ? [pathSegments]
        : [];

    const requestUrl = new URL(req.url ?? '', 'http://localhost');
    const search = requestUrl.search;

    const baseUrl = `${supabaseUrl}/functions/v1/make-server-0f597298`;
    const targetUrl = `${baseUrl}${segments.length > 0 ? `/${segments.join('/')}` : ''}${search}`;

    const originalAuthHeader = req.headers['authorization'];
    const body = await readRequestBody(req);

    const headers = new Headers();
    headers.set('Authorization', `Bearer ${serviceRoleKey}`);
    headers.set('apikey', serviceRoleKey);

    if (typeof originalAuthHeader === 'string' && originalAuthHeader.trim().length > 0) {
      headers.set('X-Original-Authorization', originalAuthHeader);
    }

    const userIdHeader = req.headers['x-user-id'];
    if (typeof userIdHeader === 'string' && userIdHeader.trim().length > 0) {
      headers.set('X-User-ID', userIdHeader);
    }

    for (const [key, value] of Object.entries(req.headers)) {
      const lowerKey = key.toLowerCase();
      if (IGNORED_REQUEST_HEADERS.has(lowerKey)) {
        continue;
      }

      if (lowerKey === 'authorization' || lowerKey === 'x-user-id') {
        continue;
      }

      if (typeof value === 'string') {
        headers.set(key, value);
      } else if (Array.isArray(value)) {
        for (const entry of value) {
          headers.append(key, entry);
        }
      }
    }

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    res.status(response.status);

    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'transfer-encoding') {
        return;
      }

      res.setHeader(key, value);
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const responseBuffer = Buffer.from(await response.arrayBuffer());
    res.send(responseBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected proxy error';
    console.error('[api proxy] Failed to forward request:', message);
    res.status(500).json({ error: message });
  }
}
