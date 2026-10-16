import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { originTitle, Seo } from '@/lib/seo';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import Aside from '../aside';
import AuthSection from '../auth';
import Slick from '../slick';
import SearchPosts from './posts';
import styles from '@/app/page.module.sass';

type SearchParams = {
  keyword?: string | string[];
};

export async function generateMetadata(): Promise<Metadata> {
  return Seo({
    pageTitles: `검색 - ${originTitle}`,
    pageTitle: '검색',
    pageImg: 'https://velhub.xyz/og-etc.webp',
    pagePath: '/lounge/search',
  });
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const keywordValue = resolvedSearchParams.keyword;
  const keyword = (Array.isArray(keywordValue) ? keywordValue[0] : (keywordValue ?? '')).trim();
  const isValidKeyword = keyword.length >= 2;
  let sitesData = null;

  if (isValidKeyword) {
    const headerList = await headers();
    const host = headerList.get('host');
    const protocol = headerList.get('x-forwarded-proto') || 'http';

    if (host) {
      try {
        const response = await fetch(
          `${protocol}://${host}/api/home/sites?limit=10&sortBy=relevance&keyword=${encodeURIComponent(keyword)}`,
          { cache: 'no-store' },
        );

        if (response.ok) {
          sitesData = await response.json();
        }
      } catch {
        sitesData = null;
      }
    }
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <AuthSection />
          {isValidKeyword ? (
            <>
              {sitesData?.sites?.length ? (
                <section>
                  <h2>{`${keyword} 사이트 검색 결과 (${sitesData.sites.length}건)`}</h2>
                  <Slick sitesHitsData={sitesData} />
                </section>
              ) : null}
              <SearchPosts keyword={keyword} hasSiteResults={Boolean(sitesData?.sites?.length)} />
            </>
          ) : (
            <section>
              <h2>검색</h2>
              <ScreenState>검색어를 두 글자 이상 입력해주세요.</ScreenState>
            </section>
          )}
        </div>
        <Aside />
      </div>
    </Container>
  );
}
