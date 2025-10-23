import CryptoJS from 'crypto-js';
import { supabaseCredentials } from './supabase';

const SESSION_STORAGE_KEY = 'cladhunter.session_id';
const IDEMPOTENCY_PREFIX = 'cladhunter-idem';

function readEnv(key: string): string | undefined {
  if (typeof import.meta !== 'undefined' && typeof import.meta.env !== 'undefined') {
    const value = import.meta.env[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  if (typeof process !== 'undefined' && typeof process.env !== 'undefined') {
    const value = process.env[key];
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }
  }

  return undefined;
}

function generateId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}_${time}_${random}`;
}

function getSessionId(): string {
  if (typeof window === 'undefined') {
    return generateId('session');
  }

  const existing = window.localStorage.getItem(SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const sessionId = generateId('session');
  window.localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

function getTrackingSecret(): string {
  return (
    readEnv('NEXT_PUBLIC_TRACKING_SECRET') ||
    readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') ||
    readEnv('VITE_SUPABASE_ANON_KEY') ||
    supabaseCredentials.anonKey
  );
}

export interface TrackClickMetadata {
  [key: string]: unknown;
}

export async function trackClick(eventName: string, metadata: TrackClickMetadata = {}): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  const sessionId = getSessionId();
  const idempotencyKey = generateId(IDEMPOTENCY_PREFIX);
  const timestamp = new Date().toISOString();
  const payload = {
    event: eventName,
    metadata,
    sessionId,
    idempotencyKey,
    timestamp,
  };

  const serialized = JSON.stringify(payload);
  const secret = getTrackingSecret();
  const signature = CryptoJS.HmacSHA256(serialized, secret).toString(CryptoJS.enc.Hex);

  try {
    await fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Session-ID': sessionId,
        'X-Idempotency-Key': idempotencyKey,
        'X-Signature': signature,
      },
      body: serialized,
      keepalive: true,
    });
  } catch (error) {
    console.warn('[tracking] Failed to track click:', error);
  }
}
