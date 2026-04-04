import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type ThemeMode = 'light' | 'system' | 'dark';

type RequestBody = {
  themeMode: ThemeMode;
};

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json(
        {
          isLoggedIn: false,
          themeMode: 'system',
        },
        { status: 200 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const profileResult = await supabaseAdmin
      .from('profiles')
      .select('theme_mode')
      .eq('id', sessionClaims.userId)
      .maybeSingle();

    if (profileResult.error) {
      return Response.json({ error: '테마 모드를 확인하지 못했습니다.' }, { status: 500 });
    }

    const themeMode = isThemeMode(profileResult.data?.theme_mode) ? profileResult.data.theme_mode : 'system';

    return Response.json({
      isLoggedIn: true,
      themeMode,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '테마 모드를 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '테마 모드를 확인하지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;

    if (!isThemeMode(requestBody.themeMode)) {
      return Response.json({ error: '테마 모드가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const updateResult = await supabaseAdmin
      .from('profiles')
      .update({
        theme_mode: requestBody.themeMode,
      })
      .eq('id', sessionClaims.userId);

    if (updateResult.error) {
      return Response.json({ error: '테마 모드 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      themeMode: requestBody.themeMode,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '테마 모드 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '테마 모드 저장에 실패했습니다.' }, { status: 500 });
  }
}
