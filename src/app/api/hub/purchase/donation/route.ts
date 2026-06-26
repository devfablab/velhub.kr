import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

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

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
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

type DonationDisplayInfo = {
  site: SiteRow | null;
  targetLabel: string | null;
  paymentTypeLabel: string;
};

const SUCCESS_PAYMENT_STATUSES = ['paid', 'partially_refunded', 'refunded'];

const DONATION_PAYMENT_TYPES = [
  PAYMENT_TYPE.DONATION_SITE,
  PAYMENT_TYPE.DONATION_BOARD,
  PAYMENT_TYPE.DONATION_SERIES,
  PAYMENT_TYPE.DONATION_POST,
];

function normalizePaymentStatus(status: string) {
  return normalizeText(status).toLowerCase();
}

function getPaymentStatusLabel(status: string) {
  switch (normalizePaymentStatus(status)) {
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

function getPaymentMethodLabel(paymentMethod: string | null) {
  const normalizedPaymentMethod = normalizeText(paymentMethod).toLowerCase();

  if (!normalizedPaymentMethod) {
    return '결제수단 확인 필요';
  }

  if (normalizedPaymentMethod === 'card') {
    return '카드';
  }

  return normalizedPaymentMethod;
}

function getDonationPaymentTypeLabel(paymentType: string) {
  switch (paymentType) {
    case PAYMENT_TYPE.DONATION_SITE:
      return '블로그 후원';
    case PAYMENT_TYPE.DONATION_BOARD:
      return '게시판 후원';
    case PAYMENT_TYPE.DONATION_SERIES:
      return '연재 후원';
    case PAYMENT_TYPE.DONATION_POST:
      return '포스팅 후원';
    default:
      return '후원';
  }
}

function isRefundableDonation(payment: PaymentRow) {
  if (normalizePaymentStatus(payment.status) !== 'paid') {
    return false;
  }

  if (!payment.refundable_until) {
    return false;
  }

  return new Date(payment.refundable_until).getTime() > Date.now();
}

function getSummary(payments: PaymentRow[]) {
  const successPayments = payments.filter((payment) =>
    SUCCESS_PAYMENT_STATUSES.includes(normalizePaymentStatus(payment.status)),
  );

  const totalAmount = successPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const totalRefundedAmount = successPayments.reduce((sum, payment) => sum + (payment.refunded_amount ?? 0), 0);

  return {
    totalAmount,
    totalRefundedAmount,
    netAmount: totalAmount - totalRefundedAmount,
    count: payments.length,
  };
}

async function getSitesByIds({ supabaseAdmin, siteIds }: { supabaseAdmin: SupabaseAdminClient; siteIds: string[] }) {
  if (!siteIds.length) {
    return [];
  }

  const sitesResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type')
    .in('id', siteIds);

  if (sitesResult.error) {
    console.error(sitesResult.error);

    throw new Error('후원 대상 정보를 불러오지 못했습니다.');
  }

  return (sitesResult.data ?? []) as SiteRow[];
}

function createDonationDisplayInfo({
  payment,
  siteById,
  boardById,
  seriesById,
  postById,
}: {
  payment: PaymentRow;
  siteById: Map<string, SiteRow>;
  boardById: Map<string, BoardRow>;
  seriesById: Map<string, SeriesRow>;
  postById: Map<string, PostRow>;
}): DonationDisplayInfo {
  const paymentTypeLabel = getDonationPaymentTypeLabel(payment.payment_type);

  if (payment.target_type === PAYMENT_TARGET_TYPE.SITE && payment.target_id) {
    return {
      site: siteById.get(payment.target_id) ?? null,
      targetLabel: null,
      paymentTypeLabel,
    };
  }

  if (payment.target_type === PAYMENT_TARGET_TYPE.BOARD && payment.target_id) {
    const board = boardById.get(payment.target_id);

    return {
      site: board ? (siteById.get(board.site_id) ?? null) : null,
      targetLabel: board?.board_label || board?.board_key || '게시판 확인 필요',
      paymentTypeLabel,
    };
  }

  if (payment.target_type === PAYMENT_TARGET_TYPE.SERIES && payment.target_id) {
    const series = seriesById.get(payment.target_id);

    return {
      site: series ? (siteById.get(series.site_id) ?? null) : null,
      targetLabel: series?.series_label || series?.series_key || '연재 확인 필요',
      paymentTypeLabel,
    };
  }

  if (payment.target_type === PAYMENT_TARGET_TYPE.POST && payment.target_id) {
    const post = postById.get(payment.target_id);

    return {
      site: post ? (siteById.get(post.site_id) ?? null) : null,
      targetLabel: post?.subject || '포스팅 확인 필요',
      paymentTypeLabel,
    };
  }

  return {
    site: null,
    targetLabel: '후원 대상 확인 필요',
    paymentTypeLabel,
  };
}

export async function GET() {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const paymentsResult = await supabaseAdmin
      .from('payments')
      .select(
        [
          'id',
          'payment_type',
          'target_type',
          'target_id',
          'order_no',
          'amount',
          'refunded_amount',
          'currency',
          'status',
          'payment_method',
          'approved_at',
          'created_at',
          'refundable_until',
          'failure_message',
        ].join(', '),
      )
      .eq('buyer_user_id', session.authUserId)
      .in('payment_type', DONATION_PAYMENT_TYPES)
      .order('created_at', { ascending: false });

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '후원 구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as unknown as PaymentRow[];

    const siteTargetIds = payments
      .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.SITE)
      .map((payment) => payment.target_id)
      .filter((targetId): targetId is string => Boolean(targetId));

    const boardTargetIds = payments
      .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.BOARD)
      .map((payment) => payment.target_id)
      .filter((targetId): targetId is string => Boolean(targetId));

    const seriesTargetIds = payments
      .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.SERIES)
      .map((payment) => payment.target_id)
      .filter((targetId): targetId is string => Boolean(targetId));

    const postTargetIds = payments
      .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.POST)
      .map((payment) => payment.target_id)
      .filter((targetId): targetId is string => Boolean(targetId));

    const [boardsResult, seriesResult, postsResult] = await Promise.all([
      boardTargetIds.length
        ? supabaseAdmin.from('boards').select('id, site_id, board_key, board_label').in('id', boardTargetIds)
        : { data: [], error: null },
      seriesTargetIds.length
        ? supabaseAdmin
            .from('board_series')
            .select('id, site_id, board_id, series_key, series_label')
            .in('id', seriesTargetIds)
        : { data: [], error: null },
      postTargetIds.length
        ? supabaseAdmin.from('posts').select('id, site_id, board_id, slug, subject').in('id', postTargetIds)
        : { data: [], error: null },
    ]);

    if (boardsResult.error || seriesResult.error || postsResult.error) {
      console.error(boardsResult.error || seriesResult.error || postsResult.error);

      return Response.json({ error: '후원 대상 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const boards = (boardsResult.data ?? []) as BoardRow[];
    const seriesList = (seriesResult.data ?? []) as SeriesRow[];
    const posts = (postsResult.data ?? []) as PostRow[];

    const boardById = new Map(boards.map((board) => [board.id, board]));
    const seriesById = new Map(seriesList.map((series) => [series.id, series]));
    const postById = new Map(posts.map((post) => [post.id, post]));

    const siteIds = Array.from(
      new Set([
        ...siteTargetIds,
        ...boards.map((board) => board.site_id),
        ...seriesList.map((series) => series.site_id),
        ...posts.map((post) => post.site_id),
      ]),
    ).filter(Boolean);

    const sites = await getSitesByIds({
      supabaseAdmin,
      siteIds,
    });

    const siteById = new Map(sites.map((site) => [site.id, site]));

    return Response.json({
      summary: getSummary(payments),
      payments: payments.map((payment) => {
        const paymentStatus = normalizePaymentStatus(payment.status);
        const displayInfo = createDonationDisplayInfo({
          payment,
          siteById,
          boardById,
          seriesById,
          postById,
        });
        const site = displayInfo.site;

        return {
          id: payment.id,
          siteId: site?.id ?? null,
          siteName: site?.site_key ?? null,
          siteLabel: site?.site_label ?? null,
          siteType: site?.site_type ?? null,
          paymentType: payment.payment_type,
          targetType: payment.target_type,
          targetId: payment.target_id,
          targetLabel: displayInfo.targetLabel,
          orderNo: payment.order_no,
          amount: payment.amount,
          refundedAmount: payment.refunded_amount ?? 0,
          netAmount: payment.amount - (payment.refunded_amount ?? 0),
          currency: payment.currency ?? 'KRW',
          status: paymentStatus,
          statusLabel: getPaymentStatusLabel(paymentStatus),
          paymentMethod: payment.payment_method,
          approvedAt: payment.approved_at,
          createdAt: payment.created_at,
          refundableUntil: payment.refundable_until,
          failureMessage: payment.failure_message,
          detail: {
            detailType: 'donation',
            siteLabel: site?.site_label || site?.site_key || '사이트 확인 필요',
            targetLabel: displayInfo.targetLabel,
            paymentTypeLabel: displayInfo.paymentTypeLabel,
            paymentMethodLabel: getPaymentMethodLabel(payment.payment_method),
            approvedAt: payment.approved_at,
            createdAt: payment.created_at,
            status: paymentStatus,
            statusLabel: getPaymentStatusLabel(paymentStatus),
            amount: payment.amount,
            refundedAmount: payment.refunded_amount ?? 0,
            orderNo: payment.order_no,
            nextBillingAt: null,
            serviceEndsAt: null,
            refundedAt:
              paymentStatus === 'refunded' || paymentStatus === 'partially_refunded'
                ? (payment.approved_at ?? payment.created_at)
                : null,
            refundableUntil: payment.refundable_until,
            isRefundable: isRefundableDonation(payment),
          },
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원 구입내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원 구입내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
