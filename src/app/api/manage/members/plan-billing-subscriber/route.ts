import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import { getPlanBillingSubscriberStigmaId } from '@/lib/payments/planBillingSubscriber';
import { getStaffMembersAccess } from '@/lib/users/utils';
import { normalizeText } from '@/lib/utils';

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

    const userId = await getPlanBillingSubscriberStigmaId({
      supabaseAdmin: access.supabaseAdmin,
      siteId: access.site.id,
    });

    return Response.json({ ok: true, userId });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json(
        { error: unknownError.message || '요금제 결제 멤버를 확인하지 못했습니다.' },
        { status: 500 },
      );
    }

    return Response.json({ error: '요금제 결제 멤버를 확인하지 못했습니다.' }, { status: 500 });
  }
}
