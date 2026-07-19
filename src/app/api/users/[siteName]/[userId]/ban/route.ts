import { normalizeText } from '@/lib/utils';
import { getSiteMembership, getStaffMembersAccess, isCommunityStaffMembership } from '@/lib/users/utils';
import { createMemberStatusNotification } from '@/lib/notifications/createMemberStatusNotification';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { deleteMemberContents } from '@/lib/community/community-member/deleteMemberContents';
import { cancelMemberSiteSubscriptions } from '@/lib/payments/cancelMemberSiteSubscriptions';

type RouteContext = {
  params: Promise<{
    siteName: string;
    userId: string;
  }>;
};

type PatchRequestBody = {
  reason?: string | null;
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

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: 'userId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!reason) {
      return Response.json({ error: '가입불가 사유를 입력해주세요.' }, { status: 400 });
    }

    const access = await getStaffMembersAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const membershipResult = await getSiteMembership(access.site.id, userId);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: membershipResult.status });
    }

    if (await isCommunityStaffMembership(access.site.id, membershipResult.membership)) {
      return Response.json({ error: '운영자와 매니저는 가입불가 처리할 수 없습니다.' }, { status: 403 });
    }

    if (membershipResult.membership.banned_at) {
      return Response.json({ error: '이미 가입불가 처리된 멤버입니다.' }, { status: 400 });
    }

    await cancelMemberSiteSubscriptions({
      supabaseAdmin: access.supabaseAdmin,
      siteId: access.site.id,
      memberStigmaId: membershipResult.membership.user_id,
      actionLabel: '가입불가',
    });

    const updateResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        banned_at: new Date().toISOString(),
        banned_by: access.session.stigmaId,
        ban_reason: reason,
        is_block: false,
        blocked_at: null,
        blocked_by: null,
        block_reason: null,
        kicked_at: null,
        kicked_by: null,
        kick_reason: null,
        cleared_at: null,
        cleared_by: null,
        clear_reason: null,
      })
      .eq('id', membershipResult.membership.id);

    if (updateResult.error) {
      return Response.json({ error: '가입불가 처리에 실패했습니다.' }, { status: 500 });
    }

    if (!access.session.stigmaId) {
      return Response.json({ error: '처리한 매니저 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    await deleteMemberContents({
      supabaseAdmin: access.supabaseAdmin,
      siteId: access.site.id,
      memberStigmaId: membershipResult.membership.user_id,
      managerStigmaId: access.session.stigmaId,
      closedMessage: '가입 불가로 인한 삭제',
    });

    await createMemberStatusNotification({
      supabaseAdmin: access.supabaseAdmin,
      recipientStigmaId: membershipResult.membership.user_id,
      senderStigmaId: access.session.stigmaId,
      siteId: access.site.id,
      notificationType: NOTIFICATION_TYPE.COMMUNITY_MEMBER_BANNED,
    });

    return Response.json({
      ok: true,
      userId,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '가입불가 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '가입불가 처리에 실패했습니다.' }, { status: 500 });
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
      return Response.json({ error: '가입불가 해제 사유를 입력해주세요.' }, { status: 400 });
    }

    const access = await getStaffMembersAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const membershipResult = await getSiteMembership(access.site.id, userId);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: membershipResult.status });
    }

    if (!membershipResult.membership.banned_at) {
      return Response.json({ error: '가입불가된 멤버가 아닙니다.' }, { status: 400 });
    }

    const updateResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        banned_at: null,
        banned_by: null,
        ban_reason: null,
        cleared_at: new Date().toISOString(),
        cleared_by: access.session.stigmaId,
        clear_reason: reason,
        is_rejoin: true,
      })
      .eq('id', membershipResult.membership.id);

    if (updateResult.error) {
      return Response.json({ error: '가입불가 해제에 실패했습니다.' }, { status: 500 });
    }

    await createMemberStatusNotification({
      supabaseAdmin: access.supabaseAdmin,
      recipientStigmaId: membershipResult.membership.user_id,
      senderStigmaId: access.session.stigmaId,
      siteId: access.site.id,
      notificationType: NOTIFICATION_TYPE.COMMUNITY_MEMBER_BAN_REVOKED,
    });

    return Response.json({
      ok: true,
      userId,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '가입불가 해제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '가입불가 해제에 실패했습니다.' }, { status: 500 });
  }
}
