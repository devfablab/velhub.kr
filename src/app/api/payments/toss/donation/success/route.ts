import { NextRequest } from 'next/server';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { createOwnerPaymentSplits } from '@/lib/payments/splits';
import {
  PAYMENT_METHOD,
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
  PAYMENT_TARGET_TYPE,
  PAYMENT_TYPE,
  REFUND_POLICY,
} from '@/lib/payments/types';
import { confirmTossPayment, TossPaymentConfirmError } from '@/lib/payments/toss';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type DonationSuccessBody = {
  paymentKey?: string;
  orderId?: string;
  amount?: number;
  siteId?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  owner_id: string;
  is_shutdown: boolean;
};

type OwnerStigmaRow = {
  id: string;
  user_id: string;
};

type ExistingPaymentRow = {
  id: string;
  amount: number;
};

type TossPaymentConfirmResult = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  currency?: string;
};

function validateDonationAmount(amount: number) {
  if (!Number.isInteger(amount)) {
    return false;
  }

  if (amount < 1000) {
    return false;
  }

  if (amount > 100000) {
    return false;
  }

  return amount % 1000 === 0;
}

function createRefundableUntil(startedAt: Date) {
  return new Date(startedAt.getTime() + getPaymentPolicyMs()).toISOString();
}

async function getSiteOwnerUserId({ supabaseAdmin, ownerId }: { supabaseAdmin: SupabaseAdminClient; ownerId: string }) {
  const ownerStigmaResult = await supabaseAdmin.from('stigmas').select('id, user_id').eq('id', ownerId).maybeSingle();

  if (ownerStigmaResult.error) {
    throw new Error('사이트 오너 정보를 확인하지 못했습니다.');
  }

  if (!ownerStigmaResult.data) {
    throw new Error('사이트 오너 정보를 찾을 수 없습니다.');
  }

  const ownerStigma = ownerStigmaResult.data as OwnerStigmaRow;

  return ownerStigma.user_id;
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as DonationSuccessBody;
    const paymentKey = body.paymentKey?.trim() ?? '';
    const orderId = body.orderId?.trim() ?? '';
    const siteId = body.siteId?.trim() ?? '';
    const amount = body.amount;

    if (!paymentKey || !orderId || !siteId || typeof amount !== 'number') {
      return Response.json({ error: '후원 결제 승인 정보가 없습니다.' }, { status: 400 });
    }

    if (!validateDonationAmount(amount)) {
      return Response.json({ error: '후원금액이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, owner_id, is_shutdown')
      .eq('id', siteId)
      .maybeSingle();

    if (siteResult.error) {
      console.error(siteResult.error);

      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;

    if (site.is_shutdown) {
      return Response.json({ error: '현재 후원할 수 없는 사이트입니다.' }, { status: 400 });
    }

    const siteOwnerUserId = await getSiteOwnerUserId({
      supabaseAdmin,
      ownerId: site.owner_id,
    });

    const existingPaymentResult = await supabaseAdmin
      .from('payments')
      .select('id, amount')
      .eq('payment_key', paymentKey)
      .maybeSingle();

    if (existingPaymentResult.error) {
      console.error(existingPaymentResult.error);

      return Response.json({ error: '결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingPaymentResult.data) {
      const existingPayment = existingPaymentResult.data as ExistingPaymentRow;

      await createOwnerPaymentSplits({
        supabaseAdmin,
        paymentId: existingPayment.id,
        siteId: site.id,
        siteOwnerUserId,
        amount: existingPayment.amount,
      });

      return Response.json({
        ok: true,
        paymentId: existingPayment.id,
      });
    }

    const confirmResult = (await confirmTossPayment({
      paymentKey,
      orderId,
      amount,
    })) as TossPaymentConfirmResult;

    const approvedAt = confirmResult.approvedAt ? new Date(confirmResult.approvedAt) : new Date();

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: PAYMENT_PROVIDER.TOSS,
        payment_key: confirmResult.paymentKey,
        order_no: confirmResult.orderId,
        buyer_user_id: session.authUserId,
        amount: confirmResult.totalAmount,
        refunded_amount: 0,
        currency: confirmResult.currency || 'KRW',
        status: PAYMENT_STATUS.PAID,
        payment_method: PAYMENT_METHOD.CARD,
        payment_type: PAYMENT_TYPE.DONATION_SITE,
        target_type: PAYMENT_TARGET_TYPE.SITE,
        target_id: site.id,
        post_payment: null,
        subscription_id: null,
        failure_code: null,
        failure_message: null,
        failure_stage: null,
        refund_policy: REFUND_POLICY.SEVEN_DAYS,
        refundable_until: createRefundableUntil(approvedAt),
        approved_at: confirmResult.approvedAt,
        refunded_at: null,
        raw_data: confirmResult,
      })
      .select('id')
      .single();

    if (paymentInsertResult.error) {
      console.error(paymentInsertResult.error);

      return Response.json({ error: '후원 결제 내역을 저장하지 못했습니다.' }, { status: 500 });
    }

    await createOwnerPaymentSplits({
      supabaseAdmin,
      paymentId: paymentInsertResult.data.id,
      siteId: site.id,
      siteOwnerUserId,
      amount: confirmResult.totalAmount,
    });

    return Response.json({
      ok: true,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof TossPaymentConfirmError) {
      console.error(unknownError.rawData);

      return Response.json({ error: unknownError.message || '후원 결제 승인에 실패했습니다.' }, { status: 500 });
    }

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원 결제를 완료하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원 결제를 완료하지 못했습니다.' }, { status: 500 });
  }
}
