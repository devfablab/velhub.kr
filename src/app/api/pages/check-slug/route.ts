import verifySession from '@/lib/session/verifySession';
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

    const rhizome = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.status === 'FAIL') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const denylist = await supabaseAdmin.from('denylist').select('word').eq('word', slug).maybeSingle();

    if (denylist.error) {
      return Response.json({ error: '페이지 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (denylist.data) {
      return Response.json(
        {
          ok: false,
          slug,
          error: '사용할 수 없는 페이지 식별자입니다.',
        },
        { status: 200 },
      );
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', boardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json(
        {
          ok: true,
          slug,
          available: true,
        },
        { status: 200 },
      );
    }

    const existingSlug = await supabaseAdmin
      .from('pages')
      .select('id, slug')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('slug', slug)
      .maybeSingle();

    if (existingSlug.error) {
      return Response.json({ error: '페이지 식별자 확인에 실패했습니다.' }, { status: 500 });
    }

    if (existingSlug.data && slug !== currentSlug) {
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
