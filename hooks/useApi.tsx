import { useState, useCallback } from 'react';
import { getApiBaseUrls, getAuthHeaders } from '../lib/supabase';
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

    const { primary, fallback } = getApiBaseUrls();

    const executeRequest = async (baseUrl: string | null, retryOnError: boolean) => {
      if (!baseUrl) {
        return {
          ok: false,
          message: 'API base URL is not configured',
          shouldRetry: retryOnError,
        } as const;
      }

      try {
        const headers = getAuthHeaders(accessToken || publicAnonKey);

        const customHeaders: Record<string, string> = {
          ...(headers as Record<string, string>),
        };
        if (userId && (!accessToken || accessToken === '')) {
          customHeaders['X-User-ID'] = userId;
        }

        const response = await fetch(`${baseUrl}${endpoint}`, {
          ...options,
          headers: {
            ...customHeaders,
            ...options.headers,
          },
        });

        const rawBody = await response.text();
        let parsedBody: unknown = null;

        if (rawBody.length > 0) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            parsedBody = rawBody;
          }
        }

        if (!response.ok) {
          const responseError =
            typeof parsedBody === 'object' && parsedBody !== null && 'error' in parsedBody
              ? String((parsedBody as { error?: unknown }).error)
              : `Request failed with status ${response.status}`;

          const shouldRetry = retryOnError && [401, 403, 404].includes(response.status);

          return {
            ok: false,
            message: responseError,
            shouldRetry,
          } as const;
        }

        return {
          ok: true,
          data: parsedBody as T,
        } as const;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        return {
          ok: false,
          message: errorMessage,
          shouldRetry: retryOnError,
        } as const;
      }
    };

    try {
      const primaryResult = await executeRequest(primary, Boolean(fallback));

      if (primaryResult.ok) {
        setLoading(false);
        return primaryResult.data;
      }

      if (primaryResult.shouldRetry && fallback && fallback !== primary) {
        const fallbackResult = await executeRequest(fallback, false);

        if (fallbackResult.ok) {
          setLoading(false);
          return fallbackResult.data;
        }

        setError(fallbackResult.message);
        setLoading(false);
        console.error(`API Error (${endpoint} via fallback):`, fallbackResult.message);
        return null;
      }

      setError(primaryResult.message);
      console.error(`API Error (${endpoint}):`, primaryResult.message);
      setLoading(false);
      return null;
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