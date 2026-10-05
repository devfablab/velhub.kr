import { getBlogAdIdentityStatus, getBlogAdSiteContext } from '@/lib/blogAds/server';
import { normalizeText } from '@/lib/utils';

export async function GET(request: Request) {
  try {
    const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();
    const context = await getBlogAdSiteContext(siteName);

    if (!context) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    if (!context.session.stigmaId || !['admin', 'staff', 'member'].includes(context.session.case)) {
      return Response.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const identity = await getBlogAdIdentityStatus(context.session.stigmaId);

    return Response.json({
      isEnabled: context.isEnabled,
      isEligible: context.isEligible,
      hasBeenOpenFor15Days: context.hasBeenOpenFor15Days,
      postCount: context.postCount,
      totalViews: context.totalViews,
      isOwner: context.isOwner,
      ...identity,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message || '광고 상태를 불러오지 못했습니다.'
            : '광고 상태를 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { siteName?: unknown; isEnabled?: unknown };
    const siteName = normalizeText(typeof body.siteName === 'string' ? body.siteName : '').toLowerCase();
    const context = await getBlogAdSiteContext(siteName);

    if (!context) return Response.json({ error: '블로그를 찾을 수 없습니다.' }, { status: 404 });
    if (!context.isOwner) return Response.json({ error: '블로그 운영자만 변경할 수 있습니다.' }, { status: 403 });
    if (typeof body.isEnabled !== 'boolean')
      return Response.json({ error: '광고 사용 상태가 유효하지 않습니다.' }, { status: 400 });

    const identity = await getBlogAdIdentityStatus(context.session.stigmaId);
    if (body.isEnabled && !context.isEligible) {
      return Response.json({ error: '광고 사용 조건을 충족하지 않았습니다.' }, { status: 400 });
    }
    if (body.isEnabled && !identity.isIdentityVerified) {
      return Response.json({ error: '광고를 설정하려면 본인인증이 필요합니다.' }, { status: 400 });
    }
    if (body.isEnabled && !identity.isAtLeastAge14) {
      return Response.json({ error: '만 14세 미만은 광고를 설정할 수 없습니다.' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const result = await context.supabaseAdmin.from('blog_ad_settings').upsert(
      {
        site_id: context.siteId,
        is_enabled: body.isEnabled,
        enabled_at: body.isEnabled ? now : null,
        updated_at: now,
      },
      { onConflict: 'site_id' },
    );

    if (result.error) return Response.json({ error: '광고 사용 상태를 변경하지 못했습니다.' }, { status: 500 });
    return Response.json({ ok: true, isEnabled: body.isEnabled });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message || '광고 사용 상태를 변경하지 못했습니다.'
            : '광고 사용 상태를 변경하지 못했습니다.',
      },
      { status: 500 },
    );
  }
}
