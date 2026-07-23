import { normalizeText } from '@/lib/utils';
import { getSiteMembership, getStaffMembersAccess, isCommunityStaffMembership } from '@/lib/users/utils';
import { createMemberStatusNotification } from '@/lib/notifications/createMemberStatusNotification';
import { NOTIFICATION_TYPE } from '@/lib/notifications/types';
import { cancelMemberSiteSubscriptions } from '@/lib/payments/cancelMemberSiteSubscriptions';
import { isPlanBillingSubscriberStigma } from '@/lib/payments/planBillingSubscriber';
import { deleteMemberRestrictionMessages } from '@/lib/users/memberRestrictionMessagesServer';

type RouteContext = {
  params: Promise<{
    siteName: string;
    userId: string;
  }>;
};

type RequestBody = {
  reason?: string | null;
  blockTerm?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { siteName: rawSiteName, userId: rawUserId } = await context.params;
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(rawSiteName).toLowerCase();
    const userId = normalizeText(rawUserId);
    const reason = normalizeText(requestBody.reason);
    const normalizedBlockTerm = normalizeText(requestBody.blockTerm);
    const parsedBlockTerm = normalizedBlockTerm ? new Date(normalizedBlockTerm) : null;

    if (parsedBlockTerm && Number.isNaN(parsedBlockTerm.getTime())) {
      return Response.json({ error: '활동정지 해제 날짜가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: 'userId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!reason) {
      return Response.json({ error: '활동정지 사유를 입력해주세요.' }, { status: 400 });
    }

    const access = await getStaffMembersAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const membershipResult = await getSiteMembership(access.site.id, userId);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: membershipResult.status });
    }

    if (
      await isPlanBillingSubscriberStigma({
        supabaseAdmin: access.supabaseAdmin,
        siteId: access.site.id,
        stigmaId: membershipResult.membership.user_id,
      })
    ) {
      return Response.json({ error: '해당 멤버는 요금제를 월결제해주시는 분입니다.' }, { status: 403 });
    }

    if (await isCommunityStaffMembership(access.site.id, membershipResult.membership)) {
      return Response.json({ error: '운영자와 매니저는 활동정지할 수 없습니다.' }, { status: 403 });
    }

    if (membershipResult.membership.is_block) {
      return Response.json({ error: '이미 활동정지된 멤버입니다.' }, { status: 400 });
    }

    await cancelMemberSiteSubscriptions({
      supabaseAdmin: access.supabaseAdmin,
      siteId: access.site.id,
      memberStigmaId: membershipResult.membership.user_id,
      actionLabel: '활동정지',
    });

    const updateResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        is_block: true,
        blocked_at: new Date().toISOString(),
        block_count: Number(membershipResult.membership.block_count ?? 0) + 1,
        blocked_by: access.session.stigmaId,
        block_reason: reason,
        block_term: parsedBlockTerm?.toISOString() ?? null,
      })
      .eq('id', membershipResult.membership.id);

    if (updateResult.error) {
      return Response.json({ error: '활동정지 처리에 실패했습니다.' }, { status: 500 });
    }

    await deleteMemberRestrictionMessages({
      membershipIds: [membershipResult.membership.id],
      restrictionTypes: ['block'],
    });

    await createMemberStatusNotification({
      supabaseAdmin: access.supabaseAdmin,
      recipientStigmaId: membershipResult.membership.user_id,
      senderStigmaId: access.session.stigmaId,
      siteId: access.site.id,
      notificationType: NOTIFICATION_TYPE.SITE_MEMBER_BLOCKED,
    });

    return Response.json({
      ok: true,
      userId,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '활동정지 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '활동정지 처리에 실패했습니다.' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { siteName: rawSiteName, userId: rawUserId } = await context.params;

    const siteName = normalizeText(rawSiteName).toLowerCase();
    const userId = normalizeText(rawUserId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: 'userId가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getStaffMembersAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const membershipResult = await getSiteMembership(access.site.id, userId);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: membershipResult.status });
    }

    if (!membershipResult.membership.is_block) {
      return Response.json({ error: '활동정지된 멤버가 아닙니다.' }, { status: 400 });
    }

    const updateResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        is_block: false,
        blocked_at: null,
        blocked_by: null,
        block_reason: null,
        block_term: null,
      })
      .eq('id', membershipResult.membership.id);

    if (updateResult.error) {
      return Response.json({ error: '활동정지 해제에 실패했습니다.' }, { status: 500 });
    }

    await deleteMemberRestrictionMessages({
      membershipIds: [membershipResult.membership.id],
      restrictionTypes: ['block'],
    });

    await createMemberStatusNotification({
      supabaseAdmin: access.supabaseAdmin,
      recipientStigmaId: membershipResult.membership.user_id,
      senderStigmaId: access.session.stigmaId,
      siteId: access.site.id,
      notificationType: NOTIFICATION_TYPE.SITE_MEMBER_UNBLOCKED,
    });

    return Response.json({
      ok: true,
      userId,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '활동정지 해제에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '활동정지 해제에 실패했습니다.' }, { status: 500 });
  }
}
