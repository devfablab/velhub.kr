import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

function normalizeText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeSlug(rawValue: string | null | undefined) {
  return (rawValue ?? '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidSlugCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

export async function GET(request: Request) {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const boardName = normalizeText(requestUrl.searchParams.get('boardName')).toLowerCase();
    const slug = normalizeSlug(requestUrl.searchParams.get('slug'));
    const currentSlug = normalizeText(requestUrl.searchParams.get('currentSlug'));

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!boardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!slug) {
      return Response.json({ error: '페이지 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (hasInvalidSlugCharacters(slug)) {
      return Response.json(
        {
          ok: false,
          slug,
          error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다.",
        },
        { status: 200 },
      );
    }

    if (/^\d/.test(slug)) {
      return Response.json(
        {
          ok: false,
          slug,
          error: '페이지 식별자는 숫자로 시작할 수 없습니다.',
        },
        { status: 200 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const rhizomeResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizomeResult.error || !rhizomeResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const manageResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('role')
      .eq('site_id', rhizomeResult.data.id)
      .eq('user_id', stigmaResult.data.id)
      .in('role', ['owner', 'manager'])
      .maybeSingle();

    if (manageResult.error || !manageResult.data) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const denylistResult = await supabaseAdmin.from('denylist').select('word').eq('word', slug).maybeSingle();

    if (denylistResult.error) {
      return Response.json({ error: '페이지 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (denylistResult.data) {
      return Response.json(
        {
          ok: false,
          slug,
          error: '사용할 수 없는 페이지 식별자입니다.',
        },
        { status: 200 },
      );
    }

    const boardResult = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_key', boardName)
      .maybeSingle();

    if (boardResult.error || !boardResult.data) {
      return Response.json(
        {
          ok: true,
          slug,
          available: true,
        },
        { status: 200 },
      );
    }

    const existingSlugResult = await supabaseAdmin
      .from('pages')
      .select('id, slug')
      .eq('site_id', rhizomeResult.data.id)
      .eq('board_id', boardResult.data.id)
      .eq('slug', slug)
      .maybeSingle();

    if (existingSlugResult.error) {
      return Response.json({ error: '페이지 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (existingSlugResult.data && slug !== currentSlug) {
      return Response.json(
        {
          ok: false,
          slug,
          error: '이미 존재하는 페이지 식별자입니다.',
        },
        { status: 200 },
      );
    }

    return Response.json({
      ok: true,
      slug,
      available: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '페이지 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '페이지 식별자 확인에 실패했습니다.' }, { status: 500 });
  }
}
