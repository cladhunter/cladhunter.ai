import { useState, useEffect } from 'react';
import { getSupabaseClient } from '../lib/supabase';

export interface AuthUser {
  id: string;
  email?: string;
  accessToken: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseClient();

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          accessToken: session.access_token,
        });
      } else {
        // For demo: use anonymous user ID based on device
        const anonymousId = localStorage.getItem('cladhunter_anonymous_id') || 
          `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('cladhunter_anonymous_id', anonymousId);
        
        setUser({
          id: anonymousId,
          accessToken: '', // Will use public anon key
        });
        setIsAnonymous(true);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          accessToken: session.access_token,
        });
        setIsAnonymous(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading, isAnonymous };
}
