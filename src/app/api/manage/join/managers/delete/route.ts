import {
  buildCommunityManagerList,
  getCommunityManagerAccess,
  getCommunityManagerRows,
} from '@/lib/community-manager/utils';
import { normalizeText } from '@/lib/utils';

type RequestBody = {
  siteName?: string | null;
  manageRoleId?: string | null;
};

export async function DELETE(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const manageRoleId = normalizeText(requestBody.manageRoleId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!manageRoleId) {
      return Response.json({ error: 'manageRoleId가 유효하지 않습니다.' }, { status: 400 });
    }

    const access = await getCommunityManagerAccess(siteName);
    const managerRows = await getCommunityManagerRows(access);

    const targetRow = managerRows.find((row) => row.id === manageRoleId);

    if (!targetRow) {
      return Response.json({ error: '매니저 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const targetRole = normalizeText(targetRow.role);

    if (targetRole === 'board-general-manager') {
      return Response.json({ error: '개별 게시판 총괄 매니저는 이동으로 처리해야 합니다.' }, { status: 400 });
    }

    if (targetRole === 'community-manager') {
      if (!access.actor.canManageCommunityManager) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    } else {
      if (!access.actor.canManageBoardManager) {
        return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const deleteResult = await access.supabaseAdmin
      .from('community_manage_role')
      .delete()
      .eq('id', targetRow.id)
      .eq('community_id', access.community.id);

    if (deleteResult.error) {
      return Response.json({ error: '해임에 실패했습니다.' }, { status: 500 });
    }

    const updateMemberRoleResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        role: 'member',
      })
      .eq('id', targetRow.manager_id)
      .eq('site_id', access.rhizome.id)
      .neq('role', 'owner');

    if (updateMemberRoleResult.error) {
      return Response.json({ error: '멤버 역할 변경에 실패했습니다.' }, { status: 500 });
    }

    const managers = await buildCommunityManagerList(access);

    return Response.json({
      ok: true,
      managers,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      const errorMessage = unknownError.message || '해임에 실패했습니다.';
      const status =
        errorMessage === 'siteName이 유효하지 않습니다.' || errorMessage === 'manageRoleId가 유효하지 않습니다.'
          ? 400
          : errorMessage === '매니저 정보를 찾을 수 없습니다.' || errorMessage === '사이트를 찾을 수 없습니다.'
            ? 404
            : errorMessage === '접근 권한이 없습니다.'
              ? 403
              : 500;

      return Response.json({ error: errorMessage }, { status });
    }

    return Response.json({ error: '해임에 실패했습니다.' }, { status: 500 });
  }
}
