'use client';

import { usePathname } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';

export default function SocialLoginButtons() {
  const pathname = usePathname();
  const supabase = getSupabaseBrowser();

  const actionText = pathname === '/sign-up' ? '시작하기' : '로그인';

  async function handleGoogleLogin() {
    const currentOrigin = window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${currentOrigin}/auth/callback`,
      },
    });

    if (error) {
      alert(error.message);
    }
  }

  async function handleGithubLogin() {
    const currentOrigin = window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${currentOrigin}/auth/callback`,
      },
    });

    if (error) {
      alert(error.message);
    }
  }

  return (
    <div>
      <button type="button" onClick={handleGoogleLogin}>
        Google 아이디로 {actionText}
      </button>

      <button type="button" onClick={handleGithubLogin}>
        GitHub 아이디로 {actionText}
      </button>
    </div>
  );
}
