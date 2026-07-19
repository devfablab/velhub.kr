import { normalizeText } from '@/lib/utils';
import { getSiteMembership, getStaffMembersAccess, isCommunityStaffMembership } from '@/lib/users/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
    userId: string;
  }>;
};

type RequestBody = {
  lvId?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { siteName: rawSiteName, userId: rawUserId } = await context.params;
    const requestBody = (await request.json()) as RequestBody;

    const siteName = normalizeText(rawSiteName).toLowerCase();
    const userId = normalizeText(rawUserId);
    const lvId = normalizeText(requestBody.lvId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!userId) {
      return Response.json({ error: 'userId가 유효하지 않습니다.' }, { status: 400 });
    }

    if (!lvId) {
      return Response.json({ error: 'lvId가 유효하지 않습니다.' }, { status: 400 });
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
      return Response.json({ error: '운영자와 매니저의 등급은 변경할 수 없습니다.' }, { status: 403 });
    }

    const levelResult = await access.supabaseAdmin
      .from('community_levels')
      .select('id')
      .eq('site_id', access.site.id)
      .eq('id', lvId)
      .maybeSingle();

    if (levelResult.error || !levelResult.data) {
      return Response.json({ error: '등급 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    const updateResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        lv: lvId,
      })
      .eq('id', membershipResult.membership.id);

    if (updateResult.error) {
      return Response.json({ error: '등급 변경에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      userId,
      lvId,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '등급 변경에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '등급 변경에 실패했습니다.' }, { status: 500 });
  }
}
