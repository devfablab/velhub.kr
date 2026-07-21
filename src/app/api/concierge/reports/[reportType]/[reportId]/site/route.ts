import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { forceTerminateSitePlan } from '@/lib/payments/forceTerminateSitePlan';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    reportType: string;
    reportId: string;
  }>;
};

type PatchBody = {
  action?: string | null;
};

type RightsReportRow = {
  id: string;
  target_type: string | null;
  site_id: string | null;
};

async function getOwnerAuthUserId(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const ownerResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('user_id')
    .eq('site_id', siteId)
    .eq('role', 'owner')
    .limit(1)
    .maybeSingle();

  if (ownerResult.error || !ownerResult.data?.user_id) {
    return null;
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('user_id')
    .eq('id', ownerResult.data.user_id)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data?.user_id) {
    return null;
  }

  return stigmaResult.data.user_id as string;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await verifySession({ siteId: null });

    if (session.case !== 'admin' || !session.authUserId) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const { reportType, reportId: reportIdParam } = await context.params;
    const reportId = normalizeText(reportIdParam);
    const body = (await request.json()) as PatchBody;
    const action = normalizeText(body.action);

    if (reportType !== 'rights' || !reportId) {
      return Response.json({ error: '권리침해 신고 정보가 올바르지 않습니다.' }, { status: 400 });
    }

    if (action !== 'block' && action !== 'unblock' && action !== 'close') {
      return Response.json({ error: '사이트 처리 방식이 올바르지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const reportResult = await supabaseAdmin
      .from('report_rights')
      .select('id, target_type, site_id')
      .eq('id', reportId)
      .maybeSingle();

    if (reportResult.error || !reportResult.data) {
      return Response.json({ error: '신고 내역을 찾을 수 없습니다.' }, { status: 404 });
    }

    const report = reportResult.data as RightsReportRow;

    if ((report.target_type !== 'site' && report.target_type !== 'board') || !report.site_id) {
      return Response.json({ error: '사이트 처리 대상이 아닌 신고입니다.' }, { status: 400 });
    }

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, is_blocked')
      .eq('id', report.site_id)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (action === 'block') {
      const messageCountResult = await supabaseAdmin
        .from('report_messages')
        .select('id', { count: 'exact', head: true })
        .eq('report_type', 'rights')
        .eq('report_id', report.id);

      if (messageCountResult.error) {
        return Response.json({ error: '메모 횟수를 확인하지 못했습니다.' }, { status: 500 });
      }

      if ((messageCountResult.count ?? 0) < 3) {
        return Response.json({ error: '메모를 3회 이상 보낸 뒤 사이트를 차단할 수 있습니다.' }, { status: 400 });
      }

      if (siteResult.data.is_blocked === true) {
        return Response.json({ error: '이미 차단된 사이트입니다.' }, { status: 409 });
      }

      const ownerAuthUserId = await getOwnerAuthUserId(report.site_id);

      if (!ownerAuthUserId) {
        return Response.json({ error: '사이트 운영자 계정을 찾을 수 없습니다.' }, { status: 404 });
      }

      const blockResult = await supabaseAdmin
        .from('rhizomes')
        .update({ is_blocked: true })
        .eq('id', report.site_id)
        .select('id')
        .maybeSingle();

      if (blockResult.error || !blockResult.data) {
        return Response.json({ error: '사이트를 차단하지 못했습니다.' }, { status: 500 });
      }

      const notificationResult = await supabaseAdmin.from('notifications').insert({
        user_id: ownerAuthUserId,
        send_user_id: session.authUserId,
        target_id: null,
        send_site_id: report.site_id,
        send_board_id: null,
        send_series_id: null,
        send_post_id: null,
        notification_type: NOTIFICATION_TYPE.CONCIERGE_SITE_BLOCKED,
        is_read: false,
      });

      if (notificationResult.error) {
        console.error('[concierge/reports/site] block notification error', notificationResult.error);
        await supabaseAdmin.from('rhizomes').update({ is_blocked: false }).eq('id', report.site_id);
        return Response.json({ error: '운영자에게 차단 알림을 보내지 못했습니다.' }, { status: 500 });
      }

      return Response.json({ ok: true, action, isBlocked: true });
    }

    if (siteResult.data.is_blocked !== true) {
      return Response.json({ error: '차단되지 않은 사이트입니다.' }, { status: 409 });
    }

    if (action === 'unblock') {
      const unblockResult = await supabaseAdmin
        .from('rhizomes')
        .update({ is_blocked: false })
        .eq('id', report.site_id)
        .select('id')
        .maybeSingle();

      if (unblockResult.error || !unblockResult.data) {
        return Response.json({ error: '사이트 차단을 해제하지 못했습니다.' }, { status: 500 });
      }

      return Response.json({ ok: true, action, isBlocked: false });
    }

    const terminationResult = await forceTerminateSitePlan(report.site_id);

    return Response.json({
      ok: true,
      action,
      isBlocked: true,
      termination: terminationResult,
    });
  } catch (unknownError) {
    console.error('[concierge/reports/site] unexpected error', unknownError);

    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트를 처리하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트를 처리하지 못했습니다.' }, { status: 500 });
  }
}
