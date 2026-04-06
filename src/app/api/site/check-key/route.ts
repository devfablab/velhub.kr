import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RequestBody = {
  siteKey: string | null;
};

function normalizeSiteKey(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

export async function POST(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestBody = (await request.json()) as RequestBody;
    const rawSiteKey = requestBody.siteKey?.trim() ?? '';
    const normalizedSiteKey = normalizeSiteKey(rawSiteKey);

    if (!normalizedSiteKey) {
      return Response.json(
        {
          ok: false,
          normalizedSiteKey,
          error: '사이트 식별자를 입력해주세요.',
        },
        { status: 400 },
      );
    }

    if (hasInvalidCharacters(normalizedSiteKey)) {
      return Response.json(
        {
          ok: false,
          normalizedSiteKey,
          error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다.",
        },
        { status: 400 },
      );
    }

    if (/^\d/.test(normalizedSiteKey)) {
      return Response.json(
        {
          ok: false,
          normalizedSiteKey,
          error: '사이트 식별자는 숫자로 시작할 수 없습니다.',
        },
        { status: 400 },
      );
    }

    if (normalizedSiteKey.length < 5 || normalizedSiteKey.length > 15) {
      return Response.json(
        {
          ok: false,
          normalizedSiteKey,
          error: '사이트 식별자는 5자 이상 15자 이하여야 합니다.',
        },
        { status: 400 },
      );
    }

    if (normalizedSiteKey.includes('--')) {
      return Response.json(
        {
          ok: false,
          normalizedSiteKey,
          error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다.",
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const denylistResult = await supabaseAdmin
      .from('denylist')
      .select('word')
      .eq('word', normalizedSiteKey)
      .maybeSingle();

    if (denylistResult.error) {
      return Response.json({ error: '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (denylistResult.data) {
      return Response.json(
        {
          ok: false,
          normalizedSiteKey,
          error: '사용할 수 없는 사이트 식별자입니다.',
        },
        { status: 400 },
      );
    }

    const rhizomeResult = await supabaseAdmin
      .from('rhizomes')
      .select('id')
      .eq('site_key', normalizedSiteKey)
      .maybeSingle();

    if (rhizomeResult.error) {
      return Response.json({ error: '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (rhizomeResult.data) {
      return Response.json(
        {
          ok: false,
          normalizedSiteKey,
          error: '사용할 수 없는 사이트 식별자입니다.',
        },
        { status: 400 },
      );
    }

    return Response.json({
      ok: true,
      normalizedSiteKey,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 식별자 확인에 실패했습니다.' }, { status: 500 });
  }
}
