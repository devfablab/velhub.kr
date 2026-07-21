import verifySession from '@/lib/session/verifySession';
import { isConciergeReportType } from '@/lib/reports/concierge';
import { isReportTargetType } from '@/lib/reports/guidelines';
import { loadConciergeReports } from '@/lib/reports/conciergeServer';
import { normalizeText } from '@/lib/utils';

const pageSize = 50;

export async function GET(request: Request) {
  try {
    const session = await verifySession({ siteId: null });

    if (session.case !== 'admin') {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const requestUrl = new URL(request.url);
    const reportTypeValue = normalizeText(requestUrl.searchParams.get('reportType'));
    const targetTypeValue = normalizeText(requestUrl.searchParams.get('targetType'));
    const reportType = isConciergeReportType(reportTypeValue) ? reportTypeValue : null;
    const targetType = isReportTargetType(targetTypeValue) ? targetTypeValue : null;
    const reporterUserId = normalizeText(requestUrl.searchParams.get('reporterUserId')) || null;
    const pageValue = Number(requestUrl.searchParams.get('page') ?? 0);
    const page = Number.isInteger(pageValue) && pageValue >= 0 ? pageValue : 0;

    if (reportTypeValue && !reportType) {
      return Response.json({ error: '신고 카테고리가 올바르지 않습니다.' }, { status: 400 });
    }

    if (targetTypeValue && !targetType) {
      return Response.json({ error: '신고 대상이 올바르지 않습니다.' }, { status: 400 });
    }

    const result = await loadConciergeReports({
      reportType,
      targetType,
      reporterUserId,
      page,
      pageSize,
    });

    return Response.json({
      ...result,
      page,
      pageSize,
    });
  } catch (unknownError) {
    console.error('[concierge/reports] unexpected error', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '신고 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '신고 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
