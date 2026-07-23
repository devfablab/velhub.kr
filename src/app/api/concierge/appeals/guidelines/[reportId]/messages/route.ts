import {
  loadGuidelineAppealContext,
  loadGuidelineAppealMessages,
} from '@/lib/reports/guidelineAppealServer';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

type RequestBody = {
  message?: string | null;
};

async function getAuthorizedContext(reportId: string, authUserId: string) {
  const context = await loadGuidelineAppealContext(reportId);

  if (context.authorUserId !== authUserId) {
    throw new Error('ACCESS_DENIED');
  }

  return context;
}

export async function GET(_request: Request, routeContext: RouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { reportId: reportIdParam } = await routeContext.params;
    const reportId = normalizeText(reportIdParam);

    if (!reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const context = await getAuthorizedContext(reportId, session.authUserId);
    const messages = await loadGuidelineAppealMessages(context);

    return Response.json({
      siteName: context.site.site_label || context.site.site_key,
      deletionMessage: context.deletionMessage,
      messages,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error && unknownError.message === 'ACCESS_DENIED') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '소명 메시지를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '소명 메시지를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const { reportId: reportIdParam } = await routeContext.params;
    const reportId = normalizeText(reportIdParam);
    const requestBody = (await request.json()) as RequestBody;
    const message = normalizeText(requestBody.message);

    if (!reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (!message) {
      return Response.json({ error: '소명 내용을 입력해 주세요.' }, { status: 400 });
    }

    const context = await getAuthorizedContext(reportId, session.authUserId);
    const insertResult = await getSupabaseAdmin()
      .from('report_guideline_messages')
      .insert({
        report_id: context.report.id,
        sender_user_id: session.authUserId,
        sender_type: 'appellant',
        message,
      })
      .select('id')
      .maybeSingle();

    if (insertResult.error || !insertResult.data) {
      return Response.json({ error: '소명 메시지를 보내지 못했습니다.' }, { status: 500 });
    }

    const messages = await loadGuidelineAppealMessages(context);

    return Response.json({
      ok: true,
      siteName: context.site.site_label || context.site.site_key,
      deletionMessage: context.deletionMessage,
      messages,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error && unknownError.message === 'ACCESS_DENIED') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '소명 메시지를 보내지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '소명 메시지를 보내지 못했습니다.' }, { status: 500 });
  }
}
