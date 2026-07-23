import { normalizeText } from '@/lib/utils';
import { isMemberRestrictionType } from '@/lib/users/memberRestrictionMessages';
import {
  createMemberRestrictionMessage,
  loadMemberRestrictionMessages,
  loadStaffRestrictionMessageContext,
} from '@/lib/users/memberRestrictionMessagesServer';

type RouteContext = {
  params: Promise<{
    userId: string;
    restrictionType: string;
  }>;
};

type RequestBody = {
  siteName?: string | null;
  message?: string | null;
};

async function loadContext(request: Request, routeContext: RouteContext) {
  const { userId: userIdParam, restrictionType: restrictionTypeParam } = await routeContext.params;
  const requestUrl = new URL(request.url);
  const requestBody = request.method === 'POST' ? ((await request.clone().json()) as RequestBody) : null;
  const siteName = normalizeText(requestBody?.siteName ?? requestUrl.searchParams.get('siteName')).toLowerCase();
  const memberStigmaId = normalizeText(userIdParam);
  const restrictionType = normalizeText(restrictionTypeParam);

  if (!siteName || !memberStigmaId || !isMemberRestrictionType(restrictionType)) {
    throw new Error('소명 정보가 올바르지 않습니다.');
  }

  return loadStaffRestrictionMessageContext({ siteName, memberStigmaId, restrictionType });
}

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const context = await loadContext(request, routeContext);
    return Response.json(await loadMemberRestrictionMessages(context));
  } catch (unknownError) {
    return Response.json(
      { error: unknownError instanceof Error ? unknownError.message : '소명 메시지를 불러오지 못했습니다.' },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    const requestBody = (await request.clone().json()) as RequestBody;
    const context = await loadContext(request, routeContext);
    const message = normalizeText(requestBody.message);

    if (!message) {
      return Response.json({ error: '답변 내용을 입력해 주세요.' }, { status: 400 });
    }

    return Response.json(await createMemberRestrictionMessage({ context, message }));
  } catch (unknownError) {
    return Response.json(
      { error: unknownError instanceof Error ? unknownError.message : '답변을 보내지 못했습니다.' },
      { status: 400 },
    );
  }
}

