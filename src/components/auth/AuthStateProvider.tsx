'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Snackbar } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';

type AuthStateContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  isAuthServiceUnavailable: boolean;
  authVersion: number;
};

const AuthStateContext = createContext<AuthStateContextValue>({
  isReady: false,
  isAuthenticated: false,
  isAuthServiceUnavailable: false,
  authVersion: 0,
});

export function useAuthState() {
  return useContext(AuthStateContext);
}

export default function AuthStateProvider({
  children,
  initialAuthHealth,
  initialSessionCookie,
}: Readonly<{
  children: React.ReactNode;
  initialAuthHealth: 'operational' | 'outage' | 'unknown';
  initialSessionCookie: boolean;
}>) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthServiceUnavailable, setIsAuthServiceUnavailable] = useState(initialAuthHealth === 'outage');
  const [hasSession, setHasSession] = useState(initialSessionCookie);
  const [authVersion, setAuthVersion] = useState(0);
  const isAuthServiceUnavailableRef = useRef(isAuthServiceUnavailable);

  useEffect(() => {
    isAuthServiceUnavailableRef.current = isAuthServiceUnavailable;
  }, [isAuthServiceUnavailable]);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let isActive = true;

    async function getHealthStatus() {
      try {
        const response = await fetch('/api/auth/health', { cache: 'no-store' });
        const result = (await response.json().catch(() => null)) as { status?: string } | null;
        return response.ok && result?.status === 'outage' ? 'outage' : 'available';
      } catch {
        return 'available';
      }
    }

    async function loadSession() {
      const healthStatus = await getHealthStatus();

      if (!isActive) {
        return;
      }

      if (healthStatus === 'outage') {
        setIsAuthServiceUnavailable(true);
        setIsAuthenticated(false);
        setIsReady(true);
        return;
      }

      setIsAuthServiceUnavailable(false);
      const sessionResult = await supabase.auth.getSession();

      if (!isActive) {
        return;
      }

      if (sessionResult.error) {
        setIsAuthenticated(false);
        setIsReady(true);
        return;
      }

      const nextIsAuthenticated = Boolean(sessionResult.data.session);
      setHasSession(nextIsAuthenticated);
      setIsAuthenticated(nextIsAuthenticated);
      setIsReady(true);
    }

    void loadSession();

    const healthInterval = window.setInterval(() => {
      void loadSession();
    }, 30_000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isAuthServiceUnavailableRef.current) {
        return;
      }

      setHasSession(Boolean(session));
      setIsAuthenticated(Boolean(session));
      setAuthVersion((previousValue) => previousValue + 1);
      setIsReady(true);
    });

    return () => {
      isActive = false;
      window.clearInterval(healthInterval);
      subscription.unsubscribe();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      isReady,
      isAuthenticated,
      isAuthServiceUnavailable,
      authVersion,
    }),
    [authVersion, isAuthenticated, isAuthServiceUnavailable, isReady],
  );

  return (
    <AuthStateContext.Provider value={contextValue}>
      {children}
      <Snackbar
        open={isAuthServiceUnavailable && hasSession}
        message="현재 인증 서버 장애로 읽기만 가능합니다"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      />
    </AuthStateContext.Provider>
  );
}
