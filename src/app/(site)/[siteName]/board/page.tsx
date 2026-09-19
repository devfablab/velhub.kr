import { notFound } from 'next/navigation';
import { getSitePageMetadata } from '@/lib/seoSite';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getSiteApiData } from '../../getSiteApiData';
import Container from '../menu';
import Opt, { type BoardListResponse } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type SearchContext = RouteContext & {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata(context: RouteContext) {
  const { siteName } = await context.params;

  return getSitePageMetadata({
    siteName,
    pageTitle: '최근글 보기',
    pagePath: '/board',
  });
}

export default async function Page(context: SearchContext) {
  const { siteName } = await context.params;
  const searchParams = await context.searchParams;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    notFound();
  }

  const isCommunity = rhizomeResult.data.site_type === 'community';
  const queryParams = new URLSearchParams({
    siteName: normalizedSiteName,
    page: typeof searchParams.page === 'string' ? searchParams.page : '1',
    size: '20',
  });
  if (typeof searchParams.keyword === 'string' && searchParams.keyword) queryParams.set('keyword', searchParams.keyword);
  const initial = await getSiteApiData<BoardListResponse>(`/api/boards/all?${queryParams.toString()}`, '전체 게시글을 불러오지 못했습니다.');
  return (
    <Container pageBack={`/${siteName}`} pageTitle="최근글 보기">
      <Opt isCommunity={isCommunity} initialData={initial.data} initialError={initial.error} />
    </Container>
  );
}
