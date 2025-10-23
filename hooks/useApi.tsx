import { useState, useCallback } from 'react';
import { API_BASE_URL, getAuthHeaders } from '../utils/supabase/client';
import { publicAnonKey } from '../utils/supabase/info';

export function useApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const makeRequest = useCallback(async <T,>(
    endpoint: string,
    options: RequestInit = {},
    accessToken?: string,
    userId?: string
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const headers = getAuthHeaders(accessToken || publicAnonKey);

      // Add X-User-ID header for anonymous users
      const customHeaders: Record<string, string> = { ...headers };
      if (userId && (!accessToken || accessToken === '')) {
        customHeaders['X-User-ID'] = userId;
      }

      const response = await fetch(url, {
        ...options,
        headers: {
          ...customHeaders,
          ...options.headers,
        },
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
  }, []);

  return { makeRequest, loading, error };
}