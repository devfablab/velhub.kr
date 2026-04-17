'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';

type AuthStateContextValue = {
  isReady: boolean;
  isAuthenticated: boolean;
  authVersion: number;
};

const AuthStateContext = createContext<AuthStateContextValue>({
  isReady: false,
  isAuthenticated: false,
  authVersion: 0,
});

export function useAuthState() {
  return useContext(AuthStateContext);
}

export default function AuthStateProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const supabase = getSupabaseBrowser();

    async function loadSession() {
      const sessionResult = await supabase.auth.getSession();

      if (sessionResult.error) {
        setIsAuthenticated(false);
        setIsReady(true);
        return;
      }

      setIsAuthenticated(Boolean(sessionResult.data.session));
      setIsReady(true);
    }

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
      setAuthVersion((previousValue) => previousValue + 1);
      setIsReady(true);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const contextValue = useMemo(
    () => ({
      isReady,
      isAuthenticated,
      authVersion,
    }),
    [authVersion, isAuthenticated, isReady],
  );

  return <AuthStateContext.Provider value={contextValue}>{children}</AuthStateContext.Provider>;
}
