import { notFound } from 'next/navigation';
import { Typography } from '@mui/material';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getSitePageMetadata } from '@/lib/seoSite';
import { getVisibleBlogHomeAds } from '@/lib/service/blog/blogAds/server';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import OptimizedImage from '@/components/OptimizedImage';
import BlogAdReportButton from '@/components/service/blog/BlogAdReportButton';
import SiteProfile from '@/components/service/blog/SiteProfile';
import Container from '../menu';
import styles from '@/app/board.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export async function generateMetadata(context: RouteContext) {
  const { siteName } = await context.params;

  return getSitePageMetadata({
    siteName,
    pageTitle: '쇼핑',
    pagePath: '/shopping',
  });
}

export default async function Page({ params }: RouteContext) {
  const siteName = normalizeText((await params).siteName).toLowerCase();

  if (!siteName) notFound();

  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type, is_shutdown')
    .eq('site_key', siteName)
    .maybeSingle();

  if (
    siteResult.error ||
    !siteResult.data ||
    siteResult.data.site_type !== 'blog' ||
    siteResult.data.is_shutdown !== false
  ) {
    notFound();
  }

  const ads = await getVisibleBlogHomeAds(siteResult.data.id);

  if (!ads.length) notFound();

  return (
    <Container pageTitle="쇼핑" pageBack={`/${siteName}`}>
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-list']}`}>
          <SiteProfile />
          <div className={`paper ${styles.shopping}`}>
            {ads[0]?.shopName ? <Typography variant="subtitle2">{ads[0].shopName} 제공</Typography> : null}
            <div className={styles['shopping-items']}>
              {ads.map((ad) => (
                <div key={ad.id} className={`paper ${styles['shopping-item']}`}>
                  <Anchor href={ad.linkUrl}>
                    <OptimizedImage
                      src={ad.thumbnailUrl}
                      width={ad.thumbnailWidth}
                      height={ad.thumbnailHeight}
                      sizes="(max-width: 991px) 50vw, (max-width: 1199px) 33vw, 270px"
                      alt={ad.productName}
                    />
                    <span className={styles['shopping-info']}>
                      <strong>{ad.productName}</strong>
                      <em>{ad.domain}</em>
                    </span>
                  </Anchor>
                  <BlogAdReportButton siteName={siteName} adId={ad.id} targetType="ad" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
