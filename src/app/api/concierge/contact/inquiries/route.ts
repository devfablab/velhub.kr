import { NextRequest } from 'next/server';
import { inquirySubtypes, isInquiryType } from '@/lib/concierge/inquiries';
import { MEMBERSHIP_FEATURES } from '@/lib/memberships/catalog';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

const MINOR_CANCELLATION_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getPaymentTypeLabel(paymentType: string) {
  const labels: Record<string, string> = {
    [PAYMENT_TYPE.MEMBERSHIP_BLOG]: '블로그 멤버십',
    [PAYMENT_TYPE.MEMBERSHIP_PLATFORM]: '플랫폼 멤버십',
    [PAYMENT_TYPE.SUBSCRIPTION_BOARD]: '게시판 구독',
    [PAYMENT_TYPE.SUBSCRIPTION_SERIES]: '연재 구독',
    [PAYMENT_TYPE.DONATION_SITE]: '블로그 후원',
    [PAYMENT_TYPE.DONATION_BOARD]: '게시판 후원',
    [PAYMENT_TYPE.DONATION_SERIES]: '연재 후원',
    [PAYMENT_TYPE.DONATION_POST]: '연재글 후원',
    [PAYMENT_TYPE.PURCHASE_POST]: '연재글 구매',
  };
  return labels[paymentType] ?? '결제';
}

function getMembershipLabel(type: string | null | undefined) {
  const labels: Record<string, string> = {
    owner: '오너 멤버십',
    creator: '크리에이터 멤버십',
    all_in_one: '올인원 멤버십',
    affetto: '아페토 멤버십',
  };
  return type ? (labels[type] ?? '플랫폼 멤버십') : '플랫폼 멤버십';
}

async function getCancellationAvailability(stigmaId: string) {
  const db = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - MINOR_CANCELLATION_COOLDOWN_MS).toISOString();
  const { data, error } = await db
    .from('inquiries')
    .select('created_at')
    .eq('requester_stigma_id', stigmaId)
    .eq('inquiry_type', 'minor_purchase_cancellation')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data?.created_at ? new Date(new Date(data.created_at).getTime() + MINOR_CANCELLATION_COOLDOWN_MS) : null;
}

async function getPaymentOptions(stigmaId: string) {
  const db = getSupabaseAdmin();
  const { data: paymentRows, error } = await db
    .from('payments')
    .select(
      'id, order_no, payment_type, target_type, target_id, amount, currency, approved_at, status, refunded_amount, guardian_identity_verified',
    )
    .eq('buyer_user_id', stigmaId)
    .eq('status', PAYMENT_STATUS.PAID)
    .eq('guardian_identity_verified', false)
    .order('approved_at', { ascending: false });
  if (error) throw error;

  const payments = (paymentRows ?? []).filter((payment) => Number(payment.refunded_amount ?? 0) === 0);
  if (!payments.length) return [];

  const { data: linkedRows, error: linkedError } = await db
    .from('inquiry_orders')
    .select('payment_id')
    .in(
      'payment_id',
      payments.map((payment) => payment.id),
    );
  if (linkedError) throw linkedError;
  const linkedPaymentIds = new Set((linkedRows ?? []).map((row) => row.payment_id));
  const eligiblePayments = payments.filter((payment) => !linkedPaymentIds.has(payment.id));

  const siteIds = new Set<string>();
  const boardIds = new Set<string>();
  const seriesIds = new Set<string>();
  const postIds = new Set<string>();
  const membershipIds = new Set<string>();
  for (const payment of eligiblePayments) {
    if (!payment.target_id) continue;
    if (payment.target_type === PAYMENT_TARGET_TYPE.SITE) siteIds.add(payment.target_id);
    if (payment.target_type === PAYMENT_TARGET_TYPE.BOARD) boardIds.add(payment.target_id);
    if (payment.target_type === PAYMENT_TARGET_TYPE.SERIES) seriesIds.add(payment.target_id);
    if (payment.target_type === PAYMENT_TARGET_TYPE.POST) postIds.add(payment.target_id);
    if (payment.target_type === PAYMENT_TARGET_TYPE.MEMBERSHIP) membershipIds.add(payment.target_id);
  }

  const [boardResult, seriesResult, postResult, membershipResult] = await Promise.all([
    boardIds.size
      ? db
          .from('boards')
          .select('id, site_id, board_label, board_key')
          .in('id', [...boardIds])
      : Promise.resolve({ data: [], error: null }),
    seriesIds.size
      ? db
          .from('board_series')
          .select('id, site_id, series_label, series_key')
          .in('id', [...seriesIds])
      : Promise.resolve({ data: [], error: null }),
    postIds.size
      ? db
          .from('posts')
          .select('id, site_id, board_id, series_id, subject')
          .in('id', [...postIds])
      : Promise.resolve({ data: [], error: null }),
    membershipIds.size
      ? db
          .from('memberships')
          .select('id, membership_type')
          .in('id', [...membershipIds])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (boardResult.error || seriesResult.error || postResult.error || membershipResult.error)
    throw boardResult.error ?? seriesResult.error ?? postResult.error ?? membershipResult.error;

  for (const board of boardResult.data ?? []) siteIds.add(board.site_id);
  for (const series of seriesResult.data ?? []) siteIds.add(series.site_id);
  for (const post of postResult.data ?? []) {
    siteIds.add(post.site_id);
    if (post.board_id) boardIds.add(post.board_id);
    if (post.series_id) seriesIds.add(post.series_id);
  }

  const [siteResult, additionalBoardResult, additionalSeriesResult, itemResult] = await Promise.all([
    siteIds.size
      ? db
          .from('rhizomes')
          .select('id, site_label, site_key')
          .in('id', [...siteIds])
      : Promise.resolve({ data: [], error: null }),
    boardIds.size
      ? db
          .from('boards')
          .select('id, site_id, board_label, board_key')
          .in('id', [...boardIds])
      : Promise.resolve({ data: [], error: null }),
    seriesIds.size
      ? db
          .from('board_series')
          .select('id, site_id, series_label, series_key')
          .in('id', [...seriesIds])
      : Promise.resolve({ data: [], error: null }),
    membershipIds.size
      ? db
          .from('membership_items')
          .select('membership_id, plan_id')
          .in('membership_id', [...membershipIds])
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (siteResult.error || additionalBoardResult.error || additionalSeriesResult.error || itemResult.error)
    throw siteResult.error ?? additionalBoardResult.error ?? additionalSeriesResult.error ?? itemResult.error;

  const planIds = [...new Set((itemResult.data ?? []).map((item) => item.plan_id))];
  const planResult = planIds.length
    ? await db.from('plans').select('id, plan_key').in('id', planIds)
    : { data: [], error: null };
  if (planResult.error) throw planResult.error;

  const siteMap = new Map((siteResult.data ?? []).map((site) => [site.id, site.site_label || site.site_key]));
  const boardMap = new Map(
    (additionalBoardResult.data ?? []).map((board) => [
      board.id,
      { label: board.board_label || board.board_key, siteId: board.site_id },
    ]),
  );
  const seriesMap = new Map(
    (additionalSeriesResult.data ?? []).map((series) => [
      series.id,
      { label: series.series_label || series.series_key, siteId: series.site_id },
    ]),
  );
  const postMap = new Map((postResult.data ?? []).map((post) => [post.id, post]));
  const membershipMap = new Map((membershipResult.data ?? []).map((membership) => [membership.id, membership]));
  const planMap = new Map((planResult.data ?? []).map((plan) => [plan.id, plan.plan_key]));
  const featureLabelMap = new Map(MEMBERSHIP_FEATURES.map((feature) => [feature.key, feature.label]));
  const featureLabelsByMembership = new Map<string, string[]>();
  for (const item of itemResult.data ?? []) {
    const featureKey = planMap.get(item.plan_id)?.replace(/^all_in_one_/, '');
    const featureLabel = featureKey ? featureLabelMap.get(featureKey) : null;
    if (!featureLabel) continue;
    featureLabelsByMembership.set(item.membership_id, [
      ...(featureLabelsByMembership.get(item.membership_id) ?? []),
      featureLabel,
    ]);
  }

  return eligiblePayments.map((payment) => {
    const segments: string[] = [];
    if (payment.target_type === PAYMENT_TARGET_TYPE.MEMBERSHIP) {
      segments.push(getMembershipLabel(membershipMap.get(payment.target_id ?? '')?.membership_type));
      const features = featureLabelsByMembership.get(payment.target_id ?? '');
      if (features?.length) segments.push(features.join(', '));
    } else {
      const post = postMap.get(payment.target_id ?? '');
      const board =
        payment.target_type === PAYMENT_TARGET_TYPE.BOARD
          ? boardMap.get(payment.target_id ?? '')
          : post?.board_id
            ? boardMap.get(post.board_id)
            : null;
      const series =
        payment.target_type === PAYMENT_TARGET_TYPE.SERIES
          ? seriesMap.get(payment.target_id ?? '')
          : post?.series_id
            ? seriesMap.get(post.series_id)
            : null;
      const siteId =
        payment.target_type === PAYMENT_TARGET_TYPE.SITE
          ? payment.target_id
          : (series?.siteId ?? board?.siteId ?? post?.site_id);
      const siteLabel = siteId ? siteMap.get(siteId) : null;
      if (siteLabel) segments.push(siteLabel);
      if (series?.label) segments.push(series.label);
      else if (board?.label) segments.push(board.label);
      if (post?.subject) segments.push(post.subject);
      segments.push(getPaymentTypeLabel(payment.payment_type));
    }
    segments.push(`${Number(payment.amount).toLocaleString('ko-KR')}원`);
    return {
      id: payment.id,
      label: `${segments.join(' / ')}${payment.order_no ? ` (${payment.order_no})` : ''}`,
      approvedAt: payment.approved_at,
    };
  });
}

export async function GET(request: NextRequest) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('inquiries')
    .select('id, inquiry_type, inquiry_subtype, status, title, created_at, closed_at, resolution_code')
    .eq('requester_stigma_id', currentStigma.stigmaId)
    .order('created_at', { ascending: false });
  if (error) return Response.json({ error: '문의 내역을 불러오지 못했습니다.' }, { status: 500 });

  try {
    const cancellationAvailableAt = await getCancellationAvailability(currentStigma.stigmaId);
    const payments =
      request.nextUrl.searchParams.get('payments') === 'true' ? await getPaymentOptions(currentStigma.stigmaId) : [];
    return Response.json({
      inquiries: data ?? [],
      payments,
      cancellationAvailableAt: cancellationAvailableAt?.toISOString() ?? null,
    });
  } catch {
    return Response.json({ error: '청약취소 가능 결제 내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const inquiryType = body?.inquiryType;
  const inquirySubtype = getText(body?.inquirySubtype);
  const title = getText(body?.title);
  const content = getText(body?.content);
  const paymentId = getText(body?.paymentId);

  if (!isInquiryType(inquiryType)) return Response.json({ error: '문의 유형을 선택해 주세요.' }, { status: 400 });
  if (!inquirySubtypes[inquiryType].some((option) => option.value === inquirySubtype))
    return Response.json({ error: '문의 세부 유형을 선택해 주세요.' }, { status: 400 });
  if (!title || title.length > 120 || !content || content.length > 10000)
    return Response.json({ error: '제목 또는 문의 내용을 확인해 주세요.' }, { status: 400 });
  if (inquiryType === 'minor_purchase_cancellation' && !paymentId)
    return Response.json({ error: '청약취소를 요청할 결제를 선택해 주세요.' }, { status: 400 });

  const db = getSupabaseAdmin();
  if (inquiryType === 'minor_purchase_cancellation') {
    const availableAt = await getCancellationAvailability(currentStigma.stigmaId);
    if (availableAt)
      return Response.json(
        {
          error: `다른 결제 건은 ${availableAt.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}부터 신청할 수 있습니다.`,
        },
        { status: 429 },
      );
    const { data: payment, error: paymentError } = await db
      .from('payments')
      .select('id, buyer_user_id, status, refunded_amount, guardian_identity_verified')
      .eq('id', paymentId)
      .maybeSingle();
    if (
      paymentError ||
      !payment ||
      payment.buyer_user_id !== currentStigma.stigmaId ||
      payment.status !== PAYMENT_STATUS.PAID ||
      Number(payment.refunded_amount ?? 0) !== 0 ||
      payment.guardian_identity_verified
    )
      return Response.json({ error: '청약취소를 신청할 수 없는 결제입니다.' }, { status: 400 });
    const { data: linkedOrder } = await db
      .from('inquiry_orders')
      .select('id')
      .eq('payment_id', paymentId)
      .maybeSingle();
    if (linkedOrder) return Response.json({ error: '이미 문의가 접수된 결제입니다.' }, { status: 400 });
  }

  const { data: inquiry, error: inquiryError } = await db
    .from('inquiries')
    .insert({
      requester_stigma_id: currentStigma.stigmaId,
      inquiry_type: inquiryType,
      inquiry_subtype: inquirySubtype,
      title,
      content,
    })
    .select('id, inquiry_type, status, title, content, created_at')
    .single();
  if (inquiryError || !inquiry) return Response.json({ error: '문의 접수에 실패했습니다.' }, { status: 500 });

  if (paymentId) {
    const { error: orderError } = await db
      .from('inquiry_orders')
      .insert({ inquiry_id: inquiry.id, payment_id: paymentId });
    if (orderError) {
      await db.from('inquiries').delete().eq('id', inquiry.id);
      return Response.json({ error: '문의에 결제를 연결하지 못했습니다.' }, { status: 500 });
    }
  }
  await db
    .from('inquiry_status')
    .insert({ inquiry_id: inquiry.id, next_status: 'received', changed_by_stigma_id: currentStigma.stigmaId });
  return Response.json({ inquiry }, { status: 201 });
}
