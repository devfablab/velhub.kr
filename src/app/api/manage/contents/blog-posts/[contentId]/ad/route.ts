import {
  MAX_BLOG_AD_ITEMS,
  type BlogPostAdType,
  assertBlogAdEditor,
  getRequiredBlogAdImageUrl,
  isSubscriptionSeriesPost,
  isValidBlogAdUrl,
} from '@/lib/blogAds/server';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ contentId: string }> };
type AdItem = { productName?: unknown; thumbnailImage?: unknown; linkUrl?: unknown };

function normalizeItem(value: AdItem) {
  return {
    productName: normalizeText(typeof value.productName === 'string' ? value.productName : ''),
    thumbnailImage: normalizeText(typeof value.thumbnailImage === 'string' ? value.thumbnailImage : ''),
    linkUrl: normalizeText(typeof value.linkUrl === 'string' ? value.linkUrl : ''),
  };
}

async function addChangeLogs({
  supabaseAdmin,
  target,
  targetId,
  previous,
  next,
}: {
  supabaseAdmin: Awaited<ReturnType<typeof assertBlogAdEditor>>['supabaseAdmin'];
  target: 'blog_ad_id' | 'blog_post_ad_id';
  targetId: string;
  previous: { name: string; shopName: string | null; thumbnailImage: string | null; linkUrl: string };
  next: { name: string; shopName: string | null; thumbnailImage: string | null; linkUrl: string };
}) {
  const hasLinkChange = previous.linkUrl !== next.linkUrl;
  const hasInformationChange =
    hasLinkChange ||
    previous.name !== next.name ||
    (previous.shopName ?? '') !== (next.shopName ?? '') ||
    (previous.thumbnailImage ?? '') !== (next.thumbnailImage ?? '');
  if (!hasInformationChange) return;

  const reports = await supabaseAdmin
    .from('blog_ad_reports')
    .select('id, reason, status')
    .eq(target, targetId)
    .in('status', ['pending', 'issue']);
  if (reports.error || !reports.data?.length) return;

  const logRows: { report_id: string; action: string; detail: Record<string, unknown> }[] = [];
  for (const report of reports.data) {
    if (hasLinkChange && (report.reason === 'unsafe_link' || report.reason === 'illegal_or_harmful_site')) {
      logRows.push({ report_id: report.id, action: 'link_changed', detail: { previous, next } });
      logRows.push({ report_id: report.id, action: 'release_requested', detail: {} });
      continue;
    }

    if (
      report.reason === 'different_destination' ||
      report.reason === 'non_product_link' ||
      report.reason === 'problematic_product'
    ) {
      logRows.push({ report_id: report.id, action: 'information_changed', detail: { previous, next } });
      if (report.status === 'issue') {
        await supabaseAdmin
          .from('blog_ad_reports')
          .update({ status: 'pending', reviewed_at: null })
          .eq('id', report.id);
      }
    }
  }
  if (logRows.length) await supabaseAdmin.from('blog_ad_report_logs').insert(logRows);
}

async function addSelfDeletedLogs({
  supabaseAdmin,
  target,
  targetId,
}: {
  supabaseAdmin: Awaited<ReturnType<typeof assertBlogAdEditor>>['supabaseAdmin'];
  target: 'blog_ad_id' | 'blog_post_ad_id';
  targetId: string;
}) {
  const reports = await supabaseAdmin.from('blog_ad_reports').select('id').eq(target, targetId);
  if (reports.error || !reports.data?.length) return;
  await supabaseAdmin
    .from('blog_ad_report_logs')
    .insert(reports.data.map((report) => ({ report_id: report.id, action: 'self_deleted', detail: {} })));
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { contentId } = await context.params;
    const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();
    const base = await assertBlogAdEditor({ siteName, postReference: contentId });
    const isSubscriptionSeries = await isSubscriptionSeriesPost({ siteId: base.siteId, seriesId: base.post.series_id });
    const [multiAds, postAd] = await Promise.all([
      base.supabaseAdmin
        .from('blog_ads')
        .select('id, product_name, shop_name, thumbnail_image, link_url, sort_order')
        .eq('post_id', base.post.id)
        .is('deleted_at', null)
        .order('sort_order'),
      base.supabaseAdmin
        .from('blog_post_ads')
        .select('id, ad_type, product_name, sponsor_name, shop_name, thumbnail_image, link_url')
        .eq('post_id', base.post.id)
        .is('deleted_at', null)
        .maybeSingle(),
    ]);
    if (multiAds.error || postAd.error)
      return Response.json({ error: '글 광고 정보를 불러오지 못했습니다.' }, { status: 500 });

    return Response.json({
      isEnabled: base.isEnabled,
      isEligible: base.isEligible,
      isIdentityVerified: base.identity.isIdentityVerified,
      isAtLeastAge14: base.identity.isAtLeastAge14,
      isSubscriptionSeries,
      multiAds: (multiAds.data ?? []).map((item) => ({
        ...item,
        thumbnail_url: getRequiredBlogAdImageUrl(item.thumbnail_image),
      })),
      postAd: postAd.data
        ? {
            ...postAd.data,
            thumbnail_url:
              postAd.data.ad_type === 'advertisement' ? getRequiredBlogAdImageUrl(postAd.data.thumbnail_image) : null,
          }
        : null,
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '글 광고 정보를 불러오지 못했습니다.' },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { contentId } = await context.params;
    const body = (await request.json()) as {
      siteName?: unknown;
      type?: unknown;
      shopName?: unknown;
      items?: unknown;
      sponsorName?: unknown;
      linkUrl?: unknown;
    };
    const siteName = normalizeText(typeof body.siteName === 'string' ? body.siteName : '').toLowerCase();
    const base = await assertBlogAdEditor({ siteName, postReference: contentId });
    const type =
      body.type === 'advertisement' || body.type === 'sponsorship' || body.type === 'none' ? body.type : null;
    if (!type) return Response.json({ error: '광고 유형이 유효하지 않습니다.' }, { status: 400 });
    const shopName = normalizeText(typeof body.shopName === 'string' ? body.shopName : '');

    const isSubscriptionSeries = await isSubscriptionSeriesPost({ siteId: base.siteId, seriesId: base.post.series_id });
    const now = new Date().toISOString();
    const [oldMultiAds, oldPostAd] = await Promise.all([
      base.supabaseAdmin.from('blog_ads').select('*').eq('post_id', base.post.id).is('deleted_at', null),
      base.supabaseAdmin
        .from('blog_post_ads')
        .select('*')
        .eq('post_id', base.post.id)
        .is('deleted_at', null)
        .maybeSingle(),
    ]);
    if (oldMultiAds.error || oldPostAd.error)
      return Response.json({ error: '기존 광고 정보를 불러오지 못했습니다.' }, { status: 500 });

    if (type === 'none') {
      for (const ad of oldMultiAds.data ?? [])
        await addSelfDeletedLogs({ supabaseAdmin: base.supabaseAdmin, target: 'blog_ad_id', targetId: ad.id });
      if (oldPostAd.data)
        await addSelfDeletedLogs({
          supabaseAdmin: base.supabaseAdmin,
          target: 'blog_post_ad_id',
          targetId: oldPostAd.data.id,
        });
      const [multiDeleted, postDeleted] = await Promise.all([
        base.supabaseAdmin
          .from('blog_ads')
          .update({ deleted_at: now, updated_at: now })
          .eq('post_id', base.post.id)
          .is('deleted_at', null),
        base.supabaseAdmin
          .from('blog_post_ads')
          .update({ deleted_at: now, updated_at: now })
          .eq('post_id', base.post.id)
          .is('deleted_at', null),
      ]);
      if (multiDeleted.error || postDeleted.error)
        return Response.json({ error: '광고 정보를 삭제하지 못했습니다.' }, { status: 500 });
      return Response.json({ ok: true });
    }

    if (!base.isEnabled || !base.isEligible)
      return Response.json({ error: '광고 사용 조건을 충족하지 않았습니다.' }, { status: 400 });
    if (!base.identity.isIdentityVerified)
      return Response.json({ error: '광고를 설정하려면 본인인증이 필요합니다.' }, { status: 400 });
    if (!base.identity.isAtLeastAge14)
      return Response.json({ error: '만 14세 미만은 광고를 설정할 수 없습니다.' }, { status: 400 });

    if (type === 'sponsorship') {
      const sponsorName = normalizeText(typeof body.sponsorName === 'string' ? body.sponsorName : '');
      const linkUrl = normalizeText(typeof body.linkUrl === 'string' ? body.linkUrl : '');
      if (!sponsorName || sponsorName.length > 50 || !isValidBlogAdUrl(linkUrl)) {
        return Response.json({ error: '협찬사명과 HTTPS 링크를 확인해주세요.' }, { status: 400 });
      }
      for (const ad of oldMultiAds.data ?? [])
        await addSelfDeletedLogs({ supabaseAdmin: base.supabaseAdmin, target: 'blog_ad_id', targetId: ad.id });
      await base.supabaseAdmin
        .from('blog_ads')
        .update({ deleted_at: now, updated_at: now })
        .eq('post_id', base.post.id)
        .is('deleted_at', null);
      if (oldPostAd.data) {
        await addChangeLogs({
          supabaseAdmin: base.supabaseAdmin,
          target: 'blog_post_ad_id',
          targetId: oldPostAd.data.id,
          previous: {
            name: oldPostAd.data.sponsor_name ?? oldPostAd.data.product_name ?? '',
            shopName: oldPostAd.data.shop_name,
            thumbnailImage: oldPostAd.data.thumbnail_image,
            linkUrl: oldPostAd.data.link_url,
          },
          next: { name: sponsorName, shopName: null, thumbnailImage: null, linkUrl },
        });
      }
      const nextPostAd = {
        site_id: base.siteId,
        post_id: base.post.id,
        ad_type: 'sponsorship' satisfies BlogPostAdType,
        product_name: null,
        shop_name: null,
        sponsor_name: sponsorName,
        thumbnail_image: null,
        link_url: linkUrl,
        deleted_at: null,
        updated_at: now,
      };
      const saved = oldPostAd.data
        ? await base.supabaseAdmin.from('blog_post_ads').update(nextPostAd).eq('id', oldPostAd.data.id)
        : await base.supabaseAdmin.from('blog_post_ads').insert(nextPostAd);
      if (saved.error) return Response.json({ error: '협찬 정보를 저장하지 못했습니다.' }, { status: 500 });
      return Response.json({ ok: true });
    }

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0 ||
      body.items.length > (isSubscriptionSeries ? MAX_BLOG_AD_ITEMS : 1)
    ) {
      return Response.json(
        {
          error: isSubscriptionSeries
            ? '상품은 최대 10개까지 등록할 수 있습니다.'
            : '이 글에는 상품을 1개만 등록할 수 있습니다.',
        },
        { status: 400 },
      );
    }
    const items = body.items.map((item) => normalizeItem(item as AdItem));
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

    if (isSubscriptionSeries) {
      if (oldPostAd.data)
        await addSelfDeletedLogs({
          supabaseAdmin: base.supabaseAdmin,
          target: 'blog_post_ad_id',
          targetId: oldPostAd.data.id,
        });
      await base.supabaseAdmin
        .from('blog_post_ads')
        .update({ deleted_at: now, updated_at: now })
        .eq('post_id', base.post.id)
        .is('deleted_at', null);
      for (const ad of oldMultiAds.data ?? [])
        await addSelfDeletedLogs({ supabaseAdmin: base.supabaseAdmin, target: 'blog_ad_id', targetId: ad.id });
      await base.supabaseAdmin
        .from('blog_ads')
        .update({ deleted_at: now, updated_at: now })
        .eq('post_id', base.post.id)
        .is('deleted_at', null);
      const saved = await base.supabaseAdmin.from('blog_ads').insert(
        items.map((item, sortOrder) => ({
          site_id: base.siteId,
          post_id: base.post.id,
          product_name: item.productName,
          shop_name: shopName,
          thumbnail_image: item.thumbnailImage,
          link_url: item.linkUrl,
          sort_order: sortOrder,
        })),
      );
      if (saved.error) return Response.json({ error: '상품 광고를 저장하지 못했습니다.' }, { status: 500 });
      return Response.json({ ok: true });
    }

    const item = items[0];
    for (const ad of oldMultiAds.data ?? [])
      await addSelfDeletedLogs({ supabaseAdmin: base.supabaseAdmin, target: 'blog_ad_id', targetId: ad.id });
    await base.supabaseAdmin
      .from('blog_ads')
      .update({ deleted_at: now, updated_at: now })
      .eq('post_id', base.post.id)
      .is('deleted_at', null);
    if (oldPostAd.data) {
      await addChangeLogs({
        supabaseAdmin: base.supabaseAdmin,
        target: 'blog_post_ad_id',
        targetId: oldPostAd.data.id,
        previous: {
          name: oldPostAd.data.sponsor_name ?? oldPostAd.data.product_name ?? '',
          shopName: oldPostAd.data.shop_name,
          thumbnailImage: oldPostAd.data.thumbnail_image,
          linkUrl: oldPostAd.data.link_url,
        },
        next: { name: item.productName, shopName, thumbnailImage: item.thumbnailImage, linkUrl: item.linkUrl },
      });
    }
    const nextPostAd = {
      site_id: base.siteId,
      post_id: base.post.id,
      ad_type: 'advertisement' satisfies BlogPostAdType,
      product_name: item.productName,
      shop_name: shopName,
      sponsor_name: null,
      thumbnail_image: item.thumbnailImage,
      link_url: item.linkUrl,
      deleted_at: null,
      updated_at: now,
    };
    const saved = oldPostAd.data
      ? await base.supabaseAdmin.from('blog_post_ads').update(nextPostAd).eq('id', oldPostAd.data.id)
      : await base.supabaseAdmin.from('blog_post_ads').insert(nextPostAd);
    if (saved.error) return Response.json({ error: '상품 광고를 저장하지 못했습니다.' }, { status: 500 });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '글 광고 정보를 저장하지 못했습니다.' },
      { status: 400 },
    );
  }
}
