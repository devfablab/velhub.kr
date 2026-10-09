import {
  BLOG_AD_REPORT_REASON_LABELS,
  MAX_BLOG_AD_ITEMS,
  getBlogAdIdentityStatus,
  getBlogAdPublicImageUrl,
  getBlogAdReportCorrection,
  getBlogAdSiteContext,
  isImmediateBlogAdReport,
  isValidBlogAdUrl,
} from '@/lib/blogAds/server';
import { hasMultipleBlogAdLinkDomains } from '@/lib/blogAds/validation';
import { normalizeText } from '@/lib/utils';

type Item = { id?: unknown; productName?: unknown; thumbnailImage?: unknown; linkUrl?: unknown };

function normalizeItem(value: Item) {
  return {
    id: normalizeText(typeof value.id === 'string' ? value.id : ''),
    productName: normalizeText(typeof value.productName === 'string' ? value.productName : ''),
    thumbnailImage: normalizeText(typeof value.thumbnailImage === 'string' ? value.thumbnailImage : ''),
    linkUrl: normalizeText(typeof value.linkUrl === 'string' ? value.linkUrl : ''),
  };
}

async function getOwnerContext(siteName: string) {
  const context = await getBlogAdSiteContext(siteName);
  if (!context) throw new Error('블로그를 찾을 수 없습니다.');
  if (!context.isOwner) throw new Error('블로그 운영자만 관리할 수 있습니다.');
  return context;
}

export async function GET(request: Request) {
  try {
    const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();
    const context = await getOwnerContext(siteName);
    const result = await context.supabaseAdmin
      .from('blog_ads')
      .select('id, product_name, shop_name, thumbnail_image, link_url, sort_order')
      .eq('site_id', context.siteId)
      .is('post_id', null)
      .is('deleted_at', null)
      .order('sort_order');
    if (result.error) return Response.json({ error: '기본 광고를 불러오지 못했습니다.' }, { status: 500 });
    const ads = (result.data ?? []).map((ad) => {
      const thumbnailUrl = getBlogAdPublicImageUrl(ad.thumbnail_image);
      if (!thumbnailUrl) throw new Error('상품 썸네일 정보가 없습니다.');
      return { ...ad, thumbnail_url: thumbnailUrl };
    });
    const reportsResult = ads.length
      ? await context.supabaseAdmin
          .from('blog_ad_reports')
          .select('id, blog_ad_id, reason, status, created_at')
          .in(
            'blog_ad_id',
            ads.map((ad) => ad.id),
          )
          .in('status', ['pending', 'issue'])
          .order('created_at', { ascending: false })
      : { data: [], error: null };
    if (reportsResult.error) throw new Error('광고 신고 상태를 불러오지 못했습니다.');
    const reportByAdId = new Map<
      string,
      { status: 'pending' | 'issue'; reasonDescription: string; isImmediatelyStopped: boolean }
    >();
    for (const report of reportsResult.data ?? []) {
      if (!report.blog_ad_id || reportByAdId.has(report.blog_ad_id)) continue;
      const isImmediatelyStopped =
        report.status === 'pending' &&
        isImmediateBlogAdReport(report.reason as keyof typeof BLOG_AD_REPORT_REASON_LABELS);
      // 일반 신고는 Velman의 판단 전까지 운영자 화면에 노출하지 않는다.
      if (report.status !== 'issue' && !isImmediatelyStopped) continue;
      const reason = BLOG_AD_REPORT_REASON_LABELS[report.reason as keyof typeof BLOG_AD_REPORT_REASON_LABELS];
      reportByAdId.set(report.blog_ad_id, {
        status: report.status as 'pending' | 'issue',
        reasonDescription: reason?.description ?? '신고 사유를 확인해주세요.',
        isImmediatelyStopped,
      });
    }
    return Response.json({
      ads: ads.map((ad) => ({
        ...ad,
        report: reportByAdId.get(ad.id) ?? null,
      })),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '기본 광고를 불러오지 못했습니다.' },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { siteName?: unknown; shopName?: unknown; items?: unknown };
    const siteName = normalizeText(typeof body.siteName === 'string' ? body.siteName : '').toLowerCase();
    const context = await getOwnerContext(siteName);
    const shopName = normalizeText(typeof body.shopName === 'string' ? body.shopName : '');
    if (!context.isEnabled || !context.isEligible)
      return Response.json({ error: '광고 사용 조건을 충족하지 않았습니다.' }, { status: 400 });
    const identity = await getBlogAdIdentityStatus(context.session.stigmaId);
    if (!identity.isIdentityVerified)
      return Response.json({ error: '광고를 설정하려면 본인인증이 필요합니다.' }, { status: 400 });
    if (!identity.isAtLeastAge14)
      return Response.json({ error: '만 14세 미만은 광고를 설정할 수 없습니다.' }, { status: 400 });
    if (!Array.isArray(body.items) || body.items.length > MAX_BLOG_AD_ITEMS) {
      return Response.json({ error: '기본 광고 상품은 최대 10개까지 등록할 수 있습니다.' }, { status: 400 });
    }

    const items = body.items.map((item) => normalizeItem(item as Item));
    if (!shopName || shopName.length > 50)
      return Response.json({ error: '쇼핑몰명은 50자 이하로 입력해주세요.' }, { status: 400 });
    if (
      items.some(
        (item) =>
          !item.productName || item.productName.length > 50 || !item.thumbnailImage || !isValidBlogAdUrl(item.linkUrl),
      )
    ) {
      return Response.json({ error: '상품명, 상품 썸네일, HTTPS 링크를 확인해주세요.' }, { status: 400 });
    }
    if (hasMultipleBlogAdLinkDomains(items)) {
      return Response.json({ error: '여러개의 쇼핑몰 링크를 사용하시면 안됩니다.' }, { status: 400 });
    }

    const currentResult = await context.supabaseAdmin
      .from('blog_ads')
      .select('id, product_name, shop_name, thumbnail_image, link_url')
      .eq('site_id', context.siteId)
      .is('post_id', null)
      .is('deleted_at', null);
    if (currentResult.error) return Response.json({ error: '기본 광고를 저장하지 못했습니다.' }, { status: 500 });
    const currentAds = currentResult.data ?? [];
    const currentAdIds = currentAds.map((item) => item.id);
    const immediateReports = currentAdIds.length
      ? await context.supabaseAdmin
          .from('blog_ad_reports')
          .select('blog_ad_id, reason, status')
          .in('blog_ad_id', currentAdIds)
          .eq('status', 'pending')
      : { data: [], error: null };
    if (immediateReports.error)
      return Response.json({ error: '광고 신고 상태를 확인하지 못했습니다.' }, { status: 500 });
    const lockedAdIds = new Set(
      (immediateReports.data ?? [])
        .filter((report) => isImmediateBlogAdReport(report.reason as keyof typeof BLOG_AD_REPORT_REASON_LABELS))
        .map((report) => report.blog_ad_id)
        .filter(Boolean),
    );
    for (const item of items) {
      if (!item.id || !lockedAdIds.has(item.id)) continue;
      const current = currentAds.find((entry) => entry.id === item.id);
      if (
        current &&
        (current.product_name !== item.productName ||
          current.link_url !== item.linkUrl ||
          current.thumbnail_image !== item.thumbnailImage ||
          (current.shop_name ?? '') !== shopName)
      ) {
        return Response.json({ error: '컨시어지팀에서 확인 중인 광고는 삭제만 할 수 있습니다.' }, { status: 400 });
      }
    }
    const retainedIds = new Set(items.map((item) => item.id).filter(Boolean));
    const removedIds = currentAds.map((item) => item.id).filter((id) => !retainedIds.has(id));
    const now = new Date().toISOString();

    if (removedIds.length) {
      const reports = await context.supabaseAdmin.from('blog_ad_reports').select('id').in('blog_ad_id', removedIds);
      if (!reports.error && reports.data?.length) {
        await context.supabaseAdmin
          .from('blog_ad_report_logs')
          .insert(reports.data.map((report) => ({ report_id: report.id, action: 'self_deleted', detail: {} })));
      }
      await context.supabaseAdmin.from('blog_ads').update({ deleted_at: now, updated_at: now }).in('id', removedIds);
    }

    for (const [sortOrder, item] of items.entries()) {
      if (item.id && (currentResult.data ?? []).some((current) => current.id === item.id)) {
        const current = (currentResult.data ?? []).find((entry) => entry.id === item.id)!;
        const hasLinkChange = current.link_url !== item.linkUrl;
        const hasNameChange = current.product_name !== item.productName;
        if (hasLinkChange || hasNameChange) {
          const reports = await context.supabaseAdmin
            .from('blog_ad_reports')
            .select('id, reason, status')
            .eq('blog_ad_id', item.id)
            .in('status', ['pending', 'issue']);
          if (!reports.error && reports.data?.length) {
            const logs: { report_id: string; action: string; detail: Record<string, unknown> }[] = [];
            for (const report of reports.data) {
              const detail = {
                previous: {
                  productName: current.product_name,
                  shopName: current.shop_name,
                  thumbnailImage: current.thumbnail_image,
                  linkUrl: current.link_url,
                },
                next: {
                  productName: item.productName,
                  shopName,
                  thumbnailImage: item.thumbnailImage,
                  linkUrl: item.linkUrl,
                },
              };
              const correction = getBlogAdReportCorrection(report.reason, { hasNameChange, hasLinkChange });
              if (correction === 'link_changed') {
                logs.push({ report_id: report.id, action: 'link_changed', detail });
                logs.push({ report_id: report.id, action: 'release_requested', detail: {} });
              } else if (correction === 'recheck') {
                logs.push({ report_id: report.id, action: 'information_changed', detail });
                if (report.status === 'issue') {
                  logs.push({ report_id: report.id, action: 'recheck_requested', detail: {} });
                  await context.supabaseAdmin
                    .from('blog_ad_reports')
                    .update({ status: 'pending', reviewed_at: null })
                    .eq('id', report.id);
                }
              }
            }
            if (logs.length) await context.supabaseAdmin.from('blog_ad_report_logs').insert(logs);
          }
        }
        const updated = await context.supabaseAdmin
          .from('blog_ads')
          .update({
            product_name: item.productName,
            shop_name: shopName,
            thumbnail_image: item.thumbnailImage,
            link_url: item.linkUrl,
            sort_order: sortOrder,
            updated_at: now,
          })
          .eq('id', item.id);
        if (updated.error) return Response.json({ error: '기본 광고를 저장하지 못했습니다.' }, { status: 500 });
      } else {
        const inserted = await context.supabaseAdmin.from('blog_ads').insert({
          site_id: context.siteId,
          post_id: null,
          product_name: item.productName,
          shop_name: shopName,
          thumbnail_image: item.thumbnailImage,
          link_url: item.linkUrl,
          sort_order: sortOrder,
        });
        if (inserted.error) return Response.json({ error: '기본 광고를 저장하지 못했습니다.' }, { status: 500 });
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '기본 광고를 저장하지 못했습니다.' },
      { status: 400 },
    );
  }
}
