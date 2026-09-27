import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { isValidPassword, PASSWORD_REQUIREMENTS } from '@/lib/auth/password';

type ResetPasswordFieldErrors = {
  password: string;
  passwordConfirm: string;
};

const EMPTY_FIELD_ERRORS: ResetPasswordFieldErrors = {
  password: '',
  passwordConfirm: '',
};

function getSupabaseUrl() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase URL이 설정되지 않았습니다.');
  return supabaseUrl;
}

function getSupabaseBrowserKey() {
  const supabasePublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabasePublishableKey) throw new Error('Supabase 공개 키가 설정되지 않았습니다.');
  return supabasePublishableKey;
}

async function getSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseBrowserKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });
}

function validationResponse(fieldErrors: ResetPasswordFieldErrors) {
  return Response.json(
    {
      title: '새 비밀번호 확인',
      errors: Object.values(fieldErrors).filter(Boolean),
      fieldErrors,
    },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { password?: unknown; passwordConfirm?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    const passwordConfirm = typeof body.passwordConfirm === 'string' ? body.passwordConfirm : '';
    const fieldErrors: ResetPasswordFieldErrors = {
      password: !password ? '새 비밀번호를 입력해 주세요.' : !isValidPassword(password) ? PASSWORD_REQUIREMENTS : '',
      passwordConfirm: !passwordConfirm
        ? '새 비밀번호 확인을 입력해 주세요.'
        : password !== passwordConfirm
          ? '비밀번호가 일치하지 않습니다.'
          : '',
    };

    if (fieldErrors.password || fieldErrors.passwordConfirm) return validationResponse(fieldErrors);

    const supabase = await getSupabaseServer();
    const userResult = await supabase.auth.getUser();

    if (userResult.error || !userResult.data.user) {
      return Response.json(
        {
          title: '비밀번호 재설정 링크',
          errors: ['비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.'],
          fieldErrors: EMPTY_FIELD_ERRORS,
        },
        { status: 401 },
      );
    }

    const updateResult = await supabase.auth.updateUser({ password });

    if (updateResult.error) {
      console.error('[password-reset] password update error', updateResult.error);
      return Response.json(
        { errors: ['비밀번호를 재설정하지 못했습니다.\n잠시 후 다시 시도해 주세요.'] },
        { status: 500 },
      );
    }

    const signOutResult = await supabase.auth.signOut({ scope: 'global' });

    if (signOutResult.error) {
      console.error('[password-reset] global sign out error', signOutResult.error);
      return Response.json(
        { errors: ['비밀번호는 변경되었지만 모든 로그인 세션을 종료하지 못했습니다.\n잠시 후 다시 시도해 주세요.'] },
        { status: 500 },
      );
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    console.error('[password-reset] unexpected error', unknownError);
    return Response.json(
      { errors: ['비밀번호 재설정 중 오류가 발생했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.'] },
      { status: 500 },
    );
  }
}
