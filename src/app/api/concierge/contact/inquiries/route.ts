import { NextRequest } from 'next/server';
import { inquirySubtypes, isInquiryType } from '@/lib/concierge/inquiries';
import { getChorogonBirthDate } from '@/lib/identity/chorogon';
import { MEMBERSHIP_FEATURES } from '@/lib/memberships/catalog';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE } from '@/lib/payments/types';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

const MINOR_CANCELLATION_COOLDOWN_MS = 15 * 24 * 60 * 60 * 1000;

function getText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function getKoreanDateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day) };
}

function wasMinorAtPayment(birthDate: string | null, approvedAt: string | null) {
  const digits = birthDate?.replace(/\D/g, '') ?? '';
  const paymentDate = approvedAt ? getKoreanDateParts(approvedAt) : null;
  if (digits.length !== 8 || !paymentDate) return false;
  const birthYear = Number(digits.slice(0, 4));
  const birthMonth = Number(digits.slice(4, 6));
  const birthDay = Number(digits.slice(6, 8));
  let age = paymentDate.year - birthYear;
  if (paymentDate.month < birthMonth || (paymentDate.month === birthMonth && paymentDate.day < birthDay)) age -= 1;
  return age >= 0 && age < 19;
}

async function getBuyerBirthDate(stigmaId: string) {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('chorogons')
    .select('birth_date, birth_date_dummy')
    .eq('user_id', stigmaId)
    .maybeSingle();
  if (error) throw error;
  return getChorogonBirthDate(data);
}

function getPaymentTypeLabel(paymentType: string) {
  const labels: Record<string, string> = {
    [PAYMENT_TYPE.SUBSCRIPTION_SITE]: '블로그 구독',
    [PAYMENT_TYPE.MEMBERSHIP]: '멤버십',
    [PAYMENT_TYPE.SUBSCRIPTION_SERIES]: '연재 구독',
    [PAYMENT_TYPE.DONATION_SITE]: '블로그 후원',
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
  return type ? (labels[type] ?? '멤버십') : '멤버십';
}

type AttemptedPaymentInput = {
  kind: string;
  subtype: string;
  membershipType: string;
  featureKeys: string[];
  siteId: string;
  seriesId: string;
  postId: string;
  amount: number | null;
};

async function resolveAttemptedPayment(input: AttemptedPaymentInput) {
  const db = getSupabaseAdmin();
  if (input.kind === 'membership') {
    if (!['owner', 'creator', 'all_in_one', 'affetto'].includes(input.membershipType) || !input.featureKeys.length)
      throw new Error('멤버십 종류와 선택했던 기능을 확인해 주세요.');
    const featureMap = new Map<string, (typeof MEMBERSHIP_FEATURES)[number]>(
      MEMBERSHIP_FEATURES.map((feature) => [feature.key, feature]),
    );
    const features = input.featureKeys.map((key) => featureMap.get(key)).filter(Boolean);
    if (features.length !== input.featureKeys.length) throw new Error('선택한 멤버십 기능을 확인해 주세요.');
    return {
      label: `${getMembershipLabel(input.membershipType)} / ${features.map((feature) => feature?.label).join(', ')}`,
      boardId: null,
    };
  }

  if (!['subscription', 'donation', 'post_purchase'].includes(input.kind) || !input.siteId)
    throw new Error('결제하려던 항목과 사이트를 선택해 주세요.');
  const validSubtypes: Record<string, string[]> = {
    subscription: ['site_subscription', 'series_subscription'],
    donation: ['site_donation', 'series_donation'],
    post_purchase: ['post_purchase'],
  };
  if (!validSubtypes[input.kind]?.includes(input.subtype))
    throw new Error('결제하려던 항목의 세부 종류를 선택해 주세요.');
  const { data: site, error: siteError } = await db
    .from('rhizomes')
    .select('id, site_label, site_key')
    .eq('id', input.siteId)
    .eq('is_shutdown', false)
    .maybeSingle();
  if (siteError || !site) throw new Error('선택한 사이트를 확인할 수 없습니다.');
  const siteLabel = site.site_label || site.site_key;

  if (input.subtype === 'site_subscription' || input.subtype === 'site_donation') {
    return {
      label: `${siteLabel} / ${input.subtype === 'site_subscription' ? '블로그 구독' : '블로그 후원'}`,
      boardId: null,
    };
  }

  if (['series_subscription', 'series_donation', 'post_purchase'].includes(input.subtype)) {
    const { data: series } = await db
      .from('board_series')
      .select('id, board_id, series_label, series_key')
      .eq('id', input.seriesId)
      .eq('site_id', input.siteId)
      .maybeSingle();
    if (!series) throw new Error('결제하려던 연재를 선택해 주세요.');
    const seriesLabel = series.series_label || series.series_key;
    if (input.subtype !== 'post_purchase') {
      return {
        label: `${siteLabel} / ${seriesLabel} / ${input.subtype === 'series_subscription' ? '연재 구독' : '연재 후원'}`,
        boardId: series.board_id,
      };
    }
    const { data: post } = await db
      .from('posts')
      .select('id, subject, board_id')
      .eq('id', input.postId)
      .eq('site_id', input.siteId)
      .eq('series_id', input.seriesId)
      .eq('published_status', 'published')
      .eq('is_closed', false)
      .maybeSingle();
    if (!post) throw new Error('영구소장하려던 연재글을 선택해 주세요.');
    return { label: `${siteLabel} / ${seriesLabel} / ${post.subject} / 연재글 영구소장`, boardId: post.board_id };
  }

  throw new Error('결제하려던 항목의 세부 종류를 선택해 주세요.');
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

async function getPaymentOptions(stigmaId: string, cancellationOnly = true) {
  const db = getSupabaseAdmin();
  const birthDate = cancellationOnly ? await getBuyerBirthDate(stigmaId) : null;
  let paymentQuery = db
    .from('payments')
    .select(
      'id, order_no, payment_type, target_type, target_id, amount, currency, approved_at, status, refunded_amount, guardian_identity_verified, provider, payment_method, created_at',
    )
    .eq('buyer_user_id', stigmaId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (cancellationOnly)
    paymentQuery = paymentQuery.eq('status', PAYMENT_STATUS.PAID).eq('guardian_identity_verified', false);
  const { data: paymentRows, error } = await paymentQuery;
  if (error) throw error;

  const payments = cancellationOnly
    ? (paymentRows ?? []).filter(
        (payment) => Number(payment.refunded_amount ?? 0) === 0 && wasMinorAtPayment(birthDate, payment.approved_at),
      )
    : (paymentRows ?? []);
  if (!payments.length) return [];

  let eligiblePayments = payments;
  if (cancellationOnly) {
    const { data: linkedRows, error: linkedError } = await db
      .from('inquiry_orders')
      .select('payment_id')
      .in(
        'payment_id',
        payments.map((payment) => payment.id),
      );
    if (linkedError) throw linkedError;
    const linkedPaymentIds = new Set((linkedRows ?? []).map((row) => row.payment_id));
    eligiblePayments = payments.filter((payment) => !linkedPaymentIds.has(payment.id));
  }

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
      status: payment.status,
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
    const paymentMode = request.nextUrl.searchParams.get('payments');
    const payments = paymentMode ? await getPaymentOptions(currentStigma.stigmaId, paymentMode !== 'all') : [];
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
  const pageUrl = getText(body?.pageUrl);
  const occurredAt = getText(body?.occurredAt);
  const attemptedAction = getText(body?.attemptedAction);
  const actualBehavior = getText(body?.actualBehavior);
  const recurrence = getText(body?.recurrence);
  const errorMessage = getText(body?.errorMessage);
  const attemptedPayment: AttemptedPaymentInput = {
    kind: getText(body?.attemptedPaymentKind),
    subtype: getText(body?.attemptedPaymentSubtype),
    membershipType: getText(body?.attemptedMembershipType),
    featureKeys: Array.isArray(body?.attemptedFeatureKeys)
      ? body.attemptedFeatureKeys.map(getText).filter(Boolean)
      : [],
    siteId: getText(body?.attemptedSiteId),
    seriesId: getText(body?.attemptedSeriesId),
    postId: getText(body?.attemptedPostId),
    amount:
      typeof body?.attemptedAmount === 'number' && Number.isFinite(body.attemptedAmount) ? body.attemptedAmount : null,
  };
  const displayedMessage = getText(body?.displayedMessage);
  const environment =
    body?.environment && typeof body.environment === 'object' ? (body.environment as Record<string, unknown>) : {};
  const occurredAtDate = occurredAt ? new Date(occurredAt) : null;

  if (!isInquiryType(inquiryType)) return Response.json({ error: '문의 유형을 선택해 주세요.' }, { status: 400 });
  if (!inquirySubtypes[inquiryType].some((option) => option.value === inquirySubtype))
    return Response.json({ error: '문의 세부 유형을 선택해 주세요.' }, { status: 400 });
  const isBug = inquiryType === 'bug_report';
  const isPaymentProblem = inquiryType === 'payment_refund_error';
  const requiresPayment = isPaymentProblem && inquirySubtype !== 'payment_declined';
  if (!isBug && !isPaymentProblem && (!title || title.length > 120 || !content || content.length > 10000))
    return Response.json({ error: '제목 또는 문의 내용을 확인해 주세요.' }, { status: 400 });
  if (
    isBug &&
    (!pageUrl ||
      !occurredAtDate ||
      Number.isNaN(occurredAtDate.getTime()) ||
      !attemptedAction ||
      !actualBehavior ||
      !['always', 'often', 'sometimes', 'once'].includes(recurrence))
  )
    return Response.json({ error: '에러 / 버그 발생 정보를 모두 입력해 주세요.' }, { status: 400 });
  if (
    isPaymentProblem &&
    (!occurredAtDate ||
      Number.isNaN(occurredAtDate.getTime()) ||
      !actualBehavior ||
      (requiresPayment ? !paymentId : !attemptedPayment.kind))
  )
    return Response.json({ error: '결제 / 환불 문제 정보를 모두 입력해 주세요.' }, { status: 400 });
  if (inquiryType === 'minor_purchase_cancellation' && !paymentId)
    return Response.json({ error: '청약취소를 요청할 결제를 선택해 주세요.' }, { status: 400 });

  const db = getSupabaseAdmin();
  let attemptedPaymentTarget: Awaited<ReturnType<typeof resolveAttemptedPayment>> | null = null;
  if (isPaymentProblem && !requiresPayment) {
    if (attemptedPayment.kind === 'donation' && (!attemptedPayment.amount || attemptedPayment.amount <= 0))
      return Response.json({ error: '후원하려던 금액을 입력해 주세요.' }, { status: 400 });
    try {
      attemptedPaymentTarget = await resolveAttemptedPayment(attemptedPayment);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : '결제하려던 항목을 확인해 주세요.' },
        { status: 400 },
      );
    }
  }
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
      .select('id, buyer_user_id, status, refunded_amount, guardian_identity_verified, approved_at')
      .eq('id', paymentId)
      .maybeSingle();
    const birthDate = await getBuyerBirthDate(currentStigma.stigmaId);
    if (
      paymentError ||
      !payment ||
      payment.buyer_user_id !== currentStigma.stigmaId ||
      payment.status !== PAYMENT_STATUS.PAID ||
      Number(payment.refunded_amount ?? 0) !== 0 ||
      payment.guardian_identity_verified ||
      !wasMinorAtPayment(birthDate, payment.approved_at)
    )
      return Response.json({ error: '청약취소를 신청할 수 없는 결제입니다.' }, { status: 400 });
    const { data: linkedOrder } = await db
      .from('inquiry_orders')
      .select('id')
      .eq('payment_id', paymentId)
      .maybeSingle();
    if (linkedOrder) return Response.json({ error: '이미 문의가 접수된 결제입니다.' }, { status: 400 });
  }

  let paymentSnapshot: Record<string, unknown> | null = null;
  if (isPaymentProblem && paymentId) {
    const { data: payment, error: paymentError } = await db
      .from('payments')
      .select(
        'id, buyer_user_id, order_no, payment_type, target_type, target_id, amount, currency, provider, payment_method, status, created_at, approved_at, refunded_at, refunded_amount',
      )
      .eq('id', paymentId)
      .maybeSingle();
    if (paymentError || !payment || payment.buyer_user_id !== currentStigma.stigmaId)
      return Response.json({ error: '선택한 결제 내역을 확인할 수 없습니다.' }, { status: 400 });
    paymentSnapshot = Object.fromEntries(Object.entries(payment).filter(([key]) => key !== 'buyer_user_id'));
  }

  if (isBug) {
    try {
      const url = new URL(pageUrl);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('invalid protocol');
    } catch {
      return Response.json({ error: '문제가 발생한 화면 주소를 확인해 주세요.' }, { status: 400 });
    }
  }
  const inquiryTitle = isBug || isPaymentProblem ? null : title;
  const generatedContent = isBug || isPaymentProblem ? actualBehavior : content;

  const { data: inquiry, error: inquiryError } = await db
    .from('inquiries')
    .insert({
      requester_stigma_id: currentStigma.stigmaId,
      inquiry_type: inquiryType,
      inquiry_subtype: inquirySubtype,
      title: inquiryTitle,
      content: generatedContent,
    })
    .select('id, inquiry_type, status, title, content, created_at')
    .single();
  if (inquiryError || !inquiry) return Response.json({ error: '문의 접수에 실패했습니다.' }, { status: 500 });

  if (isBug) {
    const { error: detailError } = await db.from('inquiry_bug_details').insert({
      inquiry_id: inquiry.id,
      page_url: pageUrl,
      occurred_at: occurredAt,
      attempted_action: attemptedAction,
      actual_behavior: actualBehavior,
      recurrence,
      error_message: errorMessage || null,
      browser_name: getText(environment.browserName) || null,
      browser_version: getText(environment.browserVersion) || null,
      operating_system: getText(environment.operatingSystem) || null,
      device_type: getText(environment.deviceType) || 'unknown',
      viewport_width: Number(environment.viewportWidth) || null,
      viewport_height: Number(environment.viewportHeight) || null,
      user_agent: getText(environment.userAgent) || null,
    });
    if (detailError) {
      await db.from('inquiries').delete().eq('id', inquiry.id);
      return Response.json({ error: '에러 / 버그 정보를 저장하지 못했습니다.' }, { status: 500 });
    }
  }

  if (isPaymentProblem) {
    const { error: detailError } = await db.from('inquiry_payment_details').insert({
      inquiry_id: inquiry.id,
      occurred_at: occurredAt,
      attempted_product: attemptedPaymentTarget?.label ?? null,
      attempted_payment_kind: attemptedPaymentTarget ? attemptedPayment.kind : null,
      attempted_payment_subtype: attemptedPaymentTarget ? attemptedPayment.subtype || null : null,
      attempted_membership_type: attemptedPaymentTarget ? attemptedPayment.membershipType || null : null,
      attempted_feature_keys: attemptedPaymentTarget ? attemptedPayment.featureKeys : null,
      attempted_site_id: attemptedPaymentTarget ? attemptedPayment.siteId || null : null,
      attempted_board_id: attemptedPaymentTarget ? attemptedPaymentTarget.boardId : null,
      attempted_series_id: attemptedPaymentTarget ? attemptedPayment.seriesId || null : null,
      attempted_post_id: attemptedPaymentTarget ? attemptedPayment.postId || null : null,
      attempted_amount: attemptedPaymentTarget ? attemptedPayment.amount : null,
      displayed_message: displayedMessage || null,
      actual_behavior: actualBehavior,
      payment_snapshot: paymentSnapshot,
    });
    if (detailError) {
      await db.from('inquiries').delete().eq('id', inquiry.id);
      return Response.json({ error: '결제 / 환불 문제 정보를 저장하지 못했습니다.' }, { status: 500 });
    }
  }

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
