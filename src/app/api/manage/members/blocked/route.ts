import { normalizeText } from '@/lib/utils';
import {
  decryptNullable,
  getBlockedMemberships,
  getStaffMembersAccess,
  getStigmaDisplayName,
  getStigmasByIds,
} from '@/lib/users/utils';

type MembershipRow = {
  id: string;
  user_id: string;
  nickname: string | null;
  blocked_at: string | null;
  blocked_by?: string | null;
  block_reason?: string | null;
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

    const membershipResult = await getBlockedMemberships(access.site.id);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: 500 });
    }

    const userIds = membershipResult.memberships.map((membership) => membership.user_id);
    const blockedByIds = membershipResult.memberships
      .map((membership) => membership.blocked_by)
      .filter(Boolean) as string[];

    const stigmaResult = await getStigmasByIds([...new Set([...userIds, ...blockedByIds])]);

    if (!stigmaResult.ok) {
      return Response.json({ error: stigmaResult.error }, { status: 500 });
    }

    const stigmaMap = new Map(stigmaResult.stigmas.map((stigma) => [stigma.id, stigma]));

    return Response.json({
      ok: true,
      users: membershipResult.memberships.map((membership) => {
        const typedMembership = membership as MembershipRow;
        const blockedUser = stigmaMap.get(typedMembership.user_id) ?? null;
        const blockedByUser = typedMembership.blocked_by ? (stigmaMap.get(typedMembership.blocked_by) ?? null) : null;

        return {
          userId: typedMembership.user_id,
          nickname: normalizeText(typedMembership.nickname) || decryptNullable(blockedUser?.email ?? null) || '',
          blockReason: normalizeText(typedMembership.block_reason) || '',
          blockedAt: typedMembership.blocked_at,
          blockedBy: getStigmaDisplayName(blockedByUser),
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '활동정지 멤버 정보를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '활동정지 멤버 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
