import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';

type RouteContext = {
  params: Promise<{
    planId: string;
  }>;
};

type RequestBody = {
  isEditorImage: boolean | null;
  isMember: boolean | null;
  isBoardAttachment: boolean | null;
  countSubpage: number | string | null;
  countBoard: number | string | null;
  countUser: number | string | null;
};

function normalizeCount(value: number | string | null | undefined) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : NaN;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.replaceAll(',', '').trim();

    if (!normalizedValue) {
      return NaN;
    }

    return Number(normalizedValue);
  }

  return NaN;
}

async function verifyAdmin() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims) {
    return {
      ok: false as const,
      status: 401,
      error: '로그인이 필요합니다.',
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const stigma = await supabaseAdmin.from('stigmas').select('role').eq('user_id', sessionClaims.userId).maybeSingle();

  if (stigma.error || !stigma.data) {
    return {
      ok: false as const,
      status: 500,
      error: '사용자 정보를 확인하지 못했습니다.',
    };
  }

  if (stigma.data.role !== 'admin') {
    return {
      ok: false as const,
      status: 403,
      error: '접근 권한이 없습니다.',
    };
  }

  return {
    ok: true as const,
  };
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;

    if (!planId || typeof planId !== 'string') {
      return Response.json({ error: 'planId가 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const feature = await supabaseAdmin
      .from('plan_features')
      .select('id, is_editor_image, is_member, is_board_attachment, count_subpage, count_board, count_user, plan_id')
      .eq('plan_id', planId)
      .maybeSingle();

    if (feature.error) {
      return Response.json({ error: '요금제 기능 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    if (!feature.data) {
      return Response.json({ error: '요금제 기능을 찾을 수 없습니다.' }, { status: 404 });
    }

    return Response.json({
      feature: feature.data,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '요금제 기능 정보를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '요금제 기능 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await verifyAdmin();

    if (!admin.ok) {
      return Response.json({ error: admin.error }, { status: admin.status });
    }

    const { planId } = await context.params;

    if (!planId || typeof planId !== 'string') {
      return Response.json({ error: 'planId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const isEditorImage = requestBody.isEditorImage;
    const isMember = requestBody.isMember;
    const isBoardAttachment = requestBody.isBoardAttachment;
    const countSubpage = normalizeCount(requestBody.countSubpage);
    const countBoard = normalizeCount(requestBody.countBoard);
    const countUser = normalizeCount(requestBody.countUser);

    if (typeof isEditorImage !== 'boolean') {
      return Response.json({ error: '에디터 이미지 삽입 가능 여부를 선택해주세요.' }, { status: 400 });
    }

    if (typeof isMember !== 'boolean') {
      return Response.json({ error: '멤버 추가 가능 여부를 선택해주세요.' }, { status: 400 });
    }

    if (typeof isBoardAttachment !== 'boolean') {
      return Response.json({ error: '게시판 파일첨부 가능 여부를 선택해주세요.' }, { status: 400 });
    }

    if (!Number.isFinite(countSubpage)) {
      return Response.json({ error: '추가 가능한 페이지수를 입력해주세요.' }, { status: 400 });
    }

    if (!Number.isFinite(countBoard)) {
      return Response.json({ error: '추가 가능한 게시판수를 입력해주세요.' }, { status: 400 });
    }

    if (!Number.isFinite(countUser)) {
      return Response.json({ error: '추가 가능한 회원수를 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const plan = await supabaseAdmin.from('plans').select('id').eq('id', planId).maybeSingle();

    if (plan.error) {
      return Response.json({ error: '요금제 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!plan.data) {
      return Response.json({ error: '요금제를 찾을 수 없습니다.' }, { status: 404 });
    }

    const existingFeature = await supabaseAdmin.from('plan_features').select('id').eq('plan_id', planId).maybeSingle();

    if (existingFeature.error) {
      return Response.json({ error: '요금제 기능 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (existingFeature.data) {
      return Response.json({ error: '이미 요금제 기능이 등록되어 있습니다.' }, { status: 400 });
    }

    const insertFeature = await supabaseAdmin
      .from('plan_features')
      .insert({
        is_editor_image: isEditorImage,
        is_member: isMember,
        is_board_attachment: isBoardAttachment,
        count_subpage: countSubpage,
        count_board: countBoard,
        count_user: countUser,
        plan_id: planId,
      })
      .select('id')
      .maybeSingle();

    if (insertFeature.error || !insertFeature.data) {
      return Response.json({ error: '요금제 기능 추가에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      featureId: insertFeature.data.id,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '요금제 기능 추가에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '요금제 기능 추가에 실패했습니다.' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const admin = await verifyAdmin();

    if (!admin.ok) {
      return Response.json({ error: admin.error }, { status: admin.status });
    }

    const { planId } = await context.params;

    if (!planId || typeof planId !== 'string') {
      return Response.json({ error: 'planId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const isEditorImage = requestBody.isEditorImage;
    const isMember = requestBody.isMember;
    const isBoardAttachment = requestBody.isBoardAttachment;
    const countSubpage = normalizeCount(requestBody.countSubpage);
    const countBoard = normalizeCount(requestBody.countBoard);
    const countUser = normalizeCount(requestBody.countUser);

    if (typeof isEditorImage !== 'boolean') {
      return Response.json({ error: '에디터 이미지 삽입 가능 여부를 선택해주세요.' }, { status: 400 });
    }

    if (typeof isMember !== 'boolean') {
      return Response.json({ error: '멤버 추가 가능 여부를 선택해주세요.' }, { status: 400 });
    }

    if (typeof isBoardAttachment !== 'boolean') {
      return Response.json({ error: '게시판 파일첨부 가능 여부를 선택해주세요.' }, { status: 400 });
    }

    if (!Number.isFinite(countSubpage)) {
      return Response.json({ error: '추가 가능한 페이지수를 입력해주세요.' }, { status: 400 });
    }

    if (!Number.isFinite(countBoard)) {
      return Response.json({ error: '추가 가능한 게시판수를 입력해주세요.' }, { status: 400 });
    }

    if (!Number.isFinite(countUser)) {
      return Response.json({ error: '추가 가능한 회원수를 입력해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const feature = await supabaseAdmin.from('plan_features').select('id').eq('plan_id', planId).maybeSingle();

    if (feature.error) {
      return Response.json({ error: '요금제 기능 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    if (!feature.data) {
      return Response.json({ error: '요금제 기능을 찾을 수 없습니다.' }, { status: 404 });
    }

    const updateFeature = await supabaseAdmin
      .from('plan_features')
      .update({
        is_editor_image: isEditorImage,
        is_member: isMember,
        is_board_attachment: isBoardAttachment,
        count_subpage: countSubpage,
        count_board: countBoard,
        count_user: countUser,
      })
      .eq('plan_id', planId);

    if (updateFeature.error) {
      return Response.json({ error: '요금제 기능 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '요금제 기능 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '요금제 기능 수정에 실패했습니다.' }, { status: 500 });
  }
}
