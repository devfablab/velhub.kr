import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { isConciergeReportType, type ConciergeReportType } from '@/lib/reports/concierge';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    reportType: string;
    reportId: string;
  }>;
};

type PostBody = {
  message?: string | null;
};

type ReportRow = {
  id: string;
  target_type: string | null;
  site_id: string | null;
  board_id: string | null;
};

const reportTableByType: Record<ConciergeReportType, string> = {
  guideline: 'report_guidelines',
  legal: 'report_legals',
  rights: 'report_rights',
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (session.case !== 'admin' || !session.authUserId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { reportType: reportTypeParam, reportId: reportIdParam } = await context.params;
    const reportType = normalizeText(reportTypeParam);
    const reportId = normalizeText(reportIdParam);
    const body = (await request.json()) as PostBody;
    const message = normalizeText(body.message);

    if (!isConciergeReportType(reportType) || !reportId) {
      return Response.json({ error: '신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (!message) {
      return Response.json({ error: '메모 내용을 입력해 주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const reportResult = await supabaseAdmin
      .from(reportTableByType[reportType])
      .select('id, target_type, site_id, board_id')
      .eq('id', reportId)
      .maybeSingle();

    if (reportResult.error || !reportResult.data) {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const report = reportResult.data as ReportRow;

    if ((report.target_type !== 'site' && report.target_type !== 'board') || !report.site_id) {
      return Response.json({ error: '메모를 보낼 수 없는 신고입니다.' }, { status: 400 });
    }

    const ownerResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('user_id')
      .eq('site_id', report.site_id)
      .eq('role', 'owner')
      .limit(1)
      .maybeSingle();

    if (ownerResult.error || !ownerResult.data?.user_id) {
      return Response.json({ error: '사이트 운영자를 찾을 수 없습니다.' }, { status: 404 });
    }

    const ownerStigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('user_id')
      .eq('id', ownerResult.data.user_id)
      .maybeSingle();

    if (ownerStigmaResult.error || !ownerStigmaResult.data?.user_id) {
      return Response.json({ error: '사이트 운영자 계정을 찾을 수 없습니다.' }, { status: 404 });
    }

    const recipientUserId = ownerStigmaResult.data.user_id as string;
    const insertResult = await supabaseAdmin
      .from('report_messages')
      .insert({
        report_type: reportType,
        report_id: report.id,
        target_type: report.target_type,
        site_id: report.site_id,
        board_id: report.board_id,
        sender_user_id: session.authUserId,
        recipient_user_id: recipientUserId,
        message,
      })
      .select('id, message, created_at')
      .single();

    if (insertResult.error || !insertResult.data) {
      console.error('[concierge/reports/messages] insert error', insertResult.error);
      return Response.json({ error: '메모를 저장하지 못했습니다.' }, { status: 500 });
    }

    const notificationResult = await supabaseAdmin.from('notifications').insert({
      user_id: recipientUserId,
      send_user_id: session.authUserId,
      target_id: insertResult.data.id,
      send_site_id: report.site_id,
      send_board_id: report.board_id,
      send_series_id: null,
      send_post_id: null,
      notification_type: NOTIFICATION_TYPE.CONCIERGE_REPORT_MESSAGE,
      is_read: false,
    });

    if (notificationResult.error) {
      console.error('[concierge/reports/messages] notification error', notificationResult.error);
      await supabaseAdmin.from('report_messages').delete().eq('id', insertResult.data.id);
      return Response.json({ error: '운영자에게 메시지를 보내지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ ok: true, message: insertResult.data });
  } catch (unknownError) {
    console.error('[concierge/reports/messages] unexpected error', unknownError);
    return Response.json({ error: '메모를 보내지 못했습니다.' }, { status: 500 });
  }
}
