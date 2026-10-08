import { redirect } from 'next/navigation';
import { Typography } from '@mui/material';
import { getBlogCommunityEnablement } from '@/lib/blogCommunity/access';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/manage.module.sass';

export default async function Page({ params }: { params: Promise<{ siteName: string }> }) {
  const { siteName } = await params;
  const feature = await getBlogCommunityEnablement(siteName);
  if (!feature?.isPersonalBlog || !feature.isOwner) redirect(`/${siteName}/manage`);
  const enabled = feature.isEnabled;
  const badges = enabled
    ? await (async () => {
        const { getSupabaseAdmin } = await import('@/lib/supabase');
        const result = await getSupabaseAdmin()
          .from('blog_subscription_badges')
          .select('subscription_months, image_url')
          .eq('site_id', feature.siteId)
          .order('subscription_months');
        if (result.error) throw new Error('멤버십팬 배지 설정을 불러오지 못했습니다.');
        return result.data ?? [];
      })()
    : [];
  return (
    <Container pageTitle="커뮤니티 관리" pageBack={`/${siteName}/manage`} menu="community">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <section className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">멤버십팬 배지</Typography>
            {enabled ? (
              <Opt badges={badges} />
            ) : (
              <ScreenState kind="error">블로그 구독이 활성화되어 있지 않아 사용할 수 없습니다.</ScreenState>
            )}
          </section>
        </div>
      </div>
    </Container>
  );
}
