import { NextRequest } from 'next/server';
import { hasValidBlogSubscription } from '@/lib/payments/blogDonation';
import { enforceMinorPaymentControl } from '@/lib/payments/minorPaymentControl';
import {
  assertPortOnePaidPayment,
  getCurrentPortOneProvider,
  getPortOnePaidAmount,
  getPortOnePaidAt,
  getPortOnePayment,
  getPortOnePaymentFromResponse,
  getPortOnePaymentMethod,
  getPortOnePaymentTransactionNo,
  PortOneApiError,
} from '@/lib/payments/portone';
import { getPaymentPolicyMs } from '@/lib/payments/refunds';
import { createOwnerPaymentSplits } from '@/lib/payments/splits';
import { PAYMENT_METHOD, PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, REFUND_POLICY } from '@/lib/payments/types';
import { getMailFrom, getResendClient } from '@/lib/resend';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SupabaseAdminClient = ReturnType<typeof getSupabaseAdmin>;

type DonationSuccessBody = {
  paymentKey?: string;
  paymentId?: string;
  orderId?: string;
  orderNo?: string;
  txId?: string;
  amount?: number;
  siteId?: string;
  targetType?: string;
  boardId?: string;
  seriesId?: string;
  guardianIdentityVerificationId?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  owner_id: string;
  is_shutdown: boolean;
};

type BoardRow = {
  id: string;
  site_id: string;
  board_key: string;
  board_label: string | null;
  board_type: string;
  is_active: boolean;
};

type SeriesRow = {
  id: string;
  series_label: string | null;
};

type StigmaRow = {
  id: string;
  user_id: string;
  email?: string | null;
};

type ExistingPaymentRow = {
  id: string;
  amount: number;
};

type PortOnePaymentConfirmResult = {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string;
  totalAmount: number;
  status: string;
  approvedAt: string;
  currency?: string;
  transactionId?: string | null;
  rawData?: unknown;
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

class PortOnePaymentConfirmError extends Error {
  rawData: unknown;

  constructor(message: string, rawData: unknown = null) {
    super(message);
    this.name = 'PortOnePaymentConfirmError';
    this.rawData = rawData;
  }
}

async function confirmPortOnePayment({
  paymentKey,
  orderId,
  amount,
}: {
  paymentKey: string;
  orderId: string;
  amount: number;
}) {
  try {
    const paymentResponse = await getPortOnePayment(paymentKey);
    const payment = getPortOnePaymentFromResponse(paymentResponse);

    assertPortOnePaidPayment(payment);

    const paidAmount = getPortOnePaidAmount(payment);

    if (paidAmount !== amount) {
      throw new PortOnePaymentConfirmError('결제 금액이 올바르지 않습니다.', payment);
    }

    return {
      paymentKey,
      orderId,
      orderName: payment.orderName ?? orderId,
      method: getPortOnePaymentMethod(payment),
      totalAmount: paidAmount,
      status: payment.status,
      approvedAt: getPortOnePaidAt(payment),
      currency: payment.amount?.currency ?? 'KRW',
      transactionId: getPortOnePaymentTransactionNo(payment),
      rawData: payment,
    };
  } catch (unknownError) {
    if (unknownError instanceof PortOnePaymentConfirmError) {
      throw unknownError;
    }

    if (unknownError instanceof PortOneApiError) {
      throw new PortOnePaymentConfirmError(unknownError.message, unknownError.rawData);
    }

    throw unknownError;
  }
}

function createRefundableUntil(startedAt: Date) {
  return new Date(startedAt.getTime() + getPaymentPolicyMs()).toISOString();
}

async function getStigmaId({
  supabaseAdmin,
  stigmaIdOrAuthUserId,
  errorMessage,
}: {
  supabaseAdmin: SupabaseAdminClient;
  stigmaIdOrAuthUserId: string;
  errorMessage: string;
}) {
  const normalizedId = normalizeText(stigmaIdOrAuthUserId);

  if (!normalizedId) {
    throw new Error(errorMessage);
  }

  const stigmaByIdResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id')
    .eq('id', normalizedId)
    .maybeSingle();

  if (stigmaByIdResult.error) {
    throw new Error(errorMessage);
  }

  const stigmaById = stigmaByIdResult.data as StigmaRow | null;

  if (stigmaById?.id) {
    return stigmaById.id;
  }

  const stigmaByUserIdResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id')
    .eq('user_id', normalizedId)
    .maybeSingle();

  if (stigmaByUserIdResult.error) {
    throw new Error(errorMessage);
  }

  const stigmaByUserId = stigmaByUserIdResult.data as StigmaRow | null;

  if (stigmaByUserId?.id) {
    return stigmaByUserId.id;
  }

  throw new Error(errorMessage);
}

async function getSiteById({ supabaseAdmin, siteId }: { supabaseAdmin: SupabaseAdminClient; siteId: string }) {
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type, owner_id, is_shutdown')
    .eq('id', siteId)
    .maybeSingle();

  if (siteResult.error) {
    console.error(siteResult.error);

    throw new Error('사이트 정보를 불러오지 못했습니다.');
  }

  if (!siteResult.data) {
    throw new Error('사이트 정보를 찾을 수 없습니다.');
  }

  const site = siteResult.data as SiteRow;

  if (site.is_shutdown) {
    throw new Error('현재 후원할 수 없는 사이트입니다.');
  }

  return site;
}

function validateSiteDonationTarget(site: SiteRow) {
  if (site.site_type !== 'blog') {
    throw new Error('블로그 후원은 블로그에서만 가능합니다.');
  }
}

async function getBoardById({
  supabaseAdmin,
  site,
  boardId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  site: SiteRow;
  boardId: string;
}) {
  if (!boardId) {
    throw new Error('boardId가 유효하지 않습니다.');
  }

  const boardResult = await supabaseAdmin
    .from('boards')
    .select('id, site_id, board_key, board_label, board_type, is_active')
    .eq('site_id', site.id)
    .eq('id', boardId)
    .maybeSingle();

  if (boardResult.error) {
    console.error(boardResult.error);

    throw new Error('게시판 정보를 불러오지 못했습니다.');
  }

  if (!boardResult.data) {
    throw new Error('게시판 정보를 찾을 수 없습니다.');
  }

  const board = boardResult.data as BoardRow;

  if (!board.is_active) {
    throw new Error('현재 후원할 수 없는 게시판입니다.');
  }

  if (board.board_type === 'page') {
    throw new Error('페이지에 속한 연재는 후원할 수 없습니다.');
  }

  if (site.site_type === 'community' && !['basic', 'gallery'].includes(board.board_type)) {
    throw new Error('커뮤니티는 일반 또는 갤러리 게시판의 연재만 후원할 수 있습니다.');
  }

  return board;
}

async function getSeriesById({
  supabaseAdmin,
  siteId,
  boardId,
  seriesId,
}: {
  supabaseAdmin: SupabaseAdminClient;
  siteId: string;
  boardId: string;
  seriesId: string;
}) {
  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, series_label')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('id', seriesId)
    .maybeSingle();

  if (seriesResult.error) {
    console.error(seriesResult.error);

    throw new Error('연재 정보를 확인하지 못했습니다.');
  }

  if (!seriesResult.data) {
    throw new Error('연재 정보를 찾을 수 없습니다.');
  }

  return seriesResult.data as SeriesRow;
}

async function sendDonationPaymentEmail({
  email,
  siteLabel,
  boardLabel,
  seriesLabel,
  amount,
}: {
  email: string;
  siteLabel: string;
  boardLabel: string | null;
  seriesLabel: string | null;
  amount: number;
}) {
  const rows = [
    ['사이트명', siteLabel],
    ['게시판명', boardLabel],
    ['연재명', seriesLabel],
    ['후원 금액', `${amount.toLocaleString('ko-KR')}원`],
  ]
    .filter(([, value]) => Boolean(normalizeText(value)))
    .map(
      ([label, value]) =>
        `<tr><th style="width:150px;padding:12px 16px;background-color:#181818;color:#ffffff;text-align:left;font-weight:700">${label}</th><td style="padding:12px 16px;border:1px solid #d7d7d7;color:#181818">${value}</td></tr>`,
    )
    .join('');

  const sendResult = await getResendClient().emails.send({
    from: getMailFrom(),
    to: email,
    subject: '[데브허브] 후원 결제가 완료되었습니다',
    html: `
      <table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0">
        <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;box-sizing:border-box;margin:0 auto"><img style="border-style:none" src="https://velhub.xyz/velhub-1-webmail.png" alt="데브허브" width="106" height="24"></div></td></tr>
        <tr><td><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;color:#181818;"><h2>후원 결제가 완료되었습니다</h2><p>콘텐츠에 가치를 더하는 복합 허브 서비스, 데브허브입니다.</p><table style="width:100%;border-collapse:collapse">${rows}</table><p>후원은 콘텐츠 구매나 구독이 아니며, 후원만으로 별도의 콘텐츠 열람 권한이나 혜택이 제공되지는 않습니다.</p><p>정상적으로 완료된 후원은 취소하거나 환불할 수 없습니다.</p><p><strong style="font-size:12px">Everyday, Everywhere, Everymoments - Velhub</strong></p></div></td></tr>
        <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;"><span style="color:#d7d7d7;font-size:12px">&copy; <img src="https://velhub.xyz/velhub-2-webmail.png" alt="데브런닷스튜디오" width="90" height="12"> All rights reserved. <strong style="color:#ff69b4;padding-left:12px">&hearts; velhub</strong></span></div></td></tr>
      </table>
    `,
  });

  if (sendResult.error) {
    throw new Error(sendResult.error.message || '후원 결제 완료 메일을 보내지 못했습니다.');
  }
}

async function getStigmaEmail({ supabaseAdmin, stigmaId }: { supabaseAdmin: SupabaseAdminClient; stigmaId: string }) {
  const stigmaResult = await supabaseAdmin.from('stigmas').select('email').eq('id', stigmaId).maybeSingle();

  if (stigmaResult.error) {
    console.error('[payments/donation] buyer email lookup error', stigmaResult.error);
    return null;
  }

  return normalizeText((stigmaResult.data as StigmaRow | null)?.email);
}

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as DonationSuccessBody;
    const minorControl = await enforceMinorPaymentControl(session.stigmaId, body.guardianIdentityVerificationId);
    if (minorControl.error)
      return Response.json({ error: minorControl.error, guardianAuthRequired: true }, { status: 403 });

    const paymentKey = normalizeText(body.paymentId) || normalizeText(body.paymentKey);
    const orderId = normalizeText(body.orderNo) || normalizeText(body.orderId);
    const txNo = normalizeText(body.txId) || null;
    const siteId = normalizeText(body.siteId);
    const targetType = normalizeText(body.targetType);
    const boardId = normalizeText(body.boardId);
    const seriesId = normalizeText(body.seriesId);
    const amount = body.amount;

    if (!paymentKey || !orderId || !siteId || typeof amount !== 'number') {
      return Response.json({ error: '후원 결제 승인 정보가 없습니다.' }, { status: 400 });
    }

    if (!validateDonationAmount(amount)) {
      return Response.json({ error: '후원금액이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const site = await getSiteById({
      supabaseAdmin,
      siteId,
    });

    const isSeriesDonation = targetType === PAYMENT_TARGET_TYPE.SERIES || Boolean(seriesId);
    const isSiteDonation = !isSeriesDonation;

    if (isSeriesDonation && (!boardId || !seriesId)) {
      return Response.json({ error: '연재 후원 정보가 없습니다.' }, { status: 400 });
    }

    if (isSiteDonation) {
      validateSiteDonationTarget(site);

      const hasBlogSubscription = await hasValidBlogSubscription({
        supabaseAdmin,
        subscriberId: session.stigmaId,
        siteId: site.id,
      });

      if (!hasBlogSubscription) {
        return Response.json({ error: '블로그 구독 중인 회원만 블로그 후원을 할 수 있습니다.' }, { status: 403 });
      }
    }

    const board = isSeriesDonation
      ? await getBoardById({
          supabaseAdmin,
          site,
          boardId,
        })
      : null;

    const series = board
      ? await getSeriesById({
          supabaseAdmin,
          siteId: site.id,
          boardId: board.id,
          seriesId,
        })
      : null;

    const siteOwnerStigmaId = await getStigmaId({
      supabaseAdmin,
      stigmaIdOrAuthUserId: site.owner_id,
      errorMessage: '사이트 오너 정보를 확인하지 못했습니다.',
    });

    const existingPaymentResult = await supabaseAdmin
      .from('payments')
      .select('id, amount')
      .eq('payment_key', paymentKey)
      .limit(1);

    if (existingPaymentResult.error) {
      console.error(existingPaymentResult.error);

      return Response.json({ error: '결제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const existingPayment = ((existingPaymentResult.data ?? [])[0] as ExistingPaymentRow | undefined) ?? null;

    if (existingPayment) {
      await createOwnerPaymentSplits({
        supabaseAdmin,
        paymentId: existingPayment.id,
        siteId: site.id,
        boardId: board?.id ?? null,
        seriesId: series?.id ?? null,
        siteOwnerStigmaId,
        amount: existingPayment.amount,
      });

      return Response.json({
        ok: true,
        paymentId: existingPayment.id,
      });
    }

    const confirmResult = (await confirmPortOnePayment({
      paymentKey,
      orderId,
      amount,
    })) as PortOnePaymentConfirmResult;

    const approvedAt = confirmResult.approvedAt ? new Date(confirmResult.approvedAt) : new Date();

    const paymentInsertResult = await supabaseAdmin
      .from('payments')
      .insert({
        provider: getCurrentPortOneProvider(),
        payment_key: confirmResult.paymentKey,
        order_no: confirmResult.orderId,
        tx_no: txNo,
        transaction_no: confirmResult.transactionId ?? null,
        buyer_user_id: session.stigmaId,
        amount: confirmResult.totalAmount,
        refunded_amount: 0,
        currency: confirmResult.currency || 'KRW',
        status: PAYMENT_STATUS.PAID,
        payment_method: confirmResult.method || PAYMENT_METHOD.CARD,
        payment_type: series ? PAYMENT_TYPE.DONATION_SERIES : PAYMENT_TYPE.DONATION_SITE,
        target_type: series ? PAYMENT_TARGET_TYPE.SERIES : PAYMENT_TARGET_TYPE.SITE,
        target_id: series?.id ?? site.id,
        post_payment: null,
        subscription_id: null,
        failure_code: null,
        failure_message: null,
        failure_stage: null,
        refund_policy: REFUND_POLICY.SEVEN_DAYS,
        refundable_until: createRefundableUntil(approvedAt),
        approved_at: confirmResult.approvedAt,
        refunded_at: null,
        raw_data: confirmResult.rawData ?? confirmResult,
        guardian_identity_verified: Boolean(minorControl.guardianIdentityVerificationId),
        guardian_identity_verified_at: minorControl.guardianIdentityVerificationId ? approvedAt.toISOString() : null,
        guardian_identity_verification_id: minorControl.guardianIdentityVerificationId,
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
      boardId: board?.id ?? null,
      seriesId: series?.id ?? null,
      siteOwnerStigmaId,
      amount: confirmResult.totalAmount,
    });

    const buyerEmail = session.stigmaId
      ? await getStigmaEmail({
          supabaseAdmin,
          stigmaId: session.stigmaId,
        })
      : null;

    if (buyerEmail) {
      try {
        await sendDonationPaymentEmail({
          email: buyerEmail,
          siteLabel: site.site_label,
          boardLabel: board?.board_label ?? null,
          seriesLabel: series?.series_label ?? null,
          amount: confirmResult.totalAmount,
        });
      } catch (emailError) {
        console.error('[payments/donation] completion email error', emailError);
      }
    }

    return Response.json({
      ok: true,
      paymentId: paymentInsertResult.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof PortOnePaymentConfirmError) {
      console.error(unknownError.rawData);

      return Response.json({ error: unknownError.message || '후원 결제 승인에 실패했습니다.' }, { status: 500 });
    }

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원 결제를 완료하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원 결제를 완료하지 못했습니다.' }, { status: 500 });
  }
}
