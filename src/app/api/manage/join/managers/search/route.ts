import {
  buildCommunityManagerList,
  getActiveMembers,
  getBoardSummaries,
  getCommunityManagerAccess,
} from '@/lib/community/community-manager/utils';
import { normalizeText } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const keyword = normalizeText(requestUrl.searchParams.get('keyword')).toLowerCase();

    if (!keyword) {
      return Response.json({ error: '검색어를 입력해주세요.' }, { status: 400 });
    }

    const access = await getCommunityManagerAccess(siteName);
    const members = await getActiveMembers(access);
    const managerList = await buildCommunityManagerList(access);
    const boards = await getBoardSummaries(access);

    const managerMap = new Map<string, typeof managerList>(
      members.map((member) => [
        member.rhizomeStigmaId,
        managerList.filter((manager) => manager.rhizomeStigmaId === member.rhizomeStigmaId),
      ]),
    );

    const filteredMembers = members.filter((member) => {
      const nickname = normalizeText(member.nickname).toLowerCase();
      const email = normalizeText(member.email).toLowerCase();
      const userName = normalizeText(member.userName).toLowerCase();

      return nickname.includes(keyword) || email.includes(keyword) || userName.includes(keyword);
    });

    return Response.json({
      ok: true,
      permissions: access.actor.permissions,
      boards,
      members: filteredMembers.map((member) => ({
        rhizomeStigmaId: member.rhizomeStigmaId,
        userId: member.userId,
        nickname: member.nickname,
        email: member.email,
        userName: member.userName,
        manageRoles: managerMap.get(member.rhizomeStigmaId) ?? [],
      })),
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '멤버 검색에 실패했습니다.';
      const status =
        errorMessage === '검색어를 입력해주세요.'
          ? 400
          : errorMessage === '사이트를 찾을 수 없습니다.'
            ? 404
            : errorMessage === '접근 권한이 없습니다.'
              ? 403
              : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '멤버 검색에 실패했습니다.' }, { status: 500 });
  }
}
