import { decrypt } from '@/lib/encryption/decrypt';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
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

type PostRow = {
  id: string;
  site_id: string;
  board_id: string;
  slug: number | string;
  subject: string | null;
  user_id: string | null;
  created_at: string;
  published_at: string | null;
  published_status: string;
  is_closed: boolean;
};

type BoardRow = {
  id: string;
  board_key: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

type StigmaRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
};

type MemberRow = {
  site_id: string;
  user_id: string;
  nickname: string | null;
};

function normalizeSiteType(value: string): SiteType | null {
  if (value === 'blog' || value === 'community') {
    return value;
  }

  return null;
}

function toAmount(value: number | string | null) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? amount : 0;
}

function isIncludedPayment(payment: PaymentRow) {
  if (payment.payment_type === PAYMENT_TYPE.PURCHASE_POST) {
    return payment.status === PAYMENT_STATUS.PAID;
  }

  if (payment.payment_type === PAYMENT_TYPE.DONATION_POST) {
    return (
      (payment.status === PAYMENT_STATUS.PAID || payment.status === PAYMENT_STATUS.PARTIALLY_REFUNDED) &&
      toAmount(payment.amount) > toAmount(payment.refunded_amount)
    );
  }

  return false;
}

function getPostKind(paymentType: string): PostKind {
  return paymentType === PAYMENT_TYPE.PURCHASE_POST ? 'owned' : 'donated';
}

function decryptName(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return '';
  }
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteType = normalizeSiteType(normalizeText(requestUrl.searchParams.get('siteType')).toLowerCase());

    if (!siteType) {
      return Response.json({ error: 'siteType이 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ posts: [] });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const paymentsResult = await supabaseAdmin
      .from('payments')
      .select('target_id, payment_type, status, amount, refunded_amount, approved_at, created_at')
      .eq('buyer_user_id', session.authUserId)
      .eq('target_type', PAYMENT_TARGET_TYPE.POST)
      .in('payment_type', [PAYMENT_TYPE.PURCHASE_POST, PAYMENT_TYPE.DONATION_POST])
      .order('created_at', { ascending: false });

    if (paymentsResult.error) {
      return Response.json({ error: '소장/후원글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const payments = ((paymentsResult.data ?? []) as PaymentRow[]).filter(
      (payment) => Boolean(normalizeText(payment.target_id)) && isIncludedPayment(payment),
    );
    const paymentInfoByPostId = new Map<string, { kinds: Set<PostKind>; latestAt: string }>();

    payments.forEach((payment) => {
      const postId = normalizeText(payment.target_id);

      if (!postId) {
        return;
      }

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

    const postIds = [...paymentInfoByPostId.keys()];

    if (postIds.length === 0) {
      return Response.json({ posts: [] });
    }

    const postsResult = await supabaseAdmin
      .from('posts')
      .select(
        'id, site_id, board_id, slug, subject, user_id, created_at, published_at, published_status, is_closed',
      )
      .in('id', postIds);

    if (postsResult.error) {
      return Response.json({ error: '소장/후원글 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const posts = (postsResult.data ?? []) as PostRow[];
    const siteIds = [...new Set(posts.map((post) => post.site_id))];
    const boardIds = [...new Set(posts.map((post) => post.board_id))];
    const authorIds = [...new Set(posts.map((post) => normalizeText(post.user_id)).filter(Boolean))];

    const [sitesResult, boardsResult, stigmasByAuthIdResult, stigmasByIdResult] = await Promise.all([
      supabaseAdmin
        .from('rhizomes')
        .select('id, site_key, site_label, site_type')
        .in('id', siteIds)
        .eq('site_type', siteType),
      supabaseAdmin.from('boards').select('id, board_key').in('id', boardIds),
      authorIds.length
        ? supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('user_id', authorIds)
        : { data: [], error: null },
      authorIds.length
        ? supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('id', authorIds)
        : { data: [], error: null },
    ]);

    if (sitesResult.error || boardsResult.error || stigmasByAuthIdResult.error || stigmasByIdResult.error) {
      return Response.json({ error: '소장/후원글 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const boards = (boardsResult.data ?? []) as BoardRow[];
    const stigmas = [
      ...((stigmasByAuthIdResult.data ?? []) as StigmaRow[]),
      ...((stigmasByIdResult.data ?? []) as StigmaRow[]),
    ];
    const stigmaByAuthorId = new Map<string, StigmaRow>();

    stigmas.forEach((stigma) => {
      stigmaByAuthorId.set(stigma.id, stigma);

      if (stigma.user_id) {
        stigmaByAuthorId.set(stigma.user_id, stigma);
      }
    });

    const stigmaIds = [...new Set(stigmas.map((stigma) => stigma.id))];
    const membersResult =
      stigmaIds.length && siteIds.length
        ? await supabaseAdmin
            .from('rhizome_stigmas')
            .select('site_id, user_id, nickname')
            .in('site_id', siteIds)
            .in('user_id', stigmaIds)
        : { data: [], error: null };

    if (membersResult.error) {
      return Response.json({ error: '작성자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const memberMap = new Map(
      ((membersResult.data ?? []) as MemberRow[]).map((member) => [
        `${member.site_id}:${member.user_id}`,
        normalizeText(member.nickname),
      ]),
    );
    const siteMap = new Map(sites.map((site) => [site.id, site]));
    const boardMap = new Map(boards.map((board) => [board.id, board]));

    const resultPosts = posts
      .map((post) => {
        const site = siteMap.get(post.site_id);
        const board = boardMap.get(post.board_id);
        const paymentInfo = paymentInfoByPostId.get(post.id);
        const stigma = stigmaByAuthorId.get(normalizeText(post.user_id));

        if (
          !site ||
          !board ||
          !paymentInfo ||
          post.published_status !== 'published' ||
          post.is_closed === true
        ) {
          return null;
        }

        const authorName =
          (stigma ? memberMap.get(`${post.site_id}:${stigma.id}`) : '') || decryptName(stigma?.user_name);

        return {
          id: post.id,
          siteName: site.site_key,
          siteLabel: normalizeText(site.site_label) || site.site_key,
          siteType: site.site_type,
          boardName: board.board_key,
          contentId: String(post.slug),
          title: normalizeText(post.subject),
          authorName,
          createdAt: post.published_at || post.created_at,
          kinds: [...paymentInfo.kinds],
          latestPaymentAt: paymentInfo.latestAt,
        };
      })
      .filter((post): post is NonNullable<typeof post> => Boolean(post))
      .sort(
        (firstPost, secondPost) =>
          new Date(secondPost.latestPaymentAt).getTime() - new Date(firstPost.latestPaymentAt).getTime(),
      );

    return Response.json({ posts: resultPosts });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '소장/후원글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '소장/후원글 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
