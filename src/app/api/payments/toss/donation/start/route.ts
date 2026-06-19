import { NextRequest } from 'next/server';
import { createPaymentOrderNo } from '@/lib/payments/orderNo';
import { getTossClientKey } from '@/lib/payments/toss';
import { PAYMENT_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type DonationStartBody = {
  siteName?: string;
  amount?: number;
  successUrl?: string;
  failUrl?: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  is_shutdown: boolean;
};

function createOrderNo() {
  return createPaymentOrderNo('SITE_DONATION');
}

function getSafeRedirectUrl(request: NextRequest, url: string | undefined) {
  if (!url) {
    throw new Error('이동할 주소가 없습니다.');
  }

  const parsedUrl = new URL(url, request.nextUrl.origin);

  if (parsedUrl.origin !== request.nextUrl.origin) {
    throw new Error('이동할 주소가 올바르지 않습니다.');
  }

  return parsedUrl;
}

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

export async function POST(request: NextRequest) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = (await request.json()) as DonationStartBody;
    const siteName = normalizeText(body.siteName).toLowerCase();
    const amount = body.amount;

    if (!siteName) {
      return Response.json({ error: '사이트 정보가 없습니다.' }, { status: 400 });
    }

    if (typeof amount !== 'number' || !validateDonationAmount(amount)) {
      return Response.json(
        {
          error: '후원금액은 1,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.',
        },
        { status: 400 },
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, is_shutdown')
      .eq('site_key', siteName)
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

    const orderNo = createOrderNo();
    const successUrl = getSafeRedirectUrl(request, body.successUrl);
    const failUrl = getSafeRedirectUrl(request, body.failUrl);

    successUrl.searchParams.set('siteId', site.id);
    successUrl.searchParams.set('orderNo', orderNo);
    successUrl.searchParams.set('paymentType', PAYMENT_TYPE.DONATION_SITE);
    successUrl.searchParams.set('amount', String(amount));

    failUrl.searchParams.set('siteId', site.id);
    failUrl.searchParams.set('orderNo', orderNo);
    failUrl.searchParams.set('paymentType', PAYMENT_TYPE.DONATION_SITE);
    failUrl.searchParams.set('amount', String(amount));

    return Response.json({
      clientKey: getTossClientKey(),
      orderNo,
      orderName: `${site.site_label ?? site.site_key} 후원`,
      amount,
      successUrl: successUrl.toString(),
      failUrl: failUrl.toString(),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원을 시작하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원을 시작하지 못했습니다.' }, { status: 500 });
  }
}
