import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{ reportId: string }>;
};

type RequestBody = {
  siteName?: string | null;
  decision?: string | null;
};

type ReportRow = {
  id: string;
  target_type: 'post' | 'comment';
  site_id: string;
  post_id: string | null;
  comment_id: string | null;
  status: string;
  handling_result: string | null;
};

async function restoreContent(report: ReportRow) {
  const supabaseAdmin = getSupabaseAdmin();

  if (report.target_type === 'post' && report.post_id) {
    const restoreResult = await supabaseAdmin
      .from('posts')
      .update({
        is_closed: false,
        is_locked: false,
        closed_message: '소명됨',
        closed_by: null,
        closed_at: null,
      })
      .eq('id', report.post_id)
      .eq('site_id', report.site_id)
      .select('id')
      .maybeSingle();

    if (restoreResult.error || !restoreResult.data) {
      throw new Error('게시물을 복구하지 못했습니다.');
    }

    return;
  }

  if (report.target_type === 'comment' && report.comment_id) {
    const restoreResult = await supabaseAdmin
      .from('post_comments')
      .update({
        is_deleted: false,
        is_locked: false,
        deleted_message: '소명됨',
        deleted_by: null,
        deleted_at: null,
      })
      .eq('id', report.comment_id)
      .eq('site_id', report.site_id)
      .select('id')
      .maybeSingle();

    if (restoreResult.error || !restoreResult.data) {
      throw new Error('댓글을 복구하지 못했습니다.');
    }

    return;
  }

  throw new Error('복구할 콘텐츠 정보가 없습니다.');
}

export async function PATCH(request: Request, routeContext: RouteContext) {
  try {
    const { reportId: reportIdParam } = await routeContext.params;
    const reportId = normalizeText(reportIdParam);
    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const decision = normalizeText(requestBody.decision);

    if (!reportId || !siteName) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (decision !== 'keep_deleted' && decision !== 'restore') {
      return Response.json({ error: '최종 판단을 선택해 주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const siteResult = await supabaseAdmin.from('rhizomes').select('id').eq('site_key', siteName).maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({ siteId: siteResult.data.id });

    if (session.case !== 'staff' || !session.authUserId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const reportResult = await supabaseAdmin
      .from('report_guidelines')
      .select('id, target_type, site_id, post_id, comment_id, status, handling_result')
      .eq('id', reportId)
      .eq('site_id', siteResult.data.id)
      .maybeSingle();

    if (reportResult.error || !reportResult.data) {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const report = reportResult.data as ReportRow;

    if (report.target_type !== 'post' && report.target_type !== 'comment') {
      return Response.json({ error: '최종 판단할 수 없는 신고 대상입니다.' }, { status: 400 });
    }

    if (report.status !== 'completed') {
      return Response.json({ error: '삭제 처리가 완료된 신고가 아닙니다.' }, { status: 409 });
    }

    if (report.handling_result) {
      return Response.json({ error: '이미 최종 판단이 완료되었습니다.' }, { status: 409 });
    }

    if (decision === 'restore') {
      await restoreContent(report);
    }

    const now = new Date().toISOString();
    const updateResult = await supabaseAdmin
      .from('report_guidelines')
      .update({
        handling_result: decision,
        handler_user_id: session.authUserId,
        handled_at: now,
        updated_at: now,
      })
      .eq('id', report.id)
      .eq('site_id', report.site_id)
      .is('handling_result', null)
      .select('id, handling_result, handled_at')
      .maybeSingle();

    if (updateResult.error || !updateResult.data) {
      return Response.json({ error: '최종 판단을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true, report: updateResult.data });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '최종 판단을 저장하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '최종 판단을 저장하지 못했습니다.' }, { status: 500 });
  }
}
