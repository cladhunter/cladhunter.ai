import { useState, useCallback } from 'react';
import { API_BASE_URL, getAuthHeaders } from '../utils/supabase/client';
import { publicAnonKey } from '../utils/supabase/info';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formatUserIdForHeader = useCallback((userId: string) => {
    const trimmed = userId.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.startsWith('anon_') || trimmed.startsWith('ton_')) {
      return trimmed;
    }

    const sanitized = trimmed.replace(/[^a-zA-Z0-9_-]/g, '');
    if (!sanitized) {
      return null;
    }

    return `ton_${sanitized}`;
  }, []);

  const makeRequest = useCallback(async <T,>(
    endpoint: string,
    options: RequestInit = {},
    accessToken?: string,
    userId?: string,
    walletAddress?: string
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const baseHeaders = new Headers(
        getAuthHeaders(accessToken || publicAnonKey),
      );

      if (userId && (!accessToken || accessToken === '')) {
        const headerUserId = formatUserIdForHeader(userId);
        if (headerUserId) {
          baseHeaders.set('X-User-ID', headerUserId);
        }
      }

      if (walletAddress) {
        baseHeaders.set('X-Wallet-Address', walletAddress);
      }

      const requestHeaders = new Headers(baseHeaders);
      if (options.headers) {
        const optionHeaders = new Headers(options.headers);
        optionHeaders.forEach((value, key) => {
          requestHeaders.set(key, value);
        });
      }

      const response = await fetch(url, {
        ...options,
        headers: requestHeaders,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Request failed with status ${response.status}`);
      }

      setLoading(false);
      return data as T;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error(`API Error (${endpoint}):`, errorMessage);
      setError(errorMessage);
      setLoading(false);
      return null;
    }
  }, [formatUserIdForHeader]);

  return { makeRequest, loading, error };
}
