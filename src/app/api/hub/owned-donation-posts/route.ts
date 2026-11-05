import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import { getHubPostDisplayMap } from '@/lib/service/hub/postDisplay';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';
type PostKind = 'owned' | 'donated';

type PaymentRow = {
  target_id: string | null;
  payment_type: string;
  status: string;
  amount: number | string | null;
  refunded_amount: number | string | null;
  approved_at: string | null;
  created_at: string;
};

function normalizeSiteType(value: string): SiteType | null {
  return value === 'blog' || value === 'community' ? value : null;
}

function toAmount(value: number | string | null) {
  const amount = Number(value ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function isIncludedPayment(payment: PaymentRow) {
  if (payment.payment_type === PAYMENT_TYPE.PURCHASE_POST) return payment.status === PAYMENT_STATUS.PAID;

  return (
    payment.payment_type === PAYMENT_TYPE.DONATION_POST &&
    (payment.status === PAYMENT_STATUS.PAID || payment.status === PAYMENT_STATUS.PARTIALLY_REFUNDED) &&
    toAmount(payment.amount) > toAmount(payment.refunded_amount)
  );
}

function getPostKind(paymentType: string): PostKind {
  return paymentType === PAYMENT_TYPE.PURCHASE_POST ? 'owned' : 'donated';
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteType = normalizeSiteType(normalizeText(requestUrl.searchParams.get('siteType')).toLowerCase());

    if (!siteType) return Response.json({ error: 'siteType이 유효하지 않습니다.' }, { status: 400 });

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) return Response.json({ posts: [] });

    const paymentsResult = await getSupabaseAdmin()
      .from('payments')
      .select('target_id, payment_type, status, amount, refunded_amount, approved_at, created_at')
      .eq('buyer_user_id', session.stigmaId ?? '')
      .eq('target_type', PAYMENT_TARGET_TYPE.POST)
      .in('payment_type', [PAYMENT_TYPE.PURCHASE_POST, PAYMENT_TYPE.DONATION_POST])
      .order('created_at', { ascending: false });

    if (paymentsResult.error)
      return Response.json({ error: '소장/후원글 목록을 불러오지 못했습니다.' }, { status: 500 });

    const paymentInfoByPostId = new Map<string, { kinds: Set<PostKind>; latestAt: string }>();

    ((paymentsResult.data ?? []) as PaymentRow[]).filter(isIncludedPayment).forEach((payment) => {
      const postId = normalizeText(payment.target_id);

      if (!postId) return;

      const existingInfo = paymentInfoByPostId.get(postId);

      if (existingInfo) {
        existingInfo.kinds.add(getPostKind(payment.payment_type));
        return;
      }

      paymentInfoByPostId.set(postId, {
        kinds: new Set([getPostKind(payment.payment_type)]),
        latestAt: payment.approved_at || payment.created_at,
      });
    });

    const postMap = await getHubPostDisplayMap({
      postIds: [...paymentInfoByPostId.keys()],
      siteType,
      viewerStigmaId: session.stigmaId,
    });
    const posts = [...paymentInfoByPostId.entries()]
      .flatMap(([postId, paymentInfo]) => {
        const post = postMap.get(postId);
        const hasPermanentPurchase = paymentInfo.kinds.has('owned');

        if (!post || !post.isPublished || (post.isClosed && !hasPermanentPurchase)) return [];

        const [siteName, boardName, contentId] = post.href.replace(/^\//, '').split('/');

        return [
          {
            id: post.id,
            siteName,
            boardName,
            contentId,
            createdAt: post.publishedAt || paymentInfo.latestAt,
            isClosed: post.isClosed,
            kinds: [...paymentInfo.kinds],
            latestPaymentAt: paymentInfo.latestAt,
            post,
          },
        ];
      })
      .sort((first, second) => new Date(second.latestPaymentAt).getTime() - new Date(first.latestPaymentAt).getTime());

    return Response.json({ posts });
  } catch (unknownError) {
    return Response.json(
      {
        error:
          unknownError instanceof Error
            ? unknownError.message || '소장/후원글 목록을 불러오지 못했습니다.'
            : '소장/후원글 목록을 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}
