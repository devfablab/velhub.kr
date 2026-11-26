import { canBeSeriesAuthor, isSoloBlog } from '@/lib/board/seriesAuthor';
import { getStoredImageSize } from '@/lib/clients/r2Storage';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { validateSeriesPriceAgainstParentPrice } from '@/lib/payments/subscriptionPrice';
import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import {
  canManageCommunityBoardSettings,
  getCommunityManagerAccess,
} from '@/lib/service/site/community/communityManager/utils';
import verifySession from '@/lib/session/verifySession';
import { scheduleAutoOgImage } from '@/lib/site/autoOgImage.server';
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
  isSubscription?: boolean;
  subscriptionPrice?: number | null;
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
    let userId = normalizeText(requestBody.userId) || null;
    const isSubscription = requestBody.isSubscription === true;
    const subscriptionPrice = Number(requestBody.subscriptionPrice);

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

    const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, site_id')
      .eq('site_id', rhizome.data.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (
      board.data.board_type === 'page' ||
      (rhizome.data.site_type === 'community' && board.data.board_type === 'youtube')
    ) {
      return Response.json(
        {
          error:
            board.data.board_type === 'youtube'
              ? '유튜브 게시판에서는 연재를 사용할 수 없습니다.'
              : '페이지 게시판은 연재를 사용할 수 없습니다.',
        },
        { status: 403 },
      );
    }

    let canManageSeries = session.case === 'staff' || session.case === 'admin';

    if (rhizome.data.site_type === 'community' && !canManageSeries) {
      try {
        const access = await getCommunityManagerAccess(siteName, { requireManagerControlPermission: false });
        canManageSeries = canManageCommunityBoardSettings(access.actor, board.data.id);
      } catch {
        canManageSeries = false;
      }
    }

    if (!canManageSeries) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const soloBlog = await isSoloBlog({
      supabaseAdmin,
      siteId: rhizome.data.id,
      siteType: rhizome.data.site_type,
    });

    if (soloBlog) {
      userId = session.stigmaId;
    }

    if (!userId) {
      return Response.json({ error: '연재 담당 작가를 선택해주세요.' }, { status: 400 });
    }

    if (
      !soloBlog &&
      !(await canBeSeriesAuthor({
        supabaseAdmin,
        siteId: rhizome.data.id,
        stigmaId: userId,
        requireAuthor: isSubscription,
      }))
    ) {
      return Response.json(
        {
          error: isSubscription
            ? '구독 연재는 작가로 승인된 구성원만 담당자로 지정할 수 있습니다.'
            : '활동 중인 구성원만 연재 담당자로 지정할 수 있습니다.',
        },
        { status: 400 },
      );
    }

    if (isSubscription) {
      if (rhizome.data.site_type !== 'community') {
        return Response.json({ error: '연재 추가에서 구독은 커뮤니티에서만 설정할 수 있습니다.' }, { status: 400 });
      }

      if (session.case !== 'admin' && session.case !== 'staff') {
        return Response.json({ error: '구독 연재는 커뮤니티 운영자만 만들 수 있습니다.' }, { status: 403 });
      }

      const priceValidation = validateSeriesPriceAgainstParentPrice(subscriptionPrice, 0);

      if (!priceValidation.ok) {
        return Response.json({ error: priceValidation.message }, { status: 400 });
      }
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

    const thumbnailSize = await getStoredImageSize('series', thumbnailImage);
    const insertSeries = await supabaseAdmin
      .from('board_series')
      .insert({
        series_key: seriesKey,
        series_label: nextSeriesLabel,
        summary: summary || null,
        thumbnail_image: thumbnailImage || null,
        thumbnail_width: thumbnailSize.width,
        thumbnail_height: thumbnailSize.height,
        board_id: board.data.id,
        site_id: rhizome.data.id,
        last_published_at: null,
        is_completed: false,
        is_subscription: isSubscription,
        user_id: userId,
      })
      .select(
        'id, created_at, series_key, series_label, summary, thumbnail_image, thumbnail_width, thumbnail_height, board_id, site_id, last_published_at, is_completed, is_subscription, user_id',
      )
      .maybeSingle();

    if (insertSeries.error || !insertSeries.data) {
      return Response.json({ error: '연재 추가에 실패했습니다.' }, { status: 500 });
    }

    if (isSubscription) {
      const settingResult = await supabaseAdmin.from('subscription_settings').insert({
        target_type: PAYMENT_TARGET_TYPE.SERIES,
        target_id: insertSeries.data.id,
        subscription_type: SUBSCRIPTION_TYPE.SUBSCRIPTION_SERIES,
        is_enabled: true,
        price: subscriptionPrice,
      });

      if (settingResult.error) {
        console.error(settingResult.error);
        await supabaseAdmin.from('board_series').delete().eq('id', insertSeries.data.id);

        return Response.json({ error: '연재 구독 설정을 저장하지 못했습니다.' }, { status: 500 });
      }
    }

    scheduleAutoOgImage({ type: 'series', seriesId: insertSeries.data.id });

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
