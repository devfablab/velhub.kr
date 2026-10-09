import { redirect } from 'next/navigation';
import {
  BLOG_AD_REPORT_REASON_LABELS,
  getBlogAdIdentityStatus,
  getBlogAdPublicImageUrl,
  getBlogAdSiteContext,
  isImmediateBlogAdReport,
} from '@/lib/blogAds/server';
import { normalizeText } from '@/lib/utils';
import Container from '../menu';
import Opt from './opt';

type Props = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: Props) {
  const siteName = normalizeText((await params).siteName).toLowerCase();
  const context = await getBlogAdSiteContext(siteName);
  if (!context || !context.isOwner) redirect(`/${siteName}/manage`);
  const identity = await getBlogAdIdentityStatus(context.session.stigmaId);
  const commonAdsResult = context.isEnabled
    ? await context.supabaseAdmin
        .from('blog_ads')
        .select('id, product_name, shop_name, thumbnail_image, link_url, sort_order')
        .eq('site_id', context.siteId)
        .is('post_id', null)
        .is('deleted_at', null)
        .order('sort_order')
    : { data: [], error: null };
  if (commonAdsResult.error) throw new Error('기본 광고를 불러오지 못했습니다.');
  const commonAdIds = (commonAdsResult.data ?? []).map((item) => item.id);
  const reportsResult = commonAdIds.length
    ? await context.supabaseAdmin
        .from('blog_ad_reports')
        .select('id, blog_ad_id, reason, status, created_at')
        .in('blog_ad_id', commonAdIds)
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
  const initialItems = (commonAdsResult.data ?? []).map((item) => ({
    id: item.id,
    productName: item.product_name,
    thumbnailImage: item.thumbnail_image,
    thumbnailUrl: getBlogAdPublicImageUrl(item.thumbnail_image) ?? '',
    linkUrl: item.link_url,
    report: reportByAdId.get(item.id) ?? null,
  }));

  return (
    <Container pageTitle="광고 관리" pageBack={`/${siteName}/manage`}>
      <Opt
        initialData={{
          isEnabled: context.isEnabled,
          isEligible: context.isEligible,
          hasBeenOpenFor15Days: context.hasBeenOpenFor15Days,
          postCount: context.postCount,
          totalViews: context.totalViews,
          ...identity,
        }}
        initialItems={initialItems}
        initialShopName={commonAdsResult.data?.[0]?.shop_name ?? ''}
      />
    </Container>
  );
}
