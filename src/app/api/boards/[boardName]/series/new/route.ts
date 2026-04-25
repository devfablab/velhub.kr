import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
  }>;
};

type RequestBody = {
  siteName: string | null;
  seriesKey?: string | null;
  seriesLabel?: string | null;
  summary?: string | null;
  thumbnailImage?: string | null;
  userId?: string | null;
};

function isValidSeriesKey(value: string) {
  if (value.length < 5 || value.length > 16) {
    return false;
  }

  if (!/[a-z]/.test(value)) {
    return false;
  }

  if (/[^a-z0-9\-_]/.test(value)) {
    return false;
  }

  if (value.startsWith('_') || value.endsWith('_')) {
    return false;
  }

  if (value.includes('__')) {
    return false;
  }

  return true;
}

async function getUniqueSeriesLabel({
  supabaseAdmin,
  siteId,
  boardId,
  baseLabel,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  boardId: string;
  baseLabel: string;
}) {
  let nextLabel = baseLabel;
  let suffix = 1;

  while (true) {
    const duplicatedSeries = await supabaseAdmin
      .from('board_series')
      .select('id')
      .eq('site_id', siteId)
      .eq('board_id', boardId)
      .eq('series_label', nextLabel)
      .maybeSingle();

    if (duplicatedSeries.error) {
      throw new Error('연재명을 확인하지 못했습니다.');
    }

    if (!duplicatedSeries.data) {
      return nextLabel;
    }

    nextLabel = `${baseLabel}${suffix}`;
    suffix += 1;
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { boardName } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const seriesKey = normalizeText(requestBody.seriesKey).toLowerCase();
    const seriesLabel = normalizeText(requestBody.seriesLabel);
    const summary = normalizeText(requestBody.summary);
    const thumbnailImage = normalizeText(requestBody.thumbnailImage);
    const userId = normalizeText(requestBody.userId) || null;

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!seriesKey) {
      return Response.json({ error: '연재 식별자를 입력해주세요.' }, { status: 400 });
    }

    if (!isValidSeriesKey(seriesKey)) {
      return Response.json(
        {
          error:
            '연재 식별자는 5자 이상 16자 이하여야 하며, 영소문자/숫자/하이픈/언더스코어만 사용할 수 있고, 최소 한 글자의 영문자를 포함해야 합니다.',
        },
        { status: 400 },
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

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (board.data.board_type === 'page') {
      return Response.json({ error: '페이지 게시판은 연재를 사용할 수 없습니다.' }, { status: 403 });
    }

    const duplicatedSeriesKey = await supabaseAdmin
      .from('board_series')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('board_id', board.data.id)
      .eq('series_key', seriesKey)
      .maybeSingle();

    if (duplicatedSeriesKey.error) {
      return Response.json({ error: '연재 식별자를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (duplicatedSeriesKey.data) {
      return Response.json({ error: '이미 존재하는 연재 식별자입니다.' }, { status: 409 });
    }

    const nextSeriesLabel = await getUniqueSeriesLabel({
      supabaseAdmin,
      siteId: rhizome.data.id,
      boardId: board.data.id,
      baseLabel: seriesLabel || seriesKey,
    });

    const insertSeries = await supabaseAdmin
      .from('board_series')
      .insert({
        series_key: seriesKey,
        series_label: nextSeriesLabel,
        summary: summary || null,
        thumbnail_image: thumbnailImage || null,
        board_id: board.data.id,
        site_id: rhizome.data.id,
        last_published_at: null,
        is_completed: false,
        user_id: userId,
      })
      .select(
        'id, created_at, series_key, series_label, summary, thumbnail_image, board_id, site_id, last_published_at, is_completed, user_id',
      )
      .maybeSingle();

    console.log('insertSeries: ', insertSeries);

    if (insertSeries.error || !insertSeries.data) {
      return Response.json({ error: '연재 추가에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      series: insertSeries.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '연재 추가에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '연재 추가에 실패했습니다.' }, { status: 500 });
  }
}
