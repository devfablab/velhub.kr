/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';
import Anchor from '../Anchor';
import LogoutButton from '@/components/auth/LogoutButton';

export default function AuthActions() {
  const [isMounted, setIsMounted] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setIsMounted(true);

    const supabase = getSupabaseBrowser();

    async function checkSession() {
      const sessionResult = await supabase.auth.getSession();

      if (sessionResult.error) {
        setIsAuthenticated(false);
        return;
      }

      setIsAuthenticated(Boolean(sessionResult.data.session));
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session));
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (!isMounted) {
    return null;
  }

  if (isAuthenticated === null) {
    return null;
  }

  if (isAuthenticated) {
    return <LogoutButton />;
  }

  return (
    <div>
      <Anchor href="/auth/sign-up">가입하기</Anchor>
      <Anchor href="/auth/sign-in">로그인하기</Anchor>
    </div>
  );
}
