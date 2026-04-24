import { normalizeText } from '@/lib/utils';
import {
  decryptNullable,
  getBannedMemberships,
  getStaffMembersAccess,
  getStigmaDisplayName,
  getStigmasByIds,
} from '@/lib/users/utils';

type MembershipRow = {
  user_id: string;
  nickname: string | null;
  banned_at?: string | null;
  banned_by?: string | null;
  ban_reason?: string | null;
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

    const membershipResult = await getBannedMemberships(access.site.id);

    if (!membershipResult.ok) {
      return Response.json({ error: membershipResult.error }, { status: 500 });
    }

    const userIds = membershipResult.memberships.map((membership) => membership.user_id);
    const bannedByIds = membershipResult.memberships
      .map((membership) => membership.banned_by)
      .filter(Boolean) as string[];

    const stigmaResult = await getStigmasByIds([...new Set([...userIds, ...bannedByIds])]);

    if (!stigmaResult.ok) {
      return Response.json({ error: stigmaResult.error }, { status: 500 });
    }

    const stigmaMap = new Map(stigmaResult.stigmas.map((stigma) => [stigma.id, stigma]));

    return Response.json({
      ok: true,
      users: membershipResult.memberships.map((membership) => {
        const typedMembership = membership as MembershipRow;
        const bannedUser = stigmaMap.get(typedMembership.user_id) ?? null;
        const bannedByUser = typedMembership.banned_by ? (stigmaMap.get(typedMembership.banned_by) ?? null) : null;
        const email = decryptNullable(bannedUser?.email ?? null) || '';
        const nickname = normalizeText(typedMembership.nickname);
        const displayName = nickname ? `${email} (${nickname})` : email;

        return {
          userId: typedMembership.user_id,
          displayName,
          reason: normalizeText(typedMembership.ban_reason) || '',
          processedAt: typedMembership.banned_at ?? null,
          processedBy: getStigmaDisplayName(bannedByUser),
          type: '가입불가',
        };
      }),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '가입불가 멤버 정보를 불러오지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '가입불가 멤버 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
