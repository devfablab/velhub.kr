import { normalizeText } from '@/lib/utils';
import { getSiteMembership, getStaffMembersAccess } from '@/lib/users/utils';
import { createMemberStatusNotification } from '@/lib/notifications/createMemberStatusNotification';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { deleteMemberContents } from '@/lib/community/community-member/deleteMemberContents';

type RouteContext = {
  params: Promise<{
    siteName: string;
    userId: string;
  }>;
};

type PatchRequestBody = {
  reason?: string | null;
  kickTerm?: string | null;
};

type DeleteRequestBody = {
  reason?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { siteName: rawSiteName, userId: rawUserId } = await context.params;
    const requestBody = (await request.json()) as PatchRequestBody;

    const siteName = normalizeText(rawSiteName).toLowerCase();
    const userId = normalizeText(rawUserId);
    const reason = normalizeText(requestBody.reason);

    const normalizedKickTerm = normalizeText(requestBody.kickTerm);
    const parsedKickTerm = normalizedKickTerm ? new Date(normalizedKickTerm) : null;

    if (parsedKickTerm && Number.isNaN(parsedKickTerm.getTime())) {
      return Response.json({ error: '재가입 가능 날짜가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: 'userId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!reason) {
      return Response.json({ error: '강제탈퇴 사유를 입력해주세요.' }, { status: 400 });
    }

    const access = await getStaffMembersAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const membershipResult = await getSiteMembership(access.site.id, userId);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: membershipResult.status });
    }

    if (membershipResult.membership.kicked_at) {
      return Response.json({ error: '이미 강제탈퇴 처리된 멤버입니다.' }, { status: 400 });
    }

    const updateResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        kicked_at: new Date().toISOString(),
        kicked_by: access.session.stigmaId,
        kick_reason: reason,
        kick_term: parsedKickTerm?.toISOString() ?? null,
        cleared_at: null,
        cleared_by: null,
        clear_reason: null,
      })
      .eq('id', membershipResult.membership.id);

    if (updateResult.error) {
      return Response.json({ error: '강제탈퇴 처리에 실패했습니다.' }, { status: 500 });
    }

    if (!access.session.stigmaId) {
      return Response.json({ error: '처리한 매니저 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    await deleteMemberContents({
      supabaseAdmin: access.supabaseAdmin,
      siteId: access.site.id,
      memberStigmaId: membershipResult.membership.user_id,
      managerStigmaId: access.session.stigmaId,
      closedMessage: '강제 탈퇴로 인한 삭제',
    });

    await createMemberStatusNotification({
      supabaseAdmin: access.supabaseAdmin,
      recipientStigmaId: membershipResult.membership.user_id,
      senderStigmaId: access.session.stigmaId,
      siteId: access.site.id,
      notificationType: NOTIFICATION_TYPE.COMMUNITY_MEMBER_KICKED,
    });

    return Response.json({
      ok: true,
      userId,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '강제탈퇴 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '강제탈퇴 처리에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { siteName: rawSiteName, userId: rawUserId } = await context.params;
    const requestBody = (await request.json()) as DeleteRequestBody;

    const siteName = normalizeText(rawSiteName).toLowerCase();
    const userId = normalizeText(rawUserId);
    const reason = normalizeText(requestBody.reason);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: 'userId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!reason) {
      return Response.json({ error: '강제탈퇴 해제 사유를 입력해주세요.' }, { status: 400 });
    }

    const access = await getStaffMembersAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const membershipResult = await getSiteMembership(access.site.id, userId);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: membershipResult.status });
    }

    if (!membershipResult.membership.kicked_at) {
      return Response.json({ error: '강제탈퇴된 멤버가 아닙니다.' }, { status: 400 });
    }

    const updateResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        kicked_at: null,
        kicked_by: null,
        kick_reason: null,
        kick_term: null,
        cleared_at: new Date().toISOString(),
        cleared_by: access.session.stigmaId,
        clear_reason: reason,
        is_rejoin: true,
      })
      .eq('id', membershipResult.membership.id);

    if (updateResult.error) {
      return Response.json({ error: '강제탈퇴 해제에 실패했습니다.' }, { status: 500 });
    }

    await createMemberStatusNotification({
      supabaseAdmin: access.supabaseAdmin,
      recipientStigmaId: membershipResult.membership.user_id,
      senderStigmaId: access.session.stigmaId,
      siteId: access.site.id,
      notificationType: NOTIFICATION_TYPE.COMMUNITY_MEMBER_KICK_REVOKED,
    });

    return Response.json({
      ok: true,
      userId,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '강제탈퇴 해제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '강제탈퇴 해제에 실패했습니다.' }, { status: 500 });
  }
}
