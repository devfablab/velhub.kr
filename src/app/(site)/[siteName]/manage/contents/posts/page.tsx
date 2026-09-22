import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
import Container from '../../menu';
import Opt, { type BoardContentsResponse, type BoardsResponse, type InitialPostsData } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type SearchContext = RouteContext & { searchParams: Promise<{ page?: string; size?: string; filter?: string }> };
type HeaderResponse = { siteRole?: string | null; globalRole?: string | null };
type StatusResponse = { hasBoard?: boolean; boardName?: string | null };

export default async function Page(context: SearchContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  const supabaseAdmin = getSupabaseAdmin();

  const siteInfo = await supabaseAdmin
    .from('rhizomes')
    .select('site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (!siteInfo.data?.site_type) {
    redirect('/');
  }

  const searchParams = await context.searchParams;
  const page = Number(searchParams.page) > 0 ? Number(searchParams.page) : 1;
  const size = Number(searchParams.size) > 0 ? `&size=${Number(searchParams.size)}` : '';
  const filter = searchParams.filter === 'deleted' ? '&filter=deleted' : '';
  const header = await getSiteApiData<HeaderResponse>(`/api/header/site?siteName=${normalizedSiteName}`, '권한 정보를 불러오지 못했습니다.');
  const isStaff = header.data?.globalRole === 'admin' || header.data?.siteRole === 'owner' || header.data?.siteRole === 'manager';
  let initialData: InitialPostsData | null = null;
  let initialError = header.error;

  if (siteInfo.data.site_type === 'blog') {
    const status = await getSiteApiData<StatusResponse>(`/api/manage/contents/blog-posts/status?siteName=${normalizedSiteName}`, '블로그 상태를 확인하지 못했습니다.');
    initialError ||= status.error;
    if (status.data?.hasBoard && status.data.boardName && !(filter && !isStaff)) {
      const board = await getSiteApiData<BoardContentsResponse>(`/api/boards/${status.data.boardName}?siteName=${normalizedSiteName}&page=${page}${size}${filter}`, '출간된 블로그 글 목록을 불러오지 못했습니다.');
      initialError ||= board.error;
      initialData = {
        siteType: 'blog', isStaff, boards: [], manageContents: null,
        board: board.data?.board ?? null, boardName: status.data.boardName,
        posts: board.data?.contents ?? [], totalPage: board.data?.totalPage ?? 1,
        filter: board.data?.filter === 'deleted' ? 'deleted' : 'all',
      };
    } else {
      initialData = { siteType: 'blog', isStaff, boards: [], manageContents: null, board: null, boardName: null, posts: [], totalPage: 1, filter: 'all' };
    }
  } else {
    const boards = await getSiteApiData<BoardsResponse>(`/api/boards?siteName=${normalizedSiteName}&manageContents=true`, '게시판을 불러오지 못했습니다.');
    initialError ||= boards.error;
    initialData = {
      siteType: 'community', isStaff,
      boards: (boards.data?.boards ?? []).filter((board) => board.board_key !== 'b' && board.board_key !== 'p'),
      manageContents: boards.data?.manageContents ?? null,
      board: null, boardName: null, posts: [], totalPage: 1, filter: 'all',
    };
  }

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage`} menu="contents">
      <Opt initialData={initialData} initialError={initialError} />
    </Container>
  );
}
