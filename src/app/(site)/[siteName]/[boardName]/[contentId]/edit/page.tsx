import { notFound } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getSiteApiData } from '../../../../getSiteApiData';
import Opt, {
  type BoardInfoResponse,
  type ContentResponse,
  type PrefixListResponse,
  type SeriesListResponse,
} from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
    boardName: string;
    contentId: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName, boardName, contentId } = await context.params;
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
  const [content, boardInfo] = await Promise.all([
    getSiteApiData<ContentResponse>(
      `/api/boards/${boardName}/${contentId}?siteName=${normalizedSiteName}`,
      '게시글 정보를 불러오지 못했습니다.',
    ),
    getSiteApiData<BoardInfoResponse>(
      `/api/boards/${boardName}?siteName=${normalizedSiteName}`,
      '게시판 정보를 불러오지 못했습니다.',
    ),
  ]);
  const postType = boardInfo.data?.board?.post_type ?? 'none';
  const [prefixes, series] = await Promise.all([
    postType === 'prefix'
      ? getSiteApiData<PrefixListResponse>(
          `/api/boards/${boardName}/prefix?siteName=${normalizedSiteName}`,
          '말머리 목록을 불러오지 못했습니다.',
        )
      : Promise.resolve({ data: null, error: '' }),
    ['series', 'both'].includes(postType)
      ? getSiteApiData<SeriesListResponse>(
          `/api/boards/${boardName}/series?siteName=${normalizedSiteName}`,
          '연재 목록을 불러오지 못했습니다.',
        )
      : Promise.resolve({ data: null, error: '' }),
  ]);

  return (
    <Opt
      isCommunity={isCommunity}
      initialContent={content.data}
      initialBoardInfo={boardInfo.data}
      initialPrefixes={prefixes.data}
      initialSeries={series.data}
      initialError={content.error}
      initialBoardError={boardInfo.error || prefixes.error || series.error}
    />
  );
}
