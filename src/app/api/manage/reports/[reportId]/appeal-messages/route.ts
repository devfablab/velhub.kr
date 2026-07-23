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
  siteName?: string | null;
  message?: string | null;
};

async function getAuthorizedContext(reportId: string, siteName: string) {
  const context = await loadGuidelineAppealContext(reportId);

  if (context.site.site_key.toLowerCase() !== siteName) {
    throw new Error('NOT_FOUND');
  }

  const session = await verifySession({ siteId: context.site.id });

  if (session.case !== 'staff' || !session.authUserId) {
    throw new Error('ACCESS_DENIED');
  }

  return { context, authUserId: session.authUserId };
}

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const { reportId: reportIdParam } = await routeContext.params;
    const reportId = normalizeText(reportIdParam);

    if (!siteName || !reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    const { context } = await getAuthorizedContext(reportId, siteName);
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

    if (unknownError instanceof Error && unknownError.message === 'NOT_FOUND') {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '소명 메시지를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '소명 메시지를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, routeContext: RouteContext) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const message = normalizeText(requestBody.message);
    const { reportId: reportIdParam } = await routeContext.params;
    const reportId = normalizeText(reportIdParam);

    if (!siteName || !reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (!message) {
      return Response.json({ error: '답변 내용을 입력해 주세요.' }, { status: 400 });
    }

    const { context, authUserId } = await getAuthorizedContext(reportId, siteName);
    const insertResult = await getSupabaseAdmin()
      .from('report_guideline_messages')
      .insert({
        report_id: context.report.id,
        sender_user_id: authUserId,
        sender_type: 'staff',
        message,
      })
      .select('id')
      .maybeSingle();

    if (insertResult.error || !insertResult.data) {
      return Response.json({ error: '답변을 보내지 못했습니다.' }, { status: 500 });
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

    if (unknownError instanceof Error && unknownError.message === 'NOT_FOUND') {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '답변을 보내지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '답변을 보내지 못했습니다.' }, { status: 500 });
  }
}
