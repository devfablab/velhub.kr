import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
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
  refunded_at: string | null;
  refundable_until: string | null;
  failure_message: string | null;
  guardian_identity_verified: boolean | null;
  raw_data: unknown;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
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

const DONATION_PAYMENT_TYPES = [PAYMENT_TYPE.DONATION_SITE, PAYMENT_TYPE.DONATION_SERIES, PAYMENT_TYPE.DONATION_POST];

function normalizePaymentStatus(status: string) {
  return normalizeText(status).toLowerCase();
}

function getPaymentStatusLabel(status: string, paymentType?: string, isTestRefund = false) {
  if (isTestRefund && normalizePaymentStatus(status) === 'refunded') {
    return `${getDonationPaymentTypeLabel(paymentType ?? '')} 테스트 환불`;
  }

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

function getPaymentCardTypeLabel(rawData: unknown) {
  if (!rawData || typeof rawData !== 'object') return null;

  const method = 'method' in rawData ? rawData.method : null;
  if (!method || typeof method !== 'object' || !('card' in method)) return null;

  const card = method.card;
  if (!card || typeof card !== 'object' || !('type' in card) || typeof card.type !== 'string') return null;

  switch (normalizeText(card.type).toLowerCase()) {
    case 'credit':
      return '신용카드';
    case 'check':
      return '체크카드';
    default:
      return '카드';
  }
}

function getPaymentMethodLabel(paymentMethod: string | null, rawData: unknown) {
  const cardTypeLabel = getPaymentCardTypeLabel(rawData);
  if (cardTypeLabel) return cardTypeLabel;

  const normalizedPaymentMethod = normalizeText(paymentMethod).toLowerCase();

  if (!normalizedPaymentMethod) {
    return '결제수단 확인 필요';
  }

  if (normalizedPaymentMethod === 'card' || normalizedPaymentMethod === 'paymentmethodcard') {
    return '카드';
  }

  return normalizedPaymentMethod;
}

function getDonationPaymentTypeLabel(paymentType: string) {
  switch (paymentType) {
    case PAYMENT_TYPE.DONATION_SITE:
      return '블로그 후원';
    case PAYMENT_TYPE.DONATION_SERIES:
      return '연재 후원';
    case PAYMENT_TYPE.DONATION_POST:
      return '포스팅 후원';
    default:
      return '후원';
  }
}

function getAgeAtPayment(birthDate: string | null, approvedAt: string | null) {
  const digits = birthDate?.replace(/\D/g, '') ?? '';
  const paymentDate = approvedAt ? new Date(approvedAt) : null;
  if (digits.length !== 8 || !paymentDate || Number.isNaN(paymentDate.getTime())) return null;

  const paymentParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(paymentDate);
  const values = Object.fromEntries(paymentParts.map((part) => [part.type, part.value]));
  let age = Number(values.year) - Number(digits.slice(0, 4));
  if (
    Number(values.month) < Number(digits.slice(4, 6)) ||
    (Number(values.month) === Number(digits.slice(4, 6)) && Number(values.day) < Number(digits.slice(6, 8)))
  ) {
    age -= 1;
  }

  return age;
}

function canRequestMinorDonationCancellation(payment: PaymentRow, birthDate: string | null) {
  if (normalizePaymentStatus(payment.status) !== 'paid' || payment.guardian_identity_verified) return false;
  const age = getAgeAtPayment(birthDate, payment.approved_at);
  return age !== null && age >= 14 && age < 19;
}

function isTestRefund(rawData: unknown) {
  return Boolean(rawData && typeof rawData === 'object' && 'test_refund' in rawData && rawData.test_refund === true);
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
  seriesById,
  postById,
}: {
  payment: PaymentRow;
  siteById: Map<string, SiteRow>;
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

    const identityResult = await supabaseAdmin
      .from('chorogons')
      .select('birth_date, birth_date_dummy')
      .eq('user_id', session.stigmaId ?? '')
      .maybeSingle();

    if (identityResult.error) {
      console.error(identityResult.error);
      return Response.json({ error: '본인인증 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const buyerBirthDate = getChorogonBirthDate(identityResult.data);

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
          'refunded_at',
          'refundable_until',
          'failure_message',
          'guardian_identity_verified',
          'raw_data',
        ].join(', '),
      )
      .eq('buyer_user_id', session.stigmaId ?? '')
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

    const seriesTargetIds = payments
      .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.SERIES)
      .map((payment) => payment.target_id)
      .filter((targetId): targetId is string => Boolean(targetId));

    const postTargetIds = payments
      .filter((payment) => payment.target_type === PAYMENT_TARGET_TYPE.POST)
      .map((payment) => payment.target_id)
      .filter((targetId): targetId is string => Boolean(targetId));

    const [seriesResult, postsResult] = await Promise.all([
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

    if (seriesResult.error || postsResult.error) {
      console.error(seriesResult.error || postsResult.error);

      return Response.json({ error: '후원 대상 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const seriesList = (seriesResult.data ?? []) as SeriesRow[];
    const posts = (postsResult.data ?? []) as PostRow[];

    const seriesById = new Map(seriesList.map((series) => [series.id, series]));
    const postById = new Map(posts.map((post) => [post.id, post]));

    const siteIds = Array.from(
      new Set([...siteTargetIds, ...seriesList.map((series) => series.site_id), ...posts.map((post) => post.site_id)]),
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
        const paymentIsTestRefund = isTestRefund(payment.raw_data);
        const displayInfo = createDonationDisplayInfo({
          payment,
          siteById,
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
          statusLabel: getPaymentStatusLabel(paymentStatus, payment.payment_type, paymentIsTestRefund),
          paymentMethod: payment.payment_method,
          approvedAt: payment.approved_at,
          createdAt: payment.created_at,
          refundedAt: payment.refunded_at,
          refundableUntil: payment.refundable_until,
          failureMessage: payment.failure_message,
          detail: {
            detailType: 'donation',
            siteLabel: site?.site_label || site?.site_key || '사이트 확인 필요',
            targetLabel: displayInfo.targetLabel,
            paymentTypeLabel: displayInfo.paymentTypeLabel,
            paymentMethodLabel: getPaymentMethodLabel(payment.payment_method, payment.raw_data),
            approvedAt: payment.approved_at,
            createdAt: payment.created_at,
            status: paymentStatus,
            statusLabel: getPaymentStatusLabel(paymentStatus, payment.payment_type, paymentIsTestRefund),
            amount: payment.amount,
            refundedAmount: payment.refunded_amount ?? 0,
            orderNo: payment.order_no,
            nextBillingAt: null,
            serviceEndsAt: null,
            refundedAt:
              paymentStatus === 'refunded' || paymentStatus === 'partially_refunded'
                ? (payment.refunded_at ?? payment.approved_at ?? payment.created_at)
                : null,
            refundableUntil: payment.refundable_until,
            isRefundable: false,
            canRequestMinorCancellation: canRequestMinorDonationCancellation(payment, buyerBirthDate),
            canForceRefundForTest:
              process.env.NEXT_PUBLIC_APP_ENV === 'test' && paymentStatus === 'paid' && !paymentIsTestRefund,
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
