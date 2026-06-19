import { getPaymentPolicyDays, getPaymentPolicyMs } from '@/lib/payments/refunds';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type PaymentSplitRow = {
  id: string;
  payment_id: string;
  site_id: string;
  board_id: string | null;
  series_id: string | null;
  post_id: string | null;
  receiver_user_id: string | null;
  receiver_type: string;
  rate: number;
  amount: number;
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
  splitId: string;
  paymentId: string;
  orderNo: string;
  buyerUserId: string;
  approvedAt: string | null;
  paymentType: string;
  targetType: string;
  targetId: string;
  paymentMethod: string | null;
  receiverUserId: string | null;
  receiverType: string;
  rate: number;
  siteId: string;
  boardId: string | null;
  seriesId: string | null;
  postId: string | null;
  paymentAmount: number;
  paymentRefundedAmount: number;
  splitAmount: number;
  refundedSplitAmount: number;
  settlementAmount: number;
};

type SettlementPreviewTotals = {
  splitAmount: number;
  refundedSplitAmount: number;
  settlementAmount: number;
  platformAmount: number;
  siteOwnerAmount: number;
  postAuthorAmount: number;
};

function calculateRefundedSplitAmount({
  paymentAmount,
  paymentRefundedAmount,
  splitAmount,
}: {
  paymentAmount: number;
  paymentRefundedAmount: number;
  splitAmount: number;
}) {
  if (paymentAmount <= 0) {
    return 0;
  }

  if (paymentRefundedAmount <= 0) {
    return 0;
  }

  if (paymentRefundedAmount >= paymentAmount) {
    return splitAmount;
  }

  return Math.round((splitAmount * paymentRefundedAmount) / paymentAmount);
}

function createSettlementPreviewItem({
  split,
  payment,
}: {
  split: PaymentSplitRow;
  payment: PaymentRow;
}): SettlementPreviewItem {
  const paymentRefundedAmount = payment.refunded_amount ?? 0;
  const refundedSplitAmount = calculateRefundedSplitAmount({
    paymentAmount: payment.amount,
    paymentRefundedAmount,
    splitAmount: split.amount,
  });

  return {
    splitId: split.id,
    paymentId: payment.id,
    orderNo: payment.order_no,
    buyerUserId: payment.buyer_user_id,
    approvedAt: payment.approved_at,
    paymentType: payment.payment_type,
    targetType: payment.target_type,
    targetId: payment.target_id,
    paymentMethod: payment.payment_method,
    receiverUserId: split.receiver_user_id,
    receiverType: split.receiver_type,
    rate: split.rate,
    siteId: split.site_id,
    boardId: split.board_id,
    seriesId: split.series_id,
    postId: split.post_id,
    paymentAmount: payment.amount,
    paymentRefundedAmount,
    splitAmount: split.amount,
    refundedSplitAmount,
    settlementAmount: Math.max(0, split.amount - refundedSplitAmount),
  };
}

function calculateTotals(items: SettlementPreviewItem[]): SettlementPreviewTotals {
  return items.reduce(
    (totals, item) => {
      const platformAmount = item.receiverType === 'platform' ? item.settlementAmount : 0;
      const siteOwnerAmount = item.receiverType === 'site_owner' ? item.settlementAmount : 0;
      const postAuthorAmount = item.receiverType === 'post_author' ? item.settlementAmount : 0;

      return {
        splitAmount: totals.splitAmount + item.splitAmount,
        refundedSplitAmount: totals.refundedSplitAmount + item.refundedSplitAmount,
        settlementAmount: totals.settlementAmount + item.settlementAmount,
        platformAmount: totals.platformAmount + platformAmount,
        siteOwnerAmount: totals.siteOwnerAmount + siteOwnerAmount,
        postAuthorAmount: totals.postAuthorAmount + postAuthorAmount,
      };
    },
    {
      splitAmount: 0,
      refundedSplitAmount: 0,
      settlementAmount: 0,
      platformAmount: 0,
      siteOwnerAmount: 0,
      postAuthorAmount: 0,
    },
  );
}

function createPaymentMap(payments: PaymentRow[]) {
  return new Map(payments.map((payment) => [payment.id, payment]));
}

function sortItems(items: SettlementPreviewItem[]) {
  return items.sort((a, b) => {
    const aTime = a.approvedAt ? new Date(a.approvedAt).getTime() : 0;
    const bTime = b.approvedAt ? new Date(b.approvedAt).getTime() : 0;

    return aTime - bTime;
  });
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

    const refundWindowDays = getPaymentPolicyDays();
    const refundWindowMs = getPaymentPolicyMs();
    const approvedBefore = new Date(Date.now() - refundWindowMs).toISOString();

    const splitsResult = await supabaseAdmin
      .from('payment_splits')
      .select(
        [
          'id',
          'payment_id',
          'site_id',
          'board_id',
          'series_id',
          'post_id',
          'receiver_user_id',
          'receiver_type',
          'rate',
          'amount',
        ].join(', '),
      )
      .eq('site_id', site.id)
      .order('created_at', { ascending: true });

    if (splitsResult.error) {
      console.error(splitsResult.error);

      return Response.json({ error: '분배 내역을 확인하지 못했습니다.' }, { status: 500 });
    }

    const splits = (splitsResult.data ?? []) as PaymentSplitRow[];
    const paymentIds = Array.from(new Set(splits.map((split) => split.payment_id)));

    if (paymentIds.length === 0) {
      return Response.json({
        ok: true,
        site: {
          id: site.id,
          siteName: site.site_key,
          siteLabel: site.site_label,
        },
        refundWindowDays,
        refundWindowMs,
        approvedBefore,
        items: [],
        totals: calculateTotals([]),
      });
    }

    const paymentsResult = await supabaseAdmin
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
      .in('id', paymentIds)
      .in('status', ['paid', 'partially_refunded'])
      .lte('approved_at', approvedBefore)
      .order('approved_at', { ascending: true });

    if (paymentsResult.error) {
      console.error(paymentsResult.error);

      return Response.json({ error: '결제 내역을 확인하지 못했습니다.' }, { status: 500 });
    }

    const payments = (paymentsResult.data ?? []) as PaymentRow[];
    const paymentMap = createPaymentMap(payments);

    const items = sortItems(
      splits.flatMap((split) => {
        const payment = paymentMap.get(split.payment_id);

        if (!payment) {
          return [];
        }

        return [
          createSettlementPreviewItem({
            split,
            payment,
          }),
        ];
      }),
    );

    return Response.json({
      ok: true,
      site: {
        id: site.id,
        siteName: site.site_key,
        siteLabel: site.site_label,
      },
      refundWindowDays,
      refundWindowMs,
      approvedBefore,
      items,
      totals: calculateTotals(items),
    });
  } catch (unknownError) {
    console.error(unknownError);

    return Response.json({ error: '정산 대상을 계산하지 못했습니다.' }, { status: 500 });
  }
}
