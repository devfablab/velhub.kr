import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { PAYMENT_STATUS, PAYMENT_TYPE } from '@/lib/payments/types';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type PaymentSplitRow = {
  payment_id: string;
};

type DonationPaymentRow = {
  id: string;
  order_no: string;
  buyer_user_id: string;
  amount: number;
  currency: string;
  status: string;
  payment_method: string;
  payment_type: string;
  target_type: string;
  target_id: string;
  approved_at: string | null;
  created_at: string;
};

type StigmaRow = {
  id: string;
  user_id: string;
  user_name: string | null;
};

type RhizomeStigmaRow = {
  user_id: string;
  nickname: string | null;
};

type SeriesRow = {
  id: string;
  board_id: string;
  series_label: string | null;
};

type BoardRow = {
  id: string;
  board_label: string | null;
};

const DONATION_PAYMENT_TYPES = [PAYMENT_TYPE.DONATION_SITE, PAYMENT_TYPE.DONATION_SERIES];

function decryptUserName(value: string) {
  try {
    return normalizeText(decrypt(value));
  } catch {
    return '';
  }
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

    const session = await verifySession({ siteId: site.id });

    if (session.case !== 'admin' && session.case !== 'staff') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const paymentSplitsResult = await supabaseAdmin.from('payment_splits').select('payment_id').eq('site_id', site.id);

    if (paymentSplitsResult.error) {
      console.error(paymentSplitsResult.error);

      return Response.json({ error: '후원 정산 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const paymentSplits = (paymentSplitsResult.data ?? []) as PaymentSplitRow[];
    const paymentIds = Array.from(new Set(paymentSplits.map((paymentSplit) => paymentSplit.payment_id)));

    const donationsResult = paymentIds.length
      ? await supabaseAdmin
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
              'approved_at',
              'created_at',
            ].join(', '),
          )
          .in('id', paymentIds)
          .in('payment_type', DONATION_PAYMENT_TYPES)
          .eq('status', PAYMENT_STATUS.PAID)
          .order('created_at', { ascending: false })
      : { data: [], error: null };

    if (donationsResult.error) {
      console.error(donationsResult.error);

      return Response.json({ error: '후원 내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    const donations = (donationsResult.data ?? []) as unknown as DonationPaymentRow[];
    const seriesIds = Array.from(
      new Set(
        donations
          .filter((donation) => donation.payment_type === PAYMENT_TYPE.DONATION_SERIES)
          .map((donation) => donation.target_id),
      ),
    );
    const seriesResult = seriesIds.length
      ? await supabaseAdmin.from('board_series').select('id, board_id, series_label').in('id', seriesIds)
      : { data: [], error: null };

    if (seriesResult.error) {
      console.error(seriesResult.error);

      return Response.json({ error: '연재 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const seriesList = (seriesResult.data ?? []) as SeriesRow[];
    const boardIds = Array.from(new Set(seriesList.map((series) => series.board_id)));
    const boardsResult = boardIds.length
      ? await supabaseAdmin.from('boards').select('id, board_label').in('id', boardIds)
      : { data: [], error: null };

    if (boardsResult.error) {
      console.error(boardsResult.error);

      return Response.json({ error: '게시판 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const seriesById = new Map(seriesList.map((series) => [series.id, series]));
    const boardById = new Map(((boardsResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));
    const donorParticleIds = Array.from(new Set(donations.map((donation) => donation.buyer_user_id)));

    const stigmasResult = donorParticleIds.length
      ? await supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('user_id', donorParticleIds)
      : { data: [], error: null };

    if (stigmasResult.error) {
      console.error(stigmasResult.error);

      return Response.json({ error: '후원자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmas = (stigmasResult.data ?? []) as StigmaRow[];
    const stigmaIdByParticleId = new Map(stigmas.map((stigma) => [stigma.user_id, stigma.id]));
    const activityNameByParticleId = new Map(
      stigmas.map((stigma) => [stigma.user_id, decryptUserName(stigma.user_name)]),
    );
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

    const siteDonations = donations.filter((donation) => donation.payment_type === PAYMENT_TYPE.DONATION_SITE);
    const seriesDonations = donations.filter((donation) => donation.payment_type === PAYMENT_TYPE.DONATION_SERIES);
    const getTotalAmount = (items: DonationPaymentRow[]) =>
      items.reduce((total, donation) => total + donation.amount, 0);

    return Response.json({
      site: {
        id: site.id,
        siteKey: site.site_key,
        siteLabel: site.site_label,
      },
      summary: {
        count: donations.length,
        totalAmount: getTotalAmount(donations),
        siteDonationCount: siteDonations.length,
        siteDonationTotalAmount: getTotalAmount(siteDonations),
        seriesDonationCount: seriesDonations.length,
        seriesDonationTotalAmount: getTotalAmount(seriesDonations),
      },
      donations: donations.map((donation) => {
        const stigmaId = stigmaIdByParticleId.get(donation.buyer_user_id);
        const nickname = stigmaId ? normalizeText(nicknameByStigmaId.get(stigmaId)) : '';
        const buyerName = nickname || activityNameByParticleId.get(donation.buyer_user_id) || '사용자';
        const series =
          donation.payment_type === PAYMENT_TYPE.DONATION_SERIES ? (seriesById.get(donation.target_id) ?? null) : null;
        const board = series ? (boardById.get(series.board_id) ?? null) : null;

        return {
          id: donation.id,
          orderNo: donation.order_no,
          buyerUserId: donation.buyer_user_id,
          stigmaId: stigmaId ?? null,
          nickname: buyerName,
          amount: donation.amount,
          currency: donation.currency,
          status: donation.status,
          paymentMethod: donation.payment_method,
          paymentType: donation.payment_type,
          targetType: donation.target_type,
          targetId: donation.target_id,
          approvedAt: donation.approved_at,
          createdAt: donation.created_at,
          donationKind: donation.payment_type === PAYMENT_TYPE.DONATION_SERIES ? 'series' : 'site',
          series: series
            ? {
                id: series.id,
                label: series.series_label,
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
