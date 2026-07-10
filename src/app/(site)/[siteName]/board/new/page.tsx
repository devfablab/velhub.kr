import { notFound } from 'next/navigation';
import { assertCommunityPostWritePolicy } from '@/lib/community/policies';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Opt from './opt';
import Container from '../../menu';

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

  const isCommunity = rhizomeResult.data.site_type === 'community';

  let writePolicyMessage = '';

  if (isCommunity) {
    const session = await verifySession({
      siteId: rhizomeResult.data.id,
    });

    if (!session.authUserId) {
      writePolicyMessage = '로그인 후 글을 작성할 수 있습니다.';
    } else {
      try {
        await assertCommunityPostWritePolicy({
          siteId: rhizomeResult.data.id,
          authUserId: session.authUserId,
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
  return (
    <Container pageBack={`/${siteName}/board`} pageTitle="새글 쓰기" pageFin>
      <Opt isCommunity={isCommunity} writePolicyMessage={writePolicyMessage} />
    </Container>
  );
}
