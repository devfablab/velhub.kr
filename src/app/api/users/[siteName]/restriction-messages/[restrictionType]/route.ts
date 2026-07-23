import { normalizeText } from '@/lib/utils';
import { isMemberRestrictionType } from '@/lib/users/memberRestrictionMessages';
import {
  createMemberRestrictionMessage,
  loadAppellantRestrictionMessageContext,
  loadMemberRestrictionMessages,
} from '@/lib/users/memberRestrictionMessagesServer';

type RouteContext = {
  params: Promise<{
    siteName: string;
    restrictionType: string;
  }>;
};

type RequestBody = {
  message?: string | null;
};

async function loadContext(routeContext: RouteContext) {
  const { siteName: siteNameParam, restrictionType: restrictionTypeParam } = await routeContext.params;
  const siteName = normalizeText(siteNameParam).toLowerCase();
  const restrictionType = normalizeText(restrictionTypeParam);

  if (!siteName || !isMemberRestrictionType(restrictionType)) {
    throw new Error('소명 정보가 올바르지 않습니다.');
  }

  return loadAppellantRestrictionMessageContext({ siteName, restrictionType });
}

export async function GET(_request: Request, routeContext: RouteContext) {
  try {
    const context = await loadContext(routeContext);
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
    const context = await loadContext(routeContext);
    const requestBody = (await request.json()) as RequestBody;
    const message = normalizeText(requestBody.message);

    if (!message) {
      return Response.json({ error: '소명 내용을 입력해 주세요.' }, { status: 400 });
    }

    return Response.json(await createMemberRestrictionMessage({ context, message }));
  } catch (unknownError) {
    return Response.json(
      { error: unknownError instanceof Error ? unknownError.message : '소명 메시지를 보내지 못했습니다.' },
      { status: 400 },
    );
  }
}

