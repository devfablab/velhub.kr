import { redis } from '@/lib/redis';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type ThemeMode = 'light' | 'system' | 'dark';

type RequestBody = {
  theme_mode?: ThemeMode | null;
  auto_login?: boolean | null;
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

function getProfileAutoLoginCacheKey(userId: string) {
  return `session:auto-login:${userId}`;
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims?.userId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;

    if (!isThemeMode(requestBody.theme_mode)) {
      return Response.json({ error: 'theme_mode 값이 유효하지 않습니다.' }, { status: 400 });
    }

    if (typeof requestBody.auto_login !== 'boolean') {
      return Response.json({ error: 'auto_login 값이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const profileResult = await supabaseAdmin
      .from('profiles')
      .update({
        theme_mode: requestBody.theme_mode,
        auto_login: requestBody.auto_login,
      })
      .eq('user_id', sessionClaims.userId);

    if (profileResult.error) {
      return Response.json({ error: '추가 설정 수정에 실패했습니다.' }, { status: 500 });
    }

    await redis.set(getProfileAutoLoginCacheKey(sessionClaims.userId), requestBody.auto_login, {
      ex: 60 * 10,
    });

    return Response.json({
      ok: true,
      profile: {
        theme_mode: requestBody.theme_mode,
        auto_login: requestBody.auto_login,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '추가 설정 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '추가 설정 수정에 실패했습니다.' }, { status: 500 });
  }
}
