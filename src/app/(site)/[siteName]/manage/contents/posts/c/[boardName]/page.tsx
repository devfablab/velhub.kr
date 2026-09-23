import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Opt, { type BoardResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = {
  params: Promise<{
    siteName: string;
    boardName: string;
  }>;
};

type SearchContext = RouteContext & { searchParams: Promise<{ page?: string; size?: string; filter?: string }> };

export default async function Page(context: SearchContext) {
  const { siteName, boardName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  const supabaseAdmin = getSupabaseAdmin();

  const siteInfo = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteInfo.data?.site_type !== 'community') {
    redirect(`/${normalizedSiteName}/manage/contents/posts`);
  }

  const searchParams = await context.searchParams;
  const page = Number(searchParams.page) > 0 ? Number(searchParams.page) : 1;
  const size = Number(searchParams.size) > 0 ? `&size=${Number(searchParams.size)}` : '';
  const filter = searchParams.filter === 'deleted' ? '&filter=deleted' : '';
  const initial = await getSiteApiData<BoardResponse>(
    `/api/boards/${boardName}?siteName=${normalizedSiteName}&manageContents=true&page=${page}${size}${filter}`,
    '게시판을 불러오지 못했습니다.',
  );
  return <Opt key={`${boardName}:${page}:${size}:${filter}`} initialData={initial.data} initialError={initial.error} />;
}
