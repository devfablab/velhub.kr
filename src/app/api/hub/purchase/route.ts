import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type PaymentRow = {
  id: string;
  payment_type: string;
  target_type: string;
  target_id: string | null;
  order_no: string | null;
  amount: number;
  refunded_amount: number | null;
  currency: string | null;
  status: string;
  payment_method: string | null;
  approved_at: string | null;
  created_at: string;
  refundable_until: string | null;
  failure_message: string | null;
};

type BillingMethodRow = {
  id: string;
  provider: string;
  card_company: string | null;
  card_company_code: string | null;
  card_number_masked: string | null;
  card_type: string | null;
  owner_type: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type BoardRow = {
  id: string;
  site_id: string;
  board_key: string;
  board_label: string | null;
};

type SeriesRow = {
  id: string;
  site_id: string;
  board_id: string;
  series_key: string;
  series_label: string | null;
};

type PostRow = {
  id: string;
  site_id: string;
  board_id: string;
  slug: number;
  subject: string;
};

type PaymentDisplayInfo = {
  siteLabel: string;
  siteHref: string;
  targetLabel: string;
  targetHref: string;
};

const SUCCESS_PAYMENT_STATUSES = ['paid', 'partially_refunded', 'refunded'];

function formatCardNumber(cardNumberMasked: string | null | undefined) {
  const normalizedCardNumber = normalizeText(cardNumberMasked).replace(/\D/g, '');

  if (normalizedCardNumber.length < 4) {
    return '카드번호 확인 필요';
  }

  return `${normalizedCardNumber.slice(0, 4)} ••••`;
}

function getPaymentTypeLabel(paymentType: string) {
  switch (paymentType) {
    case 'plan_billing':
      return '요금제';
    case 'membership_blog':
      return '블로그 멤버십';
    case 'subscription_board':
      return '게시판 구독';
    case 'subscription_series':
      return '연재 구독';
    case 'donation_site':
      return '블로그 후원';
    case 'donation_board':
      return '게시판 후원';
    case 'donation_series':
      return '연재 후원';
    case 'donation_post':
      return '포스팅 후원';
    case 'purchase_post':
      return '포스팅 구매';
    default:
      return '기타';
  }
}

function getPaymentStatusLabel(status: string) {
  switch (status) {
    case 'paid':
      return '결제 완료';
    case 'failed':
      return '결제 실패';
    case 'refunded':
      return '환불 완료';
    case 'partially_refunded':
      return '부분 환불';
    default:
      return '확인 필요';
  }
}

function getSiteLabel(site: SiteRow | null | undefined) {
  return site?.site_label || site?.site_key || '사이트 확인 필요';
}

function getSiteHref(site: SiteRow | null | undefined) {
  if (!site?.site_key) {
    return '/hub/purchase';
  }

  return `/${site.site_key}`;
}

function createPaymentDisplayInfo({
  payment,
  site,
  board,
  series,
  seriesBoard,
  post,
  postBoard,
}: {
  payment: PaymentRow;
  site: SiteRow | null | undefined;
  board?: BoardRow | null;
  series?: SeriesRow | null;
  seriesBoard?: BoardRow | null;
  post?: PostRow | null;
  postBoard?: BoardRow | null;
}): PaymentDisplayInfo {
  const siteLabel = getSiteLabel(site);
  const siteHref = getSiteHref(site);

  if (payment.target_type === 'site') {
    return {
      siteLabel,
      siteHref,
      targetLabel: '',
      targetHref: siteHref,
    };
  }

  if (payment.target_type === 'board') {
    return {
      siteLabel,
      siteHref,
      targetLabel: board?.board_label || board?.board_key || '게시판 확인 필요',
      targetHref: board && site?.site_key ? `/${site.site_key}/${board.board_key}` : siteHref,
    };
  }

  if (payment.target_type === 'series') {
    return {
      siteLabel,
      siteHref,
      targetLabel: series?.series_label || series?.series_key || '연재 확인 필요',
      targetHref: seriesBoard && site?.site_key ? `/${site.site_key}/${seriesBoard.board_key}` : siteHref,
    };
  }

  if (payment.target_type === 'post') {
    return {
      siteLabel,
      siteHref,
      targetLabel: post?.subject || '포스팅 확인 필요',
      targetHref:
        post && postBoard && site?.site_key ? `/${site.site_key}/${postBoard.board_key}/${post.slug}` : siteHref,
    };
  }

  return {
    siteLabel,
    siteHref,
    targetLabel: '대상 확인 필요',
    targetHref: siteHref,
  };
}

function getSummary(payments: PaymentRow[]) {
  const successPayments = payments.filter((payment) => SUCCESS_PAYMENT_STATUSES.includes(payment.status));

  const totalAmount = successPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalRefundedAmount = successPayments.reduce((sum, payment) => sum + (payment.refunded_amount ?? 0), 0);
  const netAmount = totalAmount - totalRefundedAmount;

  const amountByType = successPayments.reduce<Record<string, number>>((result, payment) => {
    result[payment.payment_type] =
      (result[payment.payment_type] ?? 0) + payment.amount - (payment.refunded_amount ?? 0);

    return result;
  }, {});

  return {
    totalAmount,
    totalRefundedAmount,
    netAmount,
    amountByType: Object.entries(amountByType).map(([paymentType, amount]) => ({
      paymentType,
      label: getPaymentTypeLabel(paymentType),
      amount,
    })),
  };
}

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const [paymentsResult, billingMethodResult] = await Promise.all([
      supabaseAdmin
        .from('payments')
        .select(
          'id, payment_type, target_type, target_id, order_no, amount, refunded_amount, currency, status, payment_method, approved_at, created_at, refundable_until, failure_message',
        )
        .eq('buyer_user_id', session.authUserId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabaseAdmin
        .from('subscription_billing_methods')
        .select(
          'id, provider, card_company, card_company_code, card_number_masked, card_type, owner_type, is_default, created_at, updated_at',
        )
        .eq('user_id', session.authUserId)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false }),
    ]);

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    if (billingMethodResult.error) {
      console.error(billingMethodResult.error);

      return Response.json({ error: '결제수단을 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as PaymentRow[];
    const siteTargetIds = payments
      .filter((payment) => payment.target_type === 'site')
      .map((payment) => payment.target_id)
      .filter(Boolean) as string[];
    const billingMethods = (billingMethodResult.data ?? []) as BillingMethodRow[];

    const boardTargetIds = payments
      .filter((payment) => payment.target_type === 'board')
      .map((payment) => payment.target_id)
      .filter(Boolean) as string[];

    const seriesTargetIds = payments
      .filter((payment) => payment.target_type === 'series')
      .map((payment) => payment.target_id)
      .filter(Boolean) as string[];

    const postTargetIds = payments
      .filter((payment) => payment.target_type === 'post')
      .map((payment) => payment.target_id)
      .filter(Boolean) as string[];

    const [boardResult, seriesResult, postResult] = await Promise.all([
      boardTargetIds.length
        ? supabaseAdmin.from('boards').select('id, site_id, board_key, board_label').in('id', boardTargetIds)
        : Promise.resolve({ data: [], error: null }),
      seriesTargetIds.length
        ? supabaseAdmin
            .from('board_series')
            .select('id, site_id, board_id, series_key, series_label')
            .in('id', seriesTargetIds)
        : Promise.resolve({ data: [], error: null }),
      postTargetIds.length
        ? supabaseAdmin.from('posts').select('id, site_id, board_id, slug, subject').in('id', postTargetIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (boardResult.error || seriesResult.error || postResult.error) {
      console.error(boardResult.error || seriesResult.error || postResult.error);
      return Response.json({ error: '결제 대상 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const boardMap = new Map(((boardResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));
    const seriesMap = new Map(((seriesResult.data ?? []) as SeriesRow[]).map((series) => [series.id, series]));
    const postMap = new Map(((postResult.data ?? []) as PostRow[]).map((post) => [post.id, post]));

    const relatedBoardIds = Array.from(
      new Set([
        ...((seriesResult.data ?? []) as SeriesRow[]).map((series) => series.board_id),
        ...((postResult.data ?? []) as PostRow[]).map((post) => post.board_id),
      ]),
    ).filter(Boolean);

    const relatedBoardResult = relatedBoardIds.length
      ? await supabaseAdmin.from('boards').select('id, site_id, board_key, board_label').in('id', relatedBoardIds)
      : { data: [], error: null };

    if (relatedBoardResult.error) {
      console.error(relatedBoardResult.error);
      return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    for (const board of (relatedBoardResult.data ?? []) as BoardRow[]) {
      boardMap.set(board.id, board);
    }

    const siteIds = Array.from(
      new Set([
        ...siteTargetIds,
        ...Array.from(boardMap.values()).map((board) => board.site_id),
        ...Array.from(seriesMap.values()).map((series) => series.site_id),
        ...Array.from(postMap.values()).map((post) => post.site_id),
      ]),
    ).filter(Boolean) as string[];

    const siteResult = siteIds.length
      ? await supabaseAdmin.from('rhizomes').select('id, site_key, site_label').in('id', siteIds)
      : { data: [], error: null };

    if (siteResult.error) {
      console.error(siteResult.error);
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const siteMap = new Map(((siteResult.data ?? []) as SiteRow[]).map((site) => [site.id, site]));

    return Response.json({
      summary: getSummary(payments),
      billingMethods: billingMethods.map((billingMethod) => ({
        id: billingMethod.id,
        provider: billingMethod.provider,
        cardCompany: billingMethod.card_company,
        cardCompanyCode: billingMethod.card_company_code,
        cardNumberLabel: formatCardNumber(billingMethod.card_number_masked),
        cardType: billingMethod.card_type,
        ownerType: billingMethod.owner_type,
        isDefault: billingMethod.is_default,
        createdAt: billingMethod.created_at,
        updatedAt: billingMethod.updated_at,
      })),
      recentPayments: payments.slice(0, 10).map((payment) => {
        const board = payment.target_type === 'board' && payment.target_id ? boardMap.get(payment.target_id) : null;
        const series = payment.target_type === 'series' && payment.target_id ? seriesMap.get(payment.target_id) : null;
        const post = payment.target_type === 'post' && payment.target_id ? postMap.get(payment.target_id) : null;
        const seriesBoard = series ? boardMap.get(series.board_id) : null;
        const postBoard = post ? boardMap.get(post.board_id) : null;
        const siteId =
          payment.target_type === 'site'
            ? payment.target_id
            : (board?.site_id ?? series?.site_id ?? post?.site_id ?? null);
        const site = siteId ? siteMap.get(siteId) : null;
        const displayInfo = createPaymentDisplayInfo({
          payment,
          site,
          board,
          series,
          seriesBoard,
          post,
          postBoard,
        });

        return {
          id: payment.id,
          siteLabel: displayInfo.siteLabel,
          siteHref: displayInfo.siteHref,
          targetLabel: displayInfo.targetLabel,
          targetHref: displayInfo.targetHref,
          paymentType: payment.payment_type,
          paymentTypeLabel: getPaymentTypeLabel(payment.payment_type),
          targetType: payment.target_type,
          targetId: payment.target_id,
          orderNo: payment.order_no,
          amount: payment.amount,
          refundedAmount: payment.refunded_amount ?? 0,
          netAmount: payment.amount - (payment.refunded_amount ?? 0),
          currency: payment.currency ?? 'KRW',
          status: payment.status,
          statusLabel: getPaymentStatusLabel(payment.status),
          paymentMethod: payment.payment_method,
          approvedAt: payment.approved_at,
          createdAt: payment.created_at,
          refundableUntil: payment.refundable_until,
          failureMessage: payment.failure_message,
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '구입내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
