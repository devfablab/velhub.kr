'use client';

import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useAuthState } from './AuthStateProvider';

export default function LogoutButton() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const { isAuthServiceUnavailable } = useAuthState();

  async function handleLogout() {
    if (isAuthServiceUnavailable) {
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      alert(error.message);
      return;
    }

    router.replace('/');
  }

  return (
    <button type="button" onClick={handleLogout}>
      로그아웃
    </button>
  );
}
