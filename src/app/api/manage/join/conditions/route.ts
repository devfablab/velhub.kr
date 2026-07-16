import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  joinNotice?: string | null;
  joinQuestionStatus?: string | null;
  joinQuestions?: unknown;
  joinAcceptStatus?: string | null;
  joinAcceptStartDay?: string | null;
  joinAcceptEndDay?: string | null;
  joinType?: string | null;
  policyPost?: string | null;
  policyComment?: string | null;
};

type JoinQuestionRow = {
  id: string;
  type: 'subjective' | 'objective';
  question: string;
  allow_image: boolean;
  options: string[];
};

type MembershipRow = {
  rejected_at: string | null;
};

function normalizeQuestionText(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNoticeText(value: unknown) {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n')
    .trim();
}

function isValidDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeJoinQuestions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as JoinQuestionRow[];
  }

  const normalizedQuestions: JoinQuestionRow[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const rawItem = item as {
      id?: unknown;
      type?: unknown;
      question?: unknown;
      allow_image?: unknown;
      options?: unknown;
    };

    const id = typeof rawItem.id === 'string' ? normalizeText(rawItem.id) : '';
    const type = rawItem.type === 'objective' ? 'objective' : 'subjective';
    const question = normalizeQuestionText(rawItem.question);
    const options = Array.isArray(rawItem.options)
      ? rawItem.options.map((option) => normalizeQuestionText(option)).filter(Boolean)
      : [];
    const allowImage = type === 'subjective' ? Boolean(rawItem.allow_image) : false;

    if (!id || !question) {
      continue;
    }

    if (type === 'objective' && options.length === 0) {
      continue;
    }

    normalizedQuestions.push({
      id,
      type,
      question,
      allow_image: allowImage,
      options: type === 'objective' ? options : [],
    });
  }

  return normalizedQuestions;
}

async function getCommunityAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin.from('rhizomes').select('id, site_type').eq('site_key', siteName).maybeSingle();

  if (rhizome.error) {
    return {
      ok: false,
      status: 500,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (!rhizome.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

  return {
    ok: true,
    status: 200,
    rhizome: rhizome.data,
    session,
    supabaseAdmin,
  } as const;
}

async function getJoinManageAccess(siteName: string) {
  try {
    const access = await getCommunityManagerAccess(siteName);

    if (!access.actor.permissions.join_manage) {
      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }

    return {
      ok: true,
      status: 200,
      supabaseAdmin: access.supabaseAdmin,
      rhizome: access.rhizome,
      actor: access.actor,
    } as const;
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return {
        ok: false,
        status: 403,
        error: unknownError.message || '접근 권한이 없습니다.',
      } as const;
    }

    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getCommunityAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (access.rhizome.site_type !== 'community') {
      return Response.json({ error: '커뮤니티만 사용할 수 있습니다.' }, { status: 400 });
    }

    if (access.session.case !== 'guest-site') {
      const managerAccess = await getJoinManageAccess(siteName);

      if (!managerAccess.ok) {
        return Response.json({ error: managerAccess.error }, { status: managerAccess.status });
      }
    }

    const community = await access.supabaseAdmin
      .from('communities')
      .select(
        'site_id, join_notice, join_question_status, join_questions, join_accept_status, join_accept_start_day, join_accept_end_day, join_type, policy_post, policy_comment',
      )
      .eq('site_id', access.rhizome.id)
      .maybeSingle();

    if (community.error) {
      return Response.json({ error: '커뮤니티 가입 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!community.data) {
      return Response.json({ error: '커뮤니티 가입 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    let rejectedAt: string | null = null;

    if (access.session.case === 'guest-site' && access.session.stigmaId) {
      const membershipResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .select('rejected_at')
        .eq('site_id', access.rhizome.id)
        .eq('user_id', access.session.stigmaId)
        .maybeSingle();

      if (membershipResult.error) {
        return Response.json({ error: '커뮤니티 가입 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      const membership = (membershipResult.data ?? null) as MembershipRow | null;
      rejectedAt = membership?.rejected_at ?? null;
    }

    return Response.json({
      ok: true,
      siteType: access.rhizome.site_type,
      join: {
        join_notice: community.data.join_notice ?? '',
        join_question_status: normalizeText(community.data.join_question_status) || 'disabled',
        join_questions: normalizeJoinQuestions(community.data.join_questions),
        join_accept_status: normalizeText(community.data.join_accept_status) || 'enabled',
        join_accept_start_day: community.data.join_accept_start_day ?? null,
        join_accept_end_day: community.data.join_accept_end_day ?? null,
        join_type: normalizeText(community.data.join_type) || 'open',
        policy_post: normalizeText(community.data.policy_post) || 'comment_1',
        policy_comment: normalizeText(community.data.policy_comment) || 'estimate_0',
        rejected_at: rejectedAt,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '커뮤니티 가입 정보를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '커뮤니티 가입 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getCommunityAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    if (access.rhizome.site_type !== 'community') {
      return Response.json({ error: '커뮤니티만 사용할 수 있습니다.' }, { status: 400 });
    }

    const managerAccess = await getJoinManageAccess(siteName);

    if (!managerAccess.ok) {
      return Response.json({ error: managerAccess.error }, { status: managerAccess.status });
    }

    const joinNotice = normalizeNoticeText(requestBody.joinNotice);
    const joinQuestionStatus = normalizeText(requestBody.joinQuestionStatus) === 'enabled' ? 'enabled' : 'disabled';
    const joinQuestions = normalizeJoinQuestions(requestBody.joinQuestions);
    const rawJoinAcceptStatus = normalizeText(requestBody.joinAcceptStatus);
    const joinAcceptStatus =
      rawJoinAcceptStatus === 'disabled' || rawJoinAcceptStatus === 'period' ? rawJoinAcceptStatus : 'enabled';

    const joinType = normalizeText(requestBody.joinType) === 'invite' ? 'invite' : 'open';

    const rawPolicyPost = normalizeText(requestBody.policyPost);
    const policyPost =
      rawPolicyPost === 'comment_0' ||
      rawPolicyPost === 'comment_1' ||
      rawPolicyPost === 'comment_3' ||
      rawPolicyPost === 'comment_5'
        ? rawPolicyPost
        : 'comment_1';

    const rawPolicyComment = normalizeText(requestBody.policyComment);
    const policyComment =
      rawPolicyComment === 'estimate_0' ||
      rawPolicyComment === 'estimate_1' ||
      rawPolicyComment === 'estimate_3' ||
      rawPolicyComment === 'estimate_5'
        ? rawPolicyComment
        : 'estimate_0';

    let joinAcceptStartDay: string | null = null;
    let joinAcceptEndDay: string | null = null;

    if (joinAcceptStatus === 'period') {
      const startDay = normalizeText(requestBody.joinAcceptStartDay);
      const endDay = normalizeText(requestBody.joinAcceptEndDay);

      if (!isValidDateValue(startDay) || !isValidDateValue(endDay)) {
        return Response.json({ error: '기간 날짜가 올바르지 않습니다.' }, { status: 400 });
      }

      if (startDay > endDay) {
        return Response.json({ error: '종료일은 시작일보다 빠를 수 없습니다.' }, { status: 400 });
      }

      joinAcceptStartDay = startDay;
      joinAcceptEndDay = endDay;
    }

    if (joinQuestionStatus === 'enabled' && joinQuestions.length === 0) {
      return Response.json({ error: '가입 질문을 1개 이상 입력해주세요.' }, { status: 400 });
    }

    const hasInvalidObjectiveQuestion = joinQuestions.some(
      (question) => question.type === 'objective' && question.allow_image,
    );

    if (hasInvalidObjectiveQuestion) {
      return Response.json({ error: '객관식 질문은 이미지 답변을 받을 수 없습니다.' }, { status: 400 });
    }

    const updateCommunity = await managerAccess.supabaseAdmin
      .from('communities')
      .update({
        join_notice: joinNotice || null,
        join_question_status: joinQuestionStatus,
        join_questions: joinQuestionStatus === 'enabled' ? joinQuestions : [],
        join_accept_status: joinAcceptStatus,
        join_accept_start_day: joinAcceptStatus === 'period' ? joinAcceptStartDay : null,
        join_accept_end_day: joinAcceptStatus === 'period' ? joinAcceptEndDay : null,
        join_type: joinType,
        policy_post: policyPost,
        policy_comment: policyComment,
      })
      .eq('site_id', managerAccess.rhizome.id);

    if (updateCommunity.error) {
      return Response.json({ error: '커뮤니티 가입 정보 저장에 실패했습니다.' }, { status: 500 });
    }

    const refreshedCommunity = await managerAccess.supabaseAdmin
      .from('communities')
      .select(
        'site_id, join_notice, join_question_status, join_questions, join_accept_status, join_accept_start_day, join_accept_end_day, join_type, policy_post, policy_comment',
      )
      .eq('site_id', managerAccess.rhizome.id)
      .maybeSingle();

    if (refreshedCommunity.error) {
      return Response.json({ error: '저장된 커뮤니티 가입 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!refreshedCommunity.data) {
      return Response.json({ error: '저장된 커뮤니티 가입 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      ok: true,
      join: {
        join_notice: refreshedCommunity.data.join_notice ?? '',
        join_question_status: normalizeText(refreshedCommunity.data.join_question_status) || 'disabled',
        join_questions: normalizeJoinQuestions(refreshedCommunity.data.join_questions),
        join_accept_status: normalizeText(refreshedCommunity.data.join_accept_status) || 'enabled',
        join_accept_start_day: refreshedCommunity.data.join_accept_start_day ?? null,
        join_accept_end_day: refreshedCommunity.data.join_accept_end_day ?? null,
        join_type: normalizeText(refreshedCommunity.data.join_type) || 'open',
        policy_post: normalizeText(refreshedCommunity.data.policy_post) || 'comment_1',
        policy_comment: normalizeText(refreshedCommunity.data.policy_comment) || 'estimate_0',
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '커뮤니티 가입 정보 저장에 실패했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '커뮤니티 가입 정보 저장에 실패했습니다.' }, { status: 500 });
  }
}
