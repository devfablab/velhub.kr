import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { originTitle, Seo } from '@/lib/seo';
import {
  getOnePickPosts,
  getOnePickSites,
  ONE_PICK_LIST_TYPES,
  ONE_PICK_PAGE_SIZE,
  ONE_PICK_POST_TITLE,
  ONE_PICK_SITE_TITLE,
  type OnePickListType,
  type OnePickSiteCard,
} from '@/lib/service/lounge/loungeMoments';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../../menu';
import type { PostsResponse } from '../../../page';
import Aside from '../../aside';
import List from '../../list';
import MomentSubMenu from '../MomentSubMenu';
import OnePickList from './opt';
import styles from '@/app/page.module.sass';

type SearchParams = {
  type?: string | string[];
  page?: string | string[];
};

const PAGE_TITLES: Record<OnePickListType, string> = {
  'creator-sites': `크리에이터 모먼트 - ${ONE_PICK_SITE_TITLE}`,
  'creator-posts': `크리에이터 모먼트 - ${ONE_PICK_POST_TITLE}`,
  'owner-sites': `오너 모먼트 - ${ONE_PICK_SITE_TITLE}`,
};

function getFirstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isOnePickListType(value: string | undefined): value is OnePickListType {
  return ONE_PICK_LIST_TYPES.includes(value as OnePickListType);
}

function toPageNumber(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export async function generateMetadata(): Promise<Metadata> {
  return Seo({
    pageTitles: `모먼트 전체보기 - ${originTitle}`,
    pageTitle: '모먼트 전체보기',
    pageDescription: '라운지 모먼트에 소개되는 ONE픽 사이트와 포스팅을 모두 만나보세요.',
    pageImg: 'https://velhub.xyz/og-etc.webp',
    pagePath: '/lounge/moments/all',
  });
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const resolvedSearchParams = await searchParams;
  const type = getFirstValue(resolvedSearchParams.type);
  if (!isOnePickListType(type)) notFound();

  const page = toPageNumber(getFirstValue(resolvedSearchParams.page));
  let sites: OnePickSiteCard[] = [];
  let postsData: PostsResponse | null = null;
  let total = 0;
  let hasError = false;

  try {
    if (type === 'creator-posts') {
      const result = await getOnePickPosts({ page, pageSize: ONE_PICK_PAGE_SIZE });
      postsData = { posts: result.posts as unknown as PostsResponse['posts'] };
      total = result.total;
    } else {
      const result = await getOnePickSites(type === 'creator-sites' ? 'creator' : 'owner', {
        page,
        pageSize: ONE_PICK_PAGE_SIZE,
      });
      sites = result.sites;
      total = result.total;
    }
  } catch {
    hasError = true;
  }

  const pageCount = Math.ceil(total / ONE_PICK_PAGE_SIZE);
  const hasItems = sites.length > 0 || Boolean(postsData?.posts.length);

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <MomentSubMenu allHref={`/lounge/moments/all?type=${type}${page > 1 ? `&page=${page}` : ''}`} />
          <section>
            <h2>{PAGE_TITLES[type]}</h2>
            {hasError ? (
              <ScreenState kind="error">목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</ScreenState>
            ) : hasItems ? (
              <>
                {postsData ? <List orderType="newest" initialData={postsData} /> : null}
                <OnePickList type={type} sites={sites} page={page} pageCount={pageCount} />
              </>
            ) : (
              <ScreenState>보여 줄 항목이 없습니다.</ScreenState>
            )}
          </section>
        </div>
        <Aside />
      </div>
    </Container>
  );
}
