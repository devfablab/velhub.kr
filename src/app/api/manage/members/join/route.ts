import verifySession from '@/lib/session/verifySession';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName: string | null;
  nickname?: string | null;
  answeredQuestions?: unknown;
};

type AnsweredQuestionRow = {
  question_id: string;
  type: 'subjective' | 'objective';
  question: string;
  answer_text: string | null;
  selected_option: string | null;
  answer_image: string | null;
};

type JoinQuestionRow = {
  id: string;
  type: 'subjective' | 'objective';
  question: string;
  allow_image: boolean;
  options: string[];
};

function normalizeAnsweredQuestions(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as AnsweredQuestionRow[];
  }

  const normalizedRows: AnsweredQuestionRow[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const rawItem = item as {
      question_id?: unknown;
      type?: unknown;
      question?: unknown;
      answer_text?: unknown;
      selected_option?: unknown;
      answer_image?: unknown;
    };

    const questionId = typeof rawItem.question_id === 'string' ? normalizeText(rawItem.question_id) : '';
    const type = rawItem.type === 'objective' ? 'objective' : 'subjective';
    const question = typeof rawItem.question === 'string' ? normalizeText(rawItem.question) : '';
    const answerText = typeof rawItem.answer_text === 'string' ? normalizeText(rawItem.answer_text) : '';
    const selectedOption = typeof rawItem.selected_option === 'string' ? normalizeText(rawItem.selected_option) : '';
    const answerImage = typeof rawItem.answer_image === 'string' ? normalizeText(rawItem.answer_image) : '';

    if (!questionId || !question) {
      continue;
    }

    normalizedRows.push({
      question_id: questionId,
      type,
      question,
      answer_text: type === 'subjective' ? answerText || null : null,
      selected_option: type === 'objective' ? selectedOption || null : null,
      answer_image: type === 'subjective' ? answerImage || null : null,
    });
  }

  return normalizedRows;
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
    const question = typeof rawItem.question === 'string' ? normalizeText(rawItem.question) : '';
    const allowImage = type === 'subjective' ? Boolean(rawItem.allow_image) : false;
    const options = Array.isArray(rawItem.options)
      ? rawItem.options.map((option) => (typeof option === 'string' ? normalizeText(option) : '')).filter(Boolean)
      : [];

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

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const nickname = normalizeText(requestBody.nickname);
    const answeredQuestions = normalizeAnsweredQuestions(requestBody.answeredQuestions);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_type, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (rhizome.data.site_type !== 'community') {
      return Response.json({ error: '커뮤니티에서만 가입할 수 있습니다.' }, { status: 403 });
    }

    if (rhizome.data.visibility_type !== 'public' || rhizome.data.is_shutdown !== false) {
      return Response.json({ error: '현재 가입할 수 없습니다.' }, { status: 403 });
    }

    const community = await supabaseAdmin
      .from('communities')
      .select(
        'join_type, join_question_status, join_questions, join_accept_status, join_accept_start_day, join_accept_end_day',
      )
      .eq('site_id', rhizome.data.id)
      .maybeSingle();

    if (community.error || !community.data) {
      return Response.json({ error: '가입 설정을 확인하지 못했습니다.' }, { status: 500 });
    }

    if (normalizeText(community.data.join_type) !== 'open') {
      return Response.json({ error: '초대가입만 가능한 커뮤니티입니다.' }, { status: 403 });
    }

    const joinAcceptStatus = normalizeText(community.data.join_accept_status) || 'enabled';

    if (joinAcceptStatus === 'disabled') {
      return Response.json({ error: '현재 가입을 받지 않습니다.' }, { status: 403 });
    }

    if (joinAcceptStatus === 'period') {
      const startDay = normalizeText(community.data.join_accept_start_day);
      const endDay = normalizeText(community.data.join_accept_end_day);
      const today = new Date();
      const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
        today.getDate(),
      ).padStart(2, '0')}`;

      if (startDay && endDay && todayValue >= startDay && todayValue <= endDay) {
        return Response.json({ error: '현재는 가입이 불가능한 기간입니다.' }, { status: 403 });
      }
    }

    const session = await verifySession({
      siteId: rhizome.data.id,
    });

    if (session.case !== 'guest-site' || !session.stigmaId) {
      return Response.json({ error: '가입할 수 없는 사용자입니다.' }, { status: 403 });
    }

    const stigma = await supabaseAdmin.from('stigmas').select('id, user_name').eq('id', session.stigmaId).maybeSingle();

    if (stigma.error || !stigma.data) {
      return Response.json({ error: '사용자 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const fallbackNickname = stigma.data.user_name ? decrypt(stigma.data.user_name as string) : '';
    const finalNickname = nickname || fallbackNickname || null;

    const existingRhizomeStigma = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id')
      .eq('site_id', rhizome.data.id)
      .eq('user_id', stigma.data.id)
      .maybeSingle();

    if (existingRhizomeStigma.error) {
      return Response.json({ error: '가입 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingRhizomeStigma.data) {
      return Response.json({ error: '이미 가입된 사용자입니다.' }, { status: 400 });
    }

    const joinQuestionStatus = normalizeText(community.data.join_question_status);
    const joinQuestions = normalizeJoinQuestions(community.data.join_questions);

    if (joinQuestionStatus === 'enabled') {
      if (joinQuestions.length === 0) {
        return Response.json({ error: '가입 질문 설정이 올바르지 않습니다.' }, { status: 400 });
      }

      if (answeredQuestions.length !== joinQuestions.length) {
        return Response.json({ error: '가입 질문 답변이 올바르지 않습니다.' }, { status: 400 });
      }

      for (const joinQuestion of joinQuestions) {
        const matchedAnswer = answeredQuestions.find((answer) => answer.question_id === joinQuestion.id);

        if (!matchedAnswer) {
          return Response.json({ error: '가입 질문 답변이 올바르지 않습니다.' }, { status: 400 });
        }

        if (matchedAnswer.type !== joinQuestion.type) {
          return Response.json({ error: '가입 질문 답변이 올바르지 않습니다.' }, { status: 400 });
        }

        if (matchedAnswer.question !== joinQuestion.question) {
          return Response.json({ error: '가입 질문 답변이 올바르지 않습니다.' }, { status: 400 });
        }

        if (joinQuestion.type === 'objective') {
          if (!matchedAnswer.selected_option) {
            return Response.json({ error: '객관식 답변을 선택해주세요.' }, { status: 400 });
          }

          if (!joinQuestion.options.includes(matchedAnswer.selected_option)) {
            return Response.json({ error: '객관식 답변이 올바르지 않습니다.' }, { status: 400 });
          }

          if (matchedAnswer.answer_text || matchedAnswer.answer_image) {
            return Response.json({ error: '객관식 답변이 올바르지 않습니다.' }, { status: 400 });
          }
        }

        if (joinQuestion.type === 'subjective') {
          if (joinQuestion.allow_image) {
            if (!matchedAnswer.answer_image) {
              return Response.json({ error: '이미지 답변을 입력해주세요.' }, { status: 400 });
            }

            if (matchedAnswer.answer_text || matchedAnswer.selected_option) {
              return Response.json({ error: '주관식 답변이 올바르지 않습니다.' }, { status: 400 });
            }
          } else {
            if (!matchedAnswer.answer_text) {
              return Response.json({ error: '주관식 답변을 입력해주세요.' }, { status: 400 });
            }

            if (matchedAnswer.selected_option || matchedAnswer.answer_image) {
              return Response.json({ error: '주관식 답변이 올바르지 않습니다.' }, { status: 400 });
            }
          }
        }
      }
    }

    const insertRhizomeStigma = await supabaseAdmin
      .from('rhizome_stigmas')
      .insert({
        user_id: stigma.data.id,
        site_id: rhizome.data.id,
        is_approval: false,
        blocked_at: null,
        block_count: 0,
        approval_at: null,
        is_block: false,
        role: 'member',
        nickname: finalNickname,
        post_count: 0,
        comment_count: 0,
        checkin_count: 0,
        last_visit_at: new Date().toISOString(),
        answered_questions: joinQuestionStatus === 'enabled' ? answeredQuestions : [],
        staff_note: null,
        handled_by: null,
        handled_at: null,
      })
      .select('id')
      .maybeSingle();

    if (insertRhizomeStigma.error || !insertRhizomeStigma.data) {
      return Response.json({ error: '가입에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      siteName: rhizome.data.site_key,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '가입에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '가입에 실패했습니다.' }, { status: 500 });
  }
}
