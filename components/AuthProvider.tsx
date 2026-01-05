'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes in milliseconds
const CHECK_INTERVAL_MS = 60 * 1000; // Check every minute

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const timeoutCheckRef = useRef<NodeJS.Timeout | null>(null);
  const userRef = useRef<User | null>(null);

  // Keep userRef in sync with user state
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Store login timestamp in sessionStorage
  const setLoginTimestamp = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('loginTimestamp', Date.now().toString());
    }
  }, []);

  // Get login timestamp from sessionStorage
  const getLoginTimestamp = useCallback((): number | null => {
    if (typeof window !== 'undefined') {
      const timestamp = sessionStorage.getItem('loginTimestamp');
      return timestamp ? parseInt(timestamp, 10) : null;
    }
    return null;
  }, []);

  // Clear login timestamp
  const clearLoginTimestamp = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('loginTimestamp');
    }
  }, []);

  // Check if session has expired
  const checkSessionTimeout = useCallback(async () => {
    if (!userRef.current) return;

    const loginTimestamp = getLoginTimestamp();
    if (!loginTimestamp) {
      // No timestamp found, set it now
      setLoginTimestamp();
      return;
    }

    const now = Date.now();
    const elapsed = now - loginTimestamp;

    if (elapsed >= SESSION_TIMEOUT_MS) {
      // Session expired, sign out
      try {
        await signOut();
        clearLoginTimestamp();
        router.push('/login');
        router.refresh();
      } catch (error) {
        console.error('Error signing out after timeout:', error);
      }
    }
  }, [getLoginTimestamp, setLoginTimestamp, clearLoginTimestamp, router]);


  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoginTimestamp();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      const newUser = session?.user ?? null;
      setUser(newUser);
      setLoading(false);

      if (newUser) {
        // User logged in, set timestamp
        setLoginTimestamp();
      } else {
        // User logged out, clear timestamp and timers
        clearLoginTimestamp();
        if (timeoutCheckRef.current) {
          clearInterval(timeoutCheckRef.current);
          timeoutCheckRef.current = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutCheckRef.current) {
        clearInterval(timeoutCheckRef.current);
      }
    };
  }, [router, setLoginTimestamp, clearLoginTimestamp]);

  // Set up periodic timeout check
  useEffect(() => {
    if (user) {
      // Initial check
      checkSessionTimeout();

      // Set up interval to check every minute
      timeoutCheckRef.current = setInterval(() => {
        checkSessionTimeout();
      }, CHECK_INTERVAL_MS);

      return () => {
        if (timeoutCheckRef.current) {
          clearInterval(timeoutCheckRef.current);
        }
      };
    }
  }, [user, checkSessionTimeout]);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

