import {
  BLOG_AD_REPORT_REASON_LABELS,
  MAX_BLOG_AD_ITEMS,
  type BlogPostAdType,
  assertBlogAdEditor,
  getBlogAdReportCorrection,
  getRequiredBlogAdImageUrl,
  isImmediateBlogAdReport,
  isSubscriptionSeriesPost,
  isValidBlogAdUrl,
} from '@/lib/blogAds/server';
import { normalizeText } from '@/lib/utils';

type RouteContext = { params: Promise<{ contentId: string }> };
type AdItem = { id?: unknown; productName?: unknown; thumbnailImage?: unknown; linkUrl?: unknown };

function normalizeItem(value: AdItem) {
  return {
    id: normalizeText(typeof value.id === 'string' ? value.id : ''),
    productName: normalizeText(typeof value.productName === 'string' ? value.productName : ''),
    thumbnailImage: normalizeText(typeof value.thumbnailImage === 'string' ? value.thumbnailImage : ''),
    linkUrl: normalizeText(typeof value.linkUrl === 'string' ? value.linkUrl : ''),
  };
}

type VisibleReport = {
  status: 'pending' | 'issue';
  reasonDescription: string;
  isImmediatelyStopped: boolean;
};

function getVisibleReports(
  reports: Array<{ targetId: string | null; reason: string; status: 'pending' | 'issue'; created_at: string }>,
) {
  const result = new Map<string, VisibleReport>();
  for (const report of reports) {
    if (!report.targetId || result.has(report.targetId)) continue;
    const isImmediatelyStopped =
      report.status === 'pending' &&
      isImmediateBlogAdReport(report.reason as keyof typeof BLOG_AD_REPORT_REASON_LABELS);
    // 일반 신고는 Velman이 문제 있다고 판단하기 전까지 글 관리 화면에 노출하지 않는다.
    if (report.status !== 'issue' && !isImmediatelyStopped) continue;
    const reason = BLOG_AD_REPORT_REASON_LABELS[report.reason as keyof typeof BLOG_AD_REPORT_REASON_LABELS];
    result.set(report.targetId, {
      status: report.status,
      reasonDescription: reason?.description ?? '신고 사유를 확인해주세요.',
      isImmediatelyStopped,
    });
  }
  return result;
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
  const hasNameChange = previous.name !== next.name;
  if (!hasLinkChange && !hasNameChange) return;

  const reports = await supabaseAdmin
    .from('blog_ad_reports')
    .select('id, reason, status')
    .eq(target, targetId)
    .in('status', ['pending', 'issue']);
  if (reports.error || !reports.data?.length) return;

  const logRows: { report_id: string; action: string; detail: Record<string, unknown> }[] = [];
  for (const report of reports.data) {
    const correction = getBlogAdReportCorrection(report.reason, { hasNameChange, hasLinkChange });
    if (correction === 'link_changed') {
      logRows.push({ report_id: report.id, action: 'link_changed', detail: { previous, next } });
      logRows.push({ report_id: report.id, action: 'release_requested', detail: {} });
      continue;
    }

    if (correction === 'recheck') {
      logRows.push({ report_id: report.id, action: 'information_changed', detail: { previous, next } });
      if (report.status === 'issue') {
        logRows.push({ report_id: report.id, action: 'recheck_requested', detail: {} });
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

    const multiAdIds = (multiAds.data ?? []).map((item) => item.id);
    const [multiReports, postReports] = await Promise.all([
      multiAdIds.length
        ? base.supabaseAdmin
            .from('blog_ad_reports')
            .select('blog_ad_id, reason, status, created_at')
            .in('blog_ad_id', multiAdIds)
            .in('status', ['pending', 'issue'])
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
      postAd.data
        ? base.supabaseAdmin
            .from('blog_ad_reports')
            .select('blog_post_ad_id, reason, status, created_at')
            .eq('blog_post_ad_id', postAd.data.id)
            .in('status', ['pending', 'issue'])
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (multiReports.error || postReports.error)
      return Response.json({ error: '광고 신고 상태를 불러오지 못했습니다.' }, { status: 500 });
    const multiReportByAdId = getVisibleReports(
      (multiReports.data ?? []).map((report) => ({ ...report, targetId: report.blog_ad_id })),
    );
    const postReportByAdId = getVisibleReports(
      (postReports.data ?? []).map((report) => ({ ...report, targetId: report.blog_post_ad_id })),
    );

    return Response.json({
      isEnabled: base.isEnabled,
      isEligible: base.isEligible,
      isIdentityVerified: base.identity.isIdentityVerified,
      isAtLeastAge14: base.identity.isAtLeastAge14,
      isSubscriptionSeries,
      multiAds: (multiAds.data ?? []).map((item) => ({
        ...item,
        thumbnail_url: getRequiredBlogAdImageUrl(item.thumbnail_image),
        report: multiReportByAdId.get(item.id) ?? null,
      })),
      postAd: postAd.data
        ? {
            ...postAd.data,
            thumbnail_url:
              postAd.data.ad_type === 'advertisement' ? getRequiredBlogAdImageUrl(postAd.data.thumbnail_image) : null,
            report: postReportByAdId.get(postAd.data.id) ?? null,
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

    const oldMultiAdIds = (oldMultiAds.data ?? []).map((ad) => ad.id);
    const [multiImmediateReports, postImmediateReports] = await Promise.all([
      oldMultiAdIds.length
        ? base.supabaseAdmin
            .from('blog_ad_reports')
            .select('blog_ad_id, reason')
            .in('blog_ad_id', oldMultiAdIds)
            .eq('status', 'pending')
        : Promise.resolve({ data: [], error: null }),
      oldPostAd.data
        ? base.supabaseAdmin
            .from('blog_ad_reports')
            .select('blog_post_ad_id, reason')
            .eq('blog_post_ad_id', oldPostAd.data.id)
            .eq('status', 'pending')
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (multiImmediateReports.error || postImmediateReports.error)
      return Response.json({ error: '광고 신고 상태를 확인하지 못했습니다.' }, { status: 500 });
    const lockedMultiAdIds = new Set(
      (multiImmediateReports.data ?? [])
        .filter((report) => isImmediateBlogAdReport(report.reason as keyof typeof BLOG_AD_REPORT_REASON_LABELS))
        .map((report) => report.blog_ad_id)
        .filter(Boolean),
    );
    const isPostAdLocked = (postImmediateReports.data ?? []).some((report) =>
      isImmediateBlogAdReport(report.reason as keyof typeof BLOG_AD_REPORT_REASON_LABELS),
    );

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
      if (
        isPostAdLocked &&
        (oldPostAd.data?.ad_type !== 'sponsorship' ||
          oldPostAd.data.sponsor_name !== sponsorName ||
          oldPostAd.data.link_url !== linkUrl)
      ) {
        return Response.json({ error: '컨시어지팀에서 확인 중인 광고는 삭제만 할 수 있습니다.' }, { status: 400 });
      }
      if (lockedMultiAdIds.size) {
        return Response.json({ error: '컨시어지팀에서 확인 중인 광고는 삭제만 할 수 있습니다.' }, { status: 400 });
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
      if (isPostAdLocked) {
        return Response.json({ error: '컨시어지팀에서 확인 중인 광고는 삭제만 할 수 있습니다.' }, { status: 400 });
      }
      const oldMultiAdById = new Map((oldMultiAds.data ?? []).map((ad) => [ad.id, ad]));
      for (const item of items) {
        if (!item.id || !lockedMultiAdIds.has(item.id)) continue;
        const current = oldMultiAdById.get(item.id);
        if (
          !current ||
          current.product_name !== item.productName ||
          current.link_url !== item.linkUrl ||
          current.thumbnail_image !== item.thumbnailImage ||
          (current.shop_name ?? '') !== shopName
        ) {
          return Response.json({ error: '컨시어지팀에서 확인 중인 광고는 삭제만 할 수 있습니다.' }, { status: 400 });
        }
      }
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
      const retainedIds = new Set(items.map((item) => item.id).filter(Boolean));
      const removedAds = (oldMultiAds.data ?? []).filter((ad) => !retainedIds.has(ad.id));
      for (const ad of removedAds)
        await addSelfDeletedLogs({ supabaseAdmin: base.supabaseAdmin, target: 'blog_ad_id', targetId: ad.id });
      if (removedAds.length) {
        const removed = await base.supabaseAdmin
          .from('blog_ads')
          .update({ deleted_at: now, updated_at: now })
          .in(
            'id',
            removedAds.map((ad) => ad.id),
          );
        if (removed.error) return Response.json({ error: '상품 광고를 저장하지 못했습니다.' }, { status: 500 });
      }
      for (const [sortOrder, item] of items.entries()) {
        const current = item.id ? oldMultiAdById.get(item.id) : null;
        if (current) {
          await addChangeLogs({
            supabaseAdmin: base.supabaseAdmin,
            target: 'blog_ad_id',
            targetId: current.id,
            previous: {
              name: current.product_name,
              shopName: current.shop_name,
              thumbnailImage: current.thumbnail_image,
              linkUrl: current.link_url,
            },
            next: { name: item.productName, shopName, thumbnailImage: item.thumbnailImage, linkUrl: item.linkUrl },
          });
          const updated = await base.supabaseAdmin
            .from('blog_ads')
            .update({
              product_name: item.productName,
              shop_name: shopName,
              thumbnail_image: item.thumbnailImage,
              link_url: item.linkUrl,
              sort_order: sortOrder,
              updated_at: now,
            })
            .eq('id', current.id);
          if (updated.error) return Response.json({ error: '상품 광고를 저장하지 못했습니다.' }, { status: 500 });
        } else {
          const inserted = await base.supabaseAdmin.from('blog_ads').insert({
            site_id: base.siteId,
            post_id: base.post.id,
            product_name: item.productName,
            shop_name: shopName,
            thumbnail_image: item.thumbnailImage,
            link_url: item.linkUrl,
            sort_order: sortOrder,
          });
          if (inserted.error) return Response.json({ error: '상품 광고를 저장하지 못했습니다.' }, { status: 500 });
        }
      }
      return Response.json({ ok: true });
    }

    const item = items[0];
    if (
      isPostAdLocked &&
      (oldPostAd.data?.ad_type !== 'advertisement' ||
        oldPostAd.data.product_name !== item.productName ||
        oldPostAd.data.link_url !== item.linkUrl ||
        oldPostAd.data.thumbnail_image !== item.thumbnailImage ||
        (oldPostAd.data.shop_name ?? '') !== shopName)
    ) {
      return Response.json({ error: '컨시어지팀에서 확인 중인 광고는 삭제만 할 수 있습니다.' }, { status: 400 });
    }
    if (lockedMultiAdIds.size) {
      return Response.json({ error: '컨시어지팀에서 확인 중인 광고는 삭제만 할 수 있습니다.' }, { status: 400 });
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
