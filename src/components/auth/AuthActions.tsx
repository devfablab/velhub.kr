'use client';

import Anchor from '../Anchor';
import LogoutButton from '@/components/auth/LogoutButton';
import { useAuthState } from '@/components/auth/AuthStateProvider';

export default function AuthActions() {
  const { isReady, isAuthenticated } = useAuthState();

  if (!isReady) {
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
