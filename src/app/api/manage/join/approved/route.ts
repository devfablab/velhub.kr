import { decrypt } from '@/lib/encryption/decrypt';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  action?: 'approve' | 'reject' | null;
  userIds?: string[] | null;
};

type RhizomeRow = {
  id: string;
  site_key: string;
  site_type: string | null;
};

type CommunityRow = {
  join_questions: unknown;
};

type MembershipRow = {
  id: string;
  user_id: string;
  nickname: string | null;
  created_at: string;
  answered_questions: unknown;
  rejected_at: string | null;
  rejected_by: string | null;
  is_re_approval: boolean | null;
};

type StigmaRow = {
  id: string;
  email: string | null;
  user_name: string | null;
};

type LevelRow = {
  id: string;
  lv: number;
};

type JoinQuestionRow = {
  id?: string | null;
  type?: string | null;
  question?: string | null;
};

type AnsweredQuestionRow = {
  question_id?: string | null;
  questionId?: string | null;
  question?: string | null;
  type?: string | null;
  answer?: string | null;
  text?: string | null;
  value?: string | null;
  answer_text?: string | null;
  answers?: string[] | string | null;
  selected_option?: string | string[] | null;
  image_url?: string | null;
  imageUrl?: string | null;
  image_urls?: string[] | string | null;
  imageUrls?: string[] | string | null;
  answer_image?: string | null;
};

const COMMUNITY_ANSWER_BUCKET = 'community_answer';

function decryptNullable(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return null;
  }
}

function getDisplayName(userName: string | null | undefined, email: string | null | undefined) {
  return decryptNullable(userName) || decryptNullable(email) || '';
}

function getApplicantNickname(nickname: string | null | undefined, userName: string | null | undefined) {
  return normalizeText(nickname) || decryptNullable(userName) || '';
}

function getJoinQuestionMap(joinQuestions: unknown) {
  const questionRows = Array.isArray(joinQuestions) ? (joinQuestions as JoinQuestionRow[]) : [];

  return new Map(
    questionRows
      .filter((question) => normalizeText(question.id))
      .map((question) => [
        normalizeText(question.id),
        {
          id: normalizeText(question.id),
          question: normalizeText(question.question),
          type: normalizeText(question.type),
        },
      ]),
  );
}

function normalizeStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => (typeof item === 'string' ? normalizeText(item) : '')).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return [];
  }

  const normalizedValue = normalizeText(value);
  return normalizedValue ? [normalizedValue] : [];
}

function getCommunityAnswerImageUrl(value: string | null | undefined) {
  const storagePath = normalizeText(value);

  if (!storagePath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(COMMUNITY_ANSWER_BUCKET).getPublicUrl(storagePath);

  return publicUrl.data.publicUrl ?? '';
}

function normalizeAnsweredQuestions(
  answeredQuestions: unknown,
  questionMap: Map<string, { id: string; question: string; type: string }>,
) {
  if (!Array.isArray(answeredQuestions)) {
    return [];
  }

  return (answeredQuestions as AnsweredQuestionRow[]).map((answerRow) => {
    const questionId = normalizeText(answerRow.question_id ?? answerRow.questionId);
    const matchedQuestion = questionId ? questionMap.get(questionId) : null;

    const answers = [...normalizeStringArray(answerRow.answers), ...normalizeStringArray(answerRow.selected_option)];

    const rawImageValues = [
      ...normalizeStringArray(answerRow.image_urls),
      ...normalizeStringArray(answerRow.imageUrls),
      ...normalizeStringArray(answerRow.answer_image),
      ...normalizeStringArray(answerRow.image_url),
      ...normalizeStringArray(answerRow.imageUrl),
    ];

    const imageUrls = rawImageValues.map((imagePath) => getCommunityAnswerImageUrl(imagePath)).filter(Boolean);

    const answerText =
      normalizeText(answerRow.answer) ||
      normalizeText(answerRow.text) ||
      normalizeText(answerRow.value) ||
      normalizeText(answerRow.answer_text) ||
      '';

    return {
      questionId: questionId || null,
      question: normalizeText(answerRow.question) || matchedQuestion?.question || '',
      type: normalizeText(answerRow.type) || matchedQuestion?.type || '',
      answer: answerText,
      answers,
      imageUrl: imageUrls[0] ?? '',
      imageUrls,
    };
  });
}

async function getStaffAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  const rhizome = rhizomeResult.data as RhizomeRow;

  if (rhizome.site_type !== 'community') {
    return {
      ok: false,
      status: 403,
      error: '커뮤니티만 사용할 수 있습니다.',
    } as const;
  }

  const session = await verifySession({
    siteId: rhizome.id,
  });

  if (session.case !== 'staff' || !session.stigmaId) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    supabaseAdmin,
    rhizome,
    session,
  } as const;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getStaffAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const communityResult = await access.supabaseAdmin
      .from('communities')
      .select('join_questions')
      .eq('site_id', access.rhizome.id)
      .maybeSingle();

    if (communityResult.error) {
      return Response.json({ error: '가입 신청 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const community = (communityResult.data ?? null) as CommunityRow | null;
    const questionMap = getJoinQuestionMap(community?.join_questions ?? null);

    const membershipResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, user_id, nickname, created_at, answered_questions, rejected_at, rejected_by, is_re_approval')
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', false)
      .order('created_at', { ascending: false });

    if (membershipResult.error) {
      return Response.json({ error: '가입 신청 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const memberships = (membershipResult.data ?? []) as MembershipRow[];
    const userIds = [...new Set(memberships.map((membership) => membership.user_id))];
    const rejectedByIds = [
      ...new Set(memberships.map((membership) => normalizeText(membership.rejected_by)).filter(Boolean)),
    ];
    const stigmaIds = [...new Set([...userIds, ...rejectedByIds])];

    const stigmaResult =
      stigmaIds.length > 0
        ? await access.supabaseAdmin.from('stigmas').select('id, email, user_name').in('id', stigmaIds)
        : { data: [], error: null };

    if (stigmaResult.error) {
      return Response.json({ error: '가입 신청 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const stigmaMap = new Map(((stigmaResult.data ?? []) as StigmaRow[]).map((stigma) => [stigma.id, stigma]));

    return Response.json({
      ok: true,
      users: memberships.map((membership) => {
        const stigma = stigmaMap.get(membership.user_id) ?? null;
        const rejectedByStigma = membership.rejected_by ? (stigmaMap.get(membership.rejected_by) ?? null) : null;

        return {
          userId: membership.user_id,
          email: decryptNullable(stigma?.email) || '',
          userName: decryptNullable(stigma?.user_name) || '',
          nickname: getApplicantNickname(membership.nickname, stigma?.user_name),
          createdAt: membership.created_at,
          rejectedAt: membership.rejected_at,
          rejectedBy: getDisplayName(rejectedByStigma?.user_name, rejectedByStigma?.email),
          isReApproval: membership.is_re_approval === true,
          answeredQuestions: normalizeAnsweredQuestions(membership.answered_questions, questionMap),
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '가입 신청 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '가입 신청 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const action = requestBody.action ?? null;
    const userIds = Array.isArray(requestBody.userIds)
      ? requestBody.userIds.map((userId) => normalizeText(userId)).filter(Boolean)
      : [];

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (action !== 'approve' && action !== 'reject') {
      return Response.json({ error: 'action이 유효하지 않습니다.' }, { status: 400 });
    }

    if (userIds.length === 0) {
      return Response.json({ error: 'userIds가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getStaffAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const nowIsoString = new Date().toISOString();

    if (action === 'approve') {
      const levelOneResult = await access.supabaseAdmin
        .from('community_levels')
        .select('id, lv')
        .eq('site_id', access.rhizome.id)
        .eq('lv', 1)
        .maybeSingle();

      if (levelOneResult.error) {
        return Response.json({ error: '가입 승인 처리에 실패했습니다.' }, { status: 500 });
      }

      const levelOne = (levelOneResult.data ?? null) as LevelRow | null;

      const updateResult = await access.supabaseAdmin
        .from('rhizome_stigmas')
        .update({
          is_approval: true,
          approval_at: nowIsoString,
          rejected_at: null,
          rejected_by: null,
          lv: levelOne?.id ?? null,
        })
        .eq('site_id', access.rhizome.id)
        .eq('is_approval', false)
        .in('user_id', userIds);

      if (updateResult.error) {
        return Response.json({ error: '가입 승인 처리에 실패했습니다.' }, { status: 500 });
      }

      return Response.json({
        ok: true,
      });
    }

    const rejectResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        is_approval: false,
        rejected_at: nowIsoString,
        rejected_by: access.session.stigmaId,
        is_re_approval: false,
      })
      .eq('site_id', access.rhizome.id)
      .eq('is_approval', false)
      .in('user_id', userIds);

    if (rejectResult.error) {
      return Response.json({ error: '가입 거절 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '가입 신청 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '가입 신청 처리에 실패했습니다.' }, { status: 500 });
  }
}
