import { Metadata } from 'next';
import { hasMembershipFeature } from '@/lib/memberships/features';
import { originTitle, Seo } from '@/lib/seo';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';
import Anchor from '@/components/Anchor';
import { ServiceErrorIcon } from '@/components/Svgs';
import Opt from './opt';
import styles from '@/app/new.module.sass';

export async function generateMetadata(): Promise<Metadata> {
  const timestamp = Date.now();
  return Seo({
    pageTitles: `블로그 개설 - ${originTitle}`,
    pageTitle: `블로그 개설`,
    pageDescription: `블로그를 개설할 수 있어요`,
    pageImg: `https://velhub.xyz/og-blog.webp?ts=${timestamp}`,
    pagePath: '/new/blog',
  });
}

export default async function Page() {
  let canCreateSite = true;
  let blockMessage = '';

  const currentStigma = await getCurrentStigma();
  if (currentStigma) {
    const hasUnlimitedSites = await hasMembershipFeature(currentStigma.stigmaId, 'owner_unlimited_sites');
    if (!hasUnlimitedSites) {
      const supabaseAdmin = getSupabaseAdmin();
      const siteCountResult = await supabaseAdmin
        .from('rhizomes')
        .select('id', { count: 'exact', head: true })
        .eq('owner_id', currentStigma.stigmaId)
        .eq('site_type', 'blog');

      if ((siteCountResult.count ?? 0) >= 1) {
        canCreateSite = false;
        blockMessage = '기본 오너 멤버십에서는 블로그를 1개만 개설할 수 있습니다.';
      }
    }
  }

  return (
    <main className={styles['new-generation']}>
      <div className={styles.container}>
        <div className={`content ${styles.content}`}>
          <h1>블로그 개설</h1>
          {!canCreateSite ? (
            <div className="paper page-error">
              <ServiceErrorIcon />
              <p className="alert error">
                <span>{blockMessage}</span>
              </p>
              <Anchor href={`/memberships/creator`} className="button medium submit">
                멤버십 가입하기
              </Anchor>
            </div>
          ) : (
            <Opt />
          )}
        </div>
      </div>
    </main>
  );
}
