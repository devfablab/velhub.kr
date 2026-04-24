import { normalizeText } from '@/lib/utils';
import { getSiteMembership, getStaffMembersAccess } from '@/lib/users/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
    userId: string;
  }>;
};

export async function PATCH(_request: Request, context: RouteContext) {
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

    if (membershipResult.membership.banned_at) {
      return Response.json({ error: '이미 가입불가 처리된 멤버입니다.' }, { status: 400 });
    }

    const updateResult = await access.supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        banned_at: new Date().toISOString(),
        banned_by: access.session.stigmaId,
      })
      .eq('id', membershipResult.membership.id);

    if (updateResult.error) {
      return Response.json({ error: '가입불가 처리에 실패했습니다.' }, { status: 500 });
    }

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
