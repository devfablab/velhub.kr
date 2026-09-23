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
  }>;
  searchParams: Promise<{
    boardName?: string;
    contentId?: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const { boardName = '', contentId = '' } = await context.searchParams;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedBoardName = normalizeText(boardName).toLowerCase();
  const normalizedContentId = normalizeText(contentId);

  if (!normalizedSiteName || !normalizedBoardName || !normalizedContentId) {
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
      `/api/boards/${normalizedBoardName}/${normalizedContentId}?siteName=${normalizedSiteName}`,
      '게시글 정보를 불러오지 못했습니다.',
    ),
    getSiteApiData<BoardInfoResponse>(
      `/api/boards/${normalizedBoardName}?siteName=${normalizedSiteName}`,
      '게시판 정보를 불러오지 못했습니다.',
    ),
  ]);
  const postType = boardInfo.data?.board?.post_type ?? 'none';
  const [prefixes, series] = await Promise.all([
    postType === 'prefix'
      ? getSiteApiData<PrefixListResponse>(
          `/api/boards/${normalizedBoardName}/prefix?siteName=${normalizedSiteName}`,
          '말머리 목록을 불러오지 못했습니다.',
        )
      : Promise.resolve({ data: null, error: '' }),
    postType === 'series'
      ? getSiteApiData<SeriesListResponse>(
          `/api/boards/${normalizedBoardName}/series?siteName=${normalizedSiteName}`,
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
