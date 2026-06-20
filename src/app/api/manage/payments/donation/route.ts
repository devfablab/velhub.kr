import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type DonationPaymentRow = {
  id: string;
  order_no: string;
  buyer_user_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string | null;
  payment_type: string;
  target_type: string;
  target_id: string;
  post_payment: {
    site_id?: string;
    board_id?: string;
    series_id?: string;
    post_id?: string;
  } | null;
  approved_at: string | null;
  created_at: string;
};

type StigmaRow = {
  id: string;
  user_id: string;
};

type RhizomeStigmaRow = {
  user_id: string;
  nickname: string | null;
};

type PostRow = {
  id: string;
  subject: string;
  slug: number;
  board_id: string;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
};

function getDonationKind(paymentType: string) {
  if (paymentType === PAYMENT_TYPE.DONATION_POST) {
    return 'post';
  }

  return 'site';
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

      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const site = siteResult.data as SiteRow;

    const session = await verifySession({
      siteId: site.id,
    });

    if (session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const siteDonationsResult = await supabaseAdmin
      .from('payments')
      .select(
        [
          'id',
          'order_no',
          'buyer_user_id',
          'amount',
          'currency',
          'status',
          'payment_method',
          'payment_type',
          'target_type',
          'target_id',
          'post_payment',
          'approved_at',
          'created_at',
        ].join(', '),
      )
      .eq('payment_type', PAYMENT_TYPE.DONATION_SITE)
      .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
      .eq('target_id', site.id)
      .eq('status', PAYMENT_STATUS.PAID);

    if (siteDonationsResult.error) {
      console.error(siteDonationsResult.error);

      return Response.json({ error: '사이트 후원 내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    const postDonationsResult = await supabaseAdmin
      .from('payments')
      .select(
        [
          'id',
          'order_no',
          'buyer_user_id',
          'amount',
          'currency',
          'status',
          'payment_method',
          'payment_type',
          'target_type',
          'target_id',
          'post_payment',
          'approved_at',
          'created_at',
        ].join(', '),
      )
      .eq('payment_type', PAYMENT_TYPE.DONATION_POST)
      .eq('target_type', PAYMENT_TARGET_TYPE.POST)
      .eq('post_payment->>site_id', site.id)
      .eq('status', PAYMENT_STATUS.PAID);

    if (postDonationsResult.error) {
      console.error(postDonationsResult.error);

      return Response.json({ error: '글 후원 내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    const donations = [
      ...((siteDonationsResult.data ?? []) as unknown as DonationPaymentRow[]),
      ...((postDonationsResult.data ?? []) as unknown as DonationPaymentRow[]),
    ].sort((a, b) => {
      const aTime = new Date(a.approved_at ?? a.created_at).getTime();
      const bTime = new Date(b.approved_at ?? b.created_at).getTime();

      return bTime - aTime;
    });

    const donorParticleIds = Array.from(new Set(donations.map((donation) => donation.buyer_user_id)));

    const stigmasResult = donorParticleIds.length
      ? await supabaseAdmin.from('stigmas').select('id, user_id').in('user_id', donorParticleIds)
      : { data: [], error: null };

    if (stigmasResult.error) {
      console.error(stigmasResult.error);

      return Response.json({ error: '후원자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmas = (stigmasResult.data ?? []) as StigmaRow[];
    const stigmaIdByParticleId = new Map(stigmas.map((stigma) => [stigma.user_id, stigma.id]));
    const donorStigmaIds = stigmas.map((stigma) => stigma.id);

    const rhizomeStigmasResult = donorStigmaIds.length
      ? await supabaseAdmin
          .from('rhizome_stigmas')
          .select('site_id, user_id, nickname')
          .eq('site_id', site.id)
          .in('user_id', donorStigmaIds)
      : { data: [], error: null };

    if (rhizomeStigmasResult.error) {
      console.error(rhizomeStigmasResult.error);

      return Response.json({ error: '후원자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const rhizomeStigmas = (rhizomeStigmasResult.data ?? []) as RhizomeStigmaRow[];
    const nicknameByStigmaId = new Map(
      rhizomeStigmas.map((rhizomeStigma) => [rhizomeStigma.user_id, rhizomeStigma.nickname]),
    );

    const postIds = Array.from(
      new Set(
        donations
          .filter((donation) => donation.payment_type === PAYMENT_TYPE.DONATION_POST)
          .map((donation) => donation.post_payment?.post_id ?? donation.target_id)
          .filter(Boolean),
      ),
    );

    const postsResult = postIds.length
      ? await supabaseAdmin.from('posts').select('id, subject, slug, board_id').in('id', postIds)
      : { data: [], error: null };

    if (postsResult.error) {
      console.error(postsResult.error);

      return Response.json({ error: '후원 글 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const posts = (postsResult.data ?? []) as PostRow[];
    const postById = new Map(posts.map((post) => [post.id, post]));

    const boardIds = Array.from(new Set(posts.map((post) => post.board_id)));

    const boardsResult = boardIds.length
      ? await supabaseAdmin.from('boards').select('id, board_key, board_label').in('id', boardIds)
      : { data: [], error: null };

    if (boardsResult.error) {
      console.error(boardsResult.error);

      return Response.json({ error: '후원 글 게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const boards = (boardsResult.data ?? []) as BoardRow[];
    const boardById = new Map(boards.map((board) => [board.id, board]));

    const siteDonationTotalAmount = donations
      .filter((donation) => donation.payment_type === PAYMENT_TYPE.DONATION_SITE)
      .reduce((total, donation) => total + donation.amount, 0);

    const postDonationTotalAmount = donations
      .filter((donation) => donation.payment_type === PAYMENT_TYPE.DONATION_POST)
      .reduce((total, donation) => total + donation.amount, 0);

    return Response.json({
      site: {
        id: site.id,
        siteKey: site.site_key,
        siteLabel: site.site_label,
      },
      summary: {
        count: donations.length,
        totalAmount: siteDonationTotalAmount + postDonationTotalAmount,
        siteDonationCount: donations.filter((donation) => donation.payment_type === PAYMENT_TYPE.DONATION_SITE).length,
        siteDonationTotalAmount,
        postDonationCount: donations.filter((donation) => donation.payment_type === PAYMENT_TYPE.DONATION_POST).length,
        postDonationTotalAmount,
      },
      donations: donations.map((donation) => {
        const stigmaId = stigmaIdByParticleId.get(donation.buyer_user_id);
        const nickname = stigmaId ? nicknameByStigmaId.get(stigmaId) : '';
        const postId = donation.post_payment?.post_id ?? donation.target_id;
        const post = postById.get(postId);
        const board = post ? boardById.get(post.board_id) : null;

        return {
          id: donation.id,
          orderNo: donation.order_no,
          donationKind: getDonationKind(donation.payment_type),
          buyerUserId: donation.buyer_user_id,
          stigmaId: stigmaId ?? 'stigma 매칭 실패',
          nickname: nickname || 'nickname 매칭 실패',
          amount: donation.amount,
          currency: donation.currency,
          status: donation.status,
          paymentMethod: donation.payment_method,
          approvedAt: donation.approved_at,
          createdAt: donation.created_at,
          post: post
            ? {
                id: post.id,
                subject: post.subject,
                slug: post.slug,
                boardId: post.board_id,
                boardKey: board?.board_key ?? null,
                boardLabel: board?.board_label ?? null,
              }
            : null,
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '후원 내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '후원 내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
