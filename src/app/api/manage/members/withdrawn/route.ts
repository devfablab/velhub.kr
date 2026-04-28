import { getCommunityManagerAccess } from '@/lib/community-manager/utils';
import { normalizeText } from '@/lib/utils';
import {
  decryptNullable,
  getStaffMembersAccess,
  getStigmaDisplayName,
  getStigmasByIds,
  getWithdrawnMemberships,
} from '@/lib/users/utils';

type MembershipRow = {
  user_id: string;
  nickname: string | null;
  kicked_at?: string | null;
  kicked_by?: string | null;
  kick_reason?: string | null;
  withdrawn_at?: string | null;
  withdraw_reason?: string | null;
  cleared_at?: string | null;
  cleared_by?: string | null;
  clear_reason?: string | null;
};

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getStaffMembersAccess(siteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const managerAccess = await getCommunityManagerAccess(siteName);

    if (!managerAccess.actor.permissions.member_manage) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const membershipResult = await getWithdrawnMemberships(access.site.id);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: 500 });
    }

    const userIds = membershipResult.memberships.map((membership) => membership.user_id);
    const processedByIds = membershipResult.memberships
      .flatMap((membership) => [membership.kicked_by, membership.cleared_by])
      .filter(Boolean) as string[];

    const stigmaResult = await getStigmasByIds([...new Set([...userIds, ...processedByIds])]);

    if (!stigmaResult.ok) {
      return Response.json({ error: stigmaResult.error }, { status: 500 });
    }

    const stigmaMap = new Map(stigmaResult.stigmas.map((stigma) => [stigma.id, stigma]));

    return Response.json({
      ok: true,
      users: membershipResult.memberships.map((membership) => {
        const typedMembership = membership as MembershipRow;
        const targetUser = stigmaMap.get(typedMembership.user_id) ?? null;
        const email = decryptNullable(targetUser?.email ?? null) || '';
        const nickname = normalizeText(typedMembership.nickname);
        const emailWithNickname = nickname ? `${email} (${nickname})` : email;

        if (typedMembership.cleared_at) {
          const clearedByUser = typedMembership.cleared_by ? (stigmaMap.get(typedMembership.cleared_by) ?? null) : null;

          return {
            userId: typedMembership.user_id,
            displayName: emailWithNickname,
            reason: normalizeText(typedMembership.clear_reason) || '',
            processedAt: typedMembership.cleared_at,
            processedBy: getStigmaDisplayName(clearedByUser),
            type: '가입불가 해제됨',
          };
        }

        if (typedMembership.kicked_at) {
          const kickedByUser = typedMembership.kicked_by ? (stigmaMap.get(typedMembership.kicked_by) ?? null) : null;

          return {
            userId: typedMembership.user_id,
            displayName: emailWithNickname,
            reason: normalizeText(typedMembership.kick_reason) || '',
            processedAt: typedMembership.kicked_at,
            processedBy: getStigmaDisplayName(kickedByUser),
            type: '강제탈퇴',
          };
        }

        return {
          userId: typedMembership.user_id,
          displayName: emailWithNickname,
          reason: normalizeText(typedMembership.withdraw_reason) || '',
          processedAt: typedMembership.withdrawn_at ?? null,
          processedBy: nickname || email,
          type: '일반탈퇴',
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '탈퇴 멤버 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '탈퇴 멤버 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
