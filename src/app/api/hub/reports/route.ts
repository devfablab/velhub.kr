import { loadConciergeReports } from '@/lib/reports/conciergeServer';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

function getRequestOrigin(request: Request, requestUrl: URL) {
  const forwardedProtocol = normalizeText(request.headers.get('x-forwarded-proto')).split(',')[0]?.trim();
  const forwardedHost = normalizeText(request.headers.get('x-forwarded-host')).split(',')[0]?.trim();
  const host = forwardedHost || normalizeText(request.headers.get('host'));

  if (!host) {
    return requestUrl.origin;
  }

  const protocol = forwardedProtocol || requestUrl.protocol.replace(':', '');

  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  try {
    const session = await verifySession({ siteId: null });

    if (!session.authUserId || !session.stigmaId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const requestUrl = new URL(request.url);
    const result = await loadConciergeReports({
      reportType: null,
      targetType: null,
      reporterUserId: session.stigmaId,
      page: 0,
      pageSize: 50,
      origin: getRequestOrigin(request, requestUrl),
    });

    return Response.json({
      items: result.items.map((item) => ({
        id: item.id,
        reportTypeLabel: item.reportTypeLabel,
        targetTypeLabel: item.targetTypeLabel,
        reportName: item.reportName,
        statusLabel: item.statusLabel,
        handlingResultLabel: item.handlingResultLabel,
        createdAt: item.createdAt,
        site: item.site ? { name: item.site.name, href: item.site.href } : null,
        board: item.board ? { name: item.board.name, href: item.board.href } : null,
        post: item.post ? { title: item.post.title, href: item.post.href } : null,
        comment: item.comment ? { content: item.comment.content } : null,
      })),
    });
  } catch (unknownError) {
    console.error('[hub/reports] unexpected error', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '신고 내역을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '신고 내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
