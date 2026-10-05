import { BLOG_AD_REPORT_REASON_LABELS, getBlogAdSiteContext, isBlogAdReportReason } from '@/lib/blogAds/server';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ siteName: string; adId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteName: rawSiteName, adId } = await context.params;
    const body = (await request.json()) as { targetType?: unknown; reason?: unknown };
    const siteName = normalizeText(rawSiteName).toLowerCase();
    const targetType = body.targetType === 'ad' || body.targetType === 'postAd' ? body.targetType : null;
    if (!targetType || !isBlogAdReportReason(body.reason)) {
      return Response.json({ error: '신고 사유가 유효하지 않습니다.' }, { status: 400 });
    }

    const site = await getBlogAdSiteContext(siteName);
    if (!site || !site.isEnabled) return Response.json({ error: '광고를 찾을 수 없습니다.' }, { status: 404 });

    const target =
      targetType === 'ad'
        ? await site.supabaseAdmin
            .from('blog_ads')
            .select('id, post_id, product_name, thumbnail_image, link_url')
            .eq('id', adId)
            .eq('site_id', site.siteId)
            .is('deleted_at', null)
            .maybeSingle()
        : await site.supabaseAdmin
            .from('blog_post_ads')
            .select('id, post_id, ad_type, product_name, sponsor_name, thumbnail_image, link_url')
            .eq('id', adId)
            .eq('site_id', site.siteId)
            .is('deleted_at', null)
            .maybeSingle();

    if (target.error || !target.data) return Response.json({ error: '광고를 찾을 수 없습니다.' }, { status: 404 });

    const inserted = await site.supabaseAdmin
      .from('blog_ad_reports')
      .insert({
        blog_ad_id: targetType === 'ad' ? target.data.id : null,
        blog_post_ad_id: targetType === 'postAd' ? target.data.id : null,
        reason: body.reason,
        target_snapshot: {
          targetType,
          postId: target.data.post_id,
          name:
            targetType === 'ad'
              ? target.data.product_name
              : ((target.data as { sponsor_name?: string | null; product_name?: string | null }).sponsor_name ??
                target.data.product_name),
          thumbnailImage: target.data.thumbnail_image,
          linkUrl: target.data.link_url,
        },
      })
      .select('id')
      .single();

    if (inserted.error || !inserted.data)
      return Response.json({ error: '신고를 접수하지 못했습니다.' }, { status: 500 });

    const log = await site.supabaseAdmin.from('blog_ad_report_logs').insert({
      report_id: inserted.data.id,
      action: 'reported',
      detail: { reason: body.reason, title: BLOG_AD_REPORT_REASON_LABELS[body.reason].title },
    });
    if (log.error) return Response.json({ error: '신고를 접수하지 못했습니다.' }, { status: 500 });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '신고를 접수하지 못했습니다.' },
      { status: 500 },
    );
  }
}
