import { getPaymentPolicyDays } from '@/lib/payments/refunds';
import { PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

const DAY_MS = 24 * 60 * 60 * 1000;
const PLATFORM_FEE_RATE = 0.17;
const PAYMENT_FEE_RATE = 0.034;
const VAT_RATE = 0.1;

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type BoardRow = {
  id: string;
};

type SeriesRow = {
  id: string;
};

type PaymentRow = {
  id: string;
  approved_at: string | null;
  payment_key: string | null;
  order_no: string;
  buyer_user_id: string;
  amount: number;
  refunded_amount: number | null;
  status: string;
  payment_method: string | null;
  payment_type: string;
  target_type: string;
  target_id: string;
};

type SettlementPreviewItem = {
  paymentId: string;
  orderNo: string;
  buyerUserId: string;
  approvedAt: string | null;
  paymentType: string;
  targetType: string;
  targetId: string;
  paymentMethod: string | null;
  grossAmount: number;
  refundedAmount: number;
  netAmount: number;
  supplyAmount: number;
  vatAmount: number;
  platformFee: number;
  paymentFee: number;
  paymentFeeVat: number;
  settlementAmount: number;
};

function calculateVatIncludedAmount(amount: number) {
  const supplyAmount = Math.round(amount / (1 + VAT_RATE));
  const vatAmount = amount - supplyAmount;

  return {
    supplyAmount,
    vatAmount,
  };
}

function calculateSettlementAmount(amount: number) {
  const { supplyAmount, vatAmount } = calculateVatIncludedAmount(amount);
  const platformFee = Math.round(supplyAmount * PLATFORM_FEE_RATE);
  const paymentFee = Math.round(amount * PAYMENT_FEE_RATE);
  const paymentFeeVat = Math.round(paymentFee * VAT_RATE);
  const settlementAmount = Math.max(0, supplyAmount - platformFee - paymentFee - paymentFeeVat);

  return {
    supplyAmount,
    vatAmount,
    platformFee,
    paymentFee,
    paymentFeeVat,
    settlementAmount,
  };
}

function createSettlementPreviewItem(payment: PaymentRow): SettlementPreviewItem {
  const refundedAmount = payment.refunded_amount ?? 0;
  const netAmount = Math.max(0, payment.amount - refundedAmount);
  const settlement = calculateSettlementAmount(netAmount);

  return {
    paymentId: payment.id,
    orderNo: payment.order_no,
    buyerUserId: payment.buyer_user_id,
    approvedAt: payment.approved_at,
    paymentType: payment.payment_type,
    targetType: payment.target_type,
    targetId: payment.target_id,
    paymentMethod: payment.payment_method,
    grossAmount: payment.amount,
    refundedAmount,
    netAmount,
    supplyAmount: settlement.supplyAmount,
    vatAmount: settlement.vatAmount,
    platformFee: settlement.platformFee,
    paymentFee: settlement.paymentFee,
    paymentFeeVat: settlement.paymentFeeVat,
    settlementAmount: settlement.settlementAmount,
  };
}

function calculateTotals(items: SettlementPreviewItem[]) {
  return items.reduce(
    (totals, item) => ({
      grossAmount: totals.grossAmount + item.grossAmount,
      refundedAmount: totals.refundedAmount + item.refundedAmount,
      netAmount: totals.netAmount + item.netAmount,
      supplyAmount: totals.supplyAmount + item.supplyAmount,
      vatAmount: totals.vatAmount + item.vatAmount,
      platformFee: totals.platformFee + item.platformFee,
      paymentFee: totals.paymentFee + item.paymentFee,
      paymentFeeVat: totals.paymentFeeVat + item.paymentFeeVat,
      settlementAmount: totals.settlementAmount + item.settlementAmount,
    }),
    {
      grossAmount: 0,
      refundedAmount: 0,
      netAmount: 0,
      supplyAmount: 0,
      vatAmount: 0,
      platformFee: 0,
      paymentFee: 0,
      paymentFeeVat: 0,
      settlementAmount: 0,
    },
  );
}

async function getPaymentsByTarget({
  supabaseAdmin,
  targetType,
  targetIds,
  approvedBefore,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  targetType: string;
  targetIds: string[];
  approvedBefore: string;
}) {
  if (targetIds.length === 0) {
    return [];
  }

  const result = await supabaseAdmin
    .from('payments')
    .select(
      [
        'id',
        'approved_at',
        'payment_key',
        'order_no',
        'buyer_user_id',
        'amount',
        'refunded_amount',
        'status',
        'payment_method',
        'payment_type',
        'target_type',
        'target_id',
      ].join(', '),
    )
    .in('status', ['paid', 'partially_refunded'])
    .eq('target_type', targetType)
    .in('target_id', targetIds)
    .lte('approved_at', approvedBefore)
    .order('approved_at', { ascending: true });

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as unknown as PaymentRow[];
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error) {
      console.error(siteResult.error);

      return Response.json({ error: '사이트 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;
    const session = await verifySession({ siteId: site.id });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const boardsResult = await supabaseAdmin.from('boards').select('id').eq('site_id', site.id);

    if (boardsResult.error) {
      console.error(boardsResult.error);

      return Response.json({ error: '게시판 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const seriesResult = await supabaseAdmin.from('board_series').select('id').eq('site_id', site.id);

    if (seriesResult.error) {
      console.error(seriesResult.error);

      return Response.json({ error: '연재 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const boardIds = ((boardsResult.data ?? []) as BoardRow[]).map((board) => board.id);
    const seriesIds = ((seriesResult.data ?? []) as SeriesRow[]).map((series) => series.id);

    const refundWindowDays = getPaymentPolicyDays();
    const approvedBefore = new Date(Date.now() - refundWindowDays * DAY_MS).toISOString();

    const blogPayments = await getPaymentsByTarget({
      supabaseAdmin,
      targetType: PAYMENT_TARGET_TYPE.BLOG,
      targetIds: [site.id],
      approvedBefore,
    });

    const donationPayments = await getPaymentsByTarget({
      supabaseAdmin,
      targetType: PAYMENT_TARGET_TYPE.DONATION,
      targetIds: [site.id],
      approvedBefore,
    });

    const boardPayments = await getPaymentsByTarget({
      supabaseAdmin,
      targetType: PAYMENT_TARGET_TYPE.BOARD,
      targetIds: boardIds,
      approvedBefore,
    });

    const seriesPayments = await getPaymentsByTarget({
      supabaseAdmin,
      targetType: PAYMENT_TARGET_TYPE.SERIES,
      targetIds: seriesIds,
      approvedBefore,
    });

    const ownerPaymentTypes = new Set<string>([
      PAYMENT_TYPE.BLOG_MEMBERSHIP,
      PAYMENT_TYPE.BOARD_SUBSCRIPTION,
      PAYMENT_TYPE.SERIES_SUBSCRIPTION,
      PAYMENT_TYPE.DONATION,
    ]);

    const items = [...blogPayments, ...donationPayments, ...boardPayments, ...seriesPayments]
      .filter((payment) => ownerPaymentTypes.has(payment.payment_type))
      .map(createSettlementPreviewItem);

    return Response.json({
      ok: true,
      site: {
        id: site.id,
        siteName: site.site_key,
        siteLabel: site.site_label,
      },
      refundWindowDays,
      approvedBefore,
      items,
      totals: calculateTotals(items),
    });
  } catch (unknownError) {
    console.error(unknownError);

    return Response.json({ error: '정산 대상을 계산하지 못했습니다.' }, { status: 500 });
  }
}
