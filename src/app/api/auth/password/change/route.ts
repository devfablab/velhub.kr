import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { isValidPassword, PASSWORD_REQUIREMENTS } from '@/lib/auth/password';

type FieldErrors = {
  currentPassword: string;
  nextPassword: string;
  nextPasswordConfirm: string;
};

const EMPTY_FIELD_ERRORS: FieldErrors = {
  currentPassword: '',
  nextPassword: '',
  nextPasswordConfirm: '',
};

function getSupabaseUrl() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw new Error('Supabase URL이 설정되지 않았습니다.');
  return value;
}

function getSupabaseBrowserKey() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw new Error('Supabase 공개 키가 설정되지 않았습니다.');
  return value;
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

function validationResponse(fieldErrors: FieldErrors) {
  return Response.json(
    { title: '비밀번호 변경', errors: Object.values(fieldErrors).filter(Boolean), fieldErrors },
    { status: 400 },
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    const nextPassword = typeof body.nextPassword === 'string' ? body.nextPassword : '';
    const nextPasswordConfirm = typeof body.nextPasswordConfirm === 'string' ? body.nextPasswordConfirm : '';
    const fieldErrors: FieldErrors = {
      currentPassword: currentPassword ? '' : '현재 비밀번호를 입력해 주세요.',
      nextPassword: !nextPassword
        ? '새 비밀번호를 입력해 주세요.'
        : !isValidPassword(nextPassword)
          ? PASSWORD_REQUIREMENTS
          : '',
      nextPasswordConfirm: !nextPasswordConfirm
        ? '새 비밀번호 확인을 입력해 주세요.'
        : nextPassword !== nextPasswordConfirm
          ? '새 비밀번호가 일치하지 않습니다.'
          : currentPassword === nextPassword
            ? '현재 비밀번호와 다른 비밀번호를 입력해 주세요.'
            : '',
    };

    if (Object.values(fieldErrors).some(Boolean)) return validationResponse(fieldErrors);

    const supabase = await getSupabaseServer();
    const userResult = await supabase.auth.getUser();

    if (userResult.error || !userResult.data.user?.email) {
      return Response.json(
        {
          title: '로그인 정보 확인',
          errors: ['로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.'],
          fieldErrors: EMPTY_FIELD_ERRORS,
        },
        { status: 401 },
      );
    }

    const passwordCheckClient = createClient(getSupabaseUrl(), getSupabaseBrowserKey(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const passwordCheckResult = await passwordCheckClient.auth.signInWithPassword({
      email: userResult.data.user.email,
      password: currentPassword,
    });

    if (passwordCheckResult.error) {
      return Response.json(
        {
          title: '비밀번호 변경',
          errors: ['현재 비밀번호가 올바르지 않습니다.'],
          fieldErrors: { ...EMPTY_FIELD_ERRORS, currentPassword: '현재 비밀번호가 올바르지 않습니다.' },
        },
        { status: 400 },
      );
    }

    const updateResult = await supabase.auth.updateUser({ password: nextPassword });
    if (updateResult.error) throw updateResult.error;

    const signOutResult = await supabase.auth.signOut({ scope: 'global' });
    if (signOutResult.error) throw signOutResult.error;

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[password-change] unexpected error', error);
    return Response.json(
      { errors: ['비밀번호 변경 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'] },
      { status: 500 },
    );
  }
}
