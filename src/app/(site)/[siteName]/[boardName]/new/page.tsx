import { notFound } from 'next/navigation';
import { assertCommunityBoardWritePermission, assertCommunityPostWritePolicy } from '@/lib/community/policies';
import verifySession from '@/lib/session/verifySession';
import { getSiteGuidelineDialogData } from '@/lib/siteGuidelines/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getSiteApiData } from '../../../getSiteApiData';
import Opt, {
  type BoardInfoResponse,
  type BoardsResponse,
  type PrefixListResponse,
  type SeriesListResponse,
} from './opt';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    siteName: string;
    boardName: string;
  }>;
  searchParams: Promise<{
    seriesName?: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName, boardName } = await context.params;
  const searchParams = await context.searchParams;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const requestedSeriesName = normalizeText(searchParams.seriesName).toLowerCase();

  if (!normalizedSiteName) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizomeResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizomeResult.error || !rhizomeResult.data) {
    notFound();
  }

  const communityResult = await supabaseAdmin
    .from('communities')
    .select('id')
    .eq('site_id', rhizomeResult.data.id)
    .maybeSingle();
  const isCommunity = rhizomeResult.data.site_type === 'community' || Boolean(communityResult.data);
  let writePolicyMessage = '';
  let writePolicyAction: { href: string; label: string } | undefined;

  if (isCommunity) {
    const session = await verifySession({
      siteId: rhizomeResult.data.id,
    });

    if (!session.authUserId || !session.stigmaId) {
      writePolicyMessage = '로그인 후 글을 작성할 수 있습니다.';
      writePolicyAction = { href: '/auth/sign-in', label: '로그인하기' };
    } else if (session.case === 'pending-member') {
      writePolicyMessage = '가입 승인까지 기다려 주세요.';
      writePolicyAction = { href: `/${siteName}`, label: '홈 이동' };
    } else {
      try {
        await assertCommunityPostWritePolicy({
          siteId: rhizomeResult.data.id,
          stigmaId: session.stigmaId,
          sessionCase: session.case,
        });
      } catch (unknownError) {
        writePolicyMessage =
          unknownError instanceof Error
            ? unknownError.message || '글 작성 권한이 없습니다.'
            : '글 작성 권한이 없습니다.';
      }
    }
  }

  const initialBoards = await getSiteApiData<BoardsResponse>(
    `/api/boards/write?siteName=${normalizedSiteName}`,
    '게시판 목록을 불러오지 못했습니다.',
  );
  const currentBoard = (initialBoards.data?.boards ?? []).find(
    (board) => board.is_active && board.board_type !== 'page' && board.board_key === boardName.toLowerCase(),
  );

  const requestedBoard = await supabaseAdmin
    .from('boards')
    .select('id, write_permission')
    .eq('site_id', rhizomeResult.data.id)
    .eq('board_key', boardName.toLowerCase())
    .maybeSingle();

  if (isCommunity && !writePolicyMessage) {
    if (!currentBoard) {
      writePolicyMessage =
        requestedBoard.data?.write_permission === 'manager'
          ? '매니저 전용 게시판입니다.'
          : '글 쓰기 권한이 없는 게시판입니다.';
      writePolicyAction = { href: `/${siteName}`, label: '홈 이동' };
    } else {
      const session = await verifySession({
        siteId: rhizomeResult.data.id,
      });

      if (!session.stigmaId) {
        writePolicyMessage = '로그인 후 글을 작성할 수 있습니다.';
        writePolicyAction = { href: '/auth/sign-in', label: '로그인하기' };
      } else {
        try {
          await assertCommunityBoardWritePermission({
            siteId: rhizomeResult.data.id,
            boardId: currentBoard.id,
            stigmaId: session.stigmaId,
            sessionCase: session.case,
          });
        } catch (unknownError) {
          writePolicyMessage =
            unknownError instanceof Error
              ? unknownError.message || '글 작성 권한이 없습니다.'
              : '글 작성 권한이 없습니다.';
          writePolicyAction = { href: `/${siteName}`, label: '홈 이동' };
        }
      }
    }
  }

  const initialBoardInfo = currentBoard
    ? await getSiteApiData<BoardInfoResponse>(
        `/api/boards/${currentBoard.board_key}?siteName=${normalizedSiteName}`,
        '게시판 정보를 불러오지 못했습니다.',
      )
    : { data: null, error: '접근 권한이 없습니다.' };
  const [initialPrefixes, initialSeries] = await Promise.all([
    currentBoard && initialBoardInfo.data?.board?.post_type === 'prefix'
      ? getSiteApiData<PrefixListResponse>(
          `/api/boards/${currentBoard.board_key}/prefix?siteName=${normalizedSiteName}`,
          '말머리 목록을 불러오지 못했습니다.',
        )
      : Promise.resolve({ data: null, error: '' }),
    currentBoard && ['series', 'both'].includes(initialBoardInfo.data?.board?.post_type ?? 'none')
      ? getSiteApiData<SeriesListResponse>(
          `/api/boards/${currentBoard.board_key}/series?siteName=${normalizedSiteName}`,
          '연재 목록을 불러오지 못했습니다.',
        )
      : Promise.resolve({ data: null, error: '' }),
  ]);
  const initialSeriesName =
    initialSeries.data?.series?.some(
      (series) => series.series_key === requestedSeriesName && series.is_completed !== true,
    ) === true
      ? requestedSeriesName
      : '';
  const initialError = initialBoards.error || initialBoardInfo.error || initialPrefixes.error || initialSeries.error;
  const guidelineDialogData =
    isCommunity && currentBoard
      ? await getSiteGuidelineDialogData({
          siteName: normalizedSiteName,
          target: 'board',
          boardId: currentBoard.id,
        })
      : null;

  return (
    <Opt
      isCommunity={isCommunity}
      writePolicyMessage={writePolicyMessage}
      writePolicyAction={writePolicyAction}
      initialBoards={initialBoards.data}
      initialBoardInfo={initialBoardInfo.data}
      initialPrefixes={initialPrefixes.data}
      initialSeries={initialSeries.data}
      initialSeriesName={initialSeriesName}
      initialError={initialError}
      guidelineDialogData={guidelineDialogData}
    />
  );
}
