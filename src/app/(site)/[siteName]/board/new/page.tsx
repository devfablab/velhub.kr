import { notFound } from 'next/navigation';
import { assertCommunityPostWritePolicy } from '@/lib/community/policies';
import verifySession from '@/lib/session/verifySession';
import { getCommunityBoardGuidelineDialogDataByBoard } from '@/lib/siteGuidelines/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { getSiteApiData } from '../../../getSiteApiData';
import Container from '../../menu';
import Opt, { type BoardsResponse } from './opt';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{
    siteName: string;
    boardName: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

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
  const guidelineDialogDataByBoard = isCommunity
    ? await getCommunityBoardGuidelineDialogDataByBoard({
        siteName: normalizedSiteName,
        boardIds: (initialBoards.data?.writeBoards ?? initialBoards.data?.boards ?? []).map((board) => board.id),
      })
    : {};
  return (
    <Container pageBack={`/${siteName}/board`} pageTitle="새글 쓰기" pageFin>
      <Opt
        isCommunity={isCommunity}
        writePolicyMessage={writePolicyMessage}
        writePolicyAction={writePolicyAction}
        initialBoards={initialBoards.data}
        initialError={initialBoards.error}
        guidelineDialogDataByBoard={guidelineDialogDataByBoard}
      />
    </Container>
  );
}
