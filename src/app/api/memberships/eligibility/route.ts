import { NextResponse } from 'next/server';
import { getAuthorState } from '@/lib/session/author';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const currentStigma = await getCurrentStigma();

  if (!currentStigma) {
    return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const [siteResult, identityResult] = await Promise.all([
    supabaseAdmin.from('rhizomes').select('id').eq('owner_id', currentStigma.stigmaId).eq('is_shutdown', false),
    supabaseAdmin.from('chorogons').select('id').eq('user_id', currentStigma.stigmaId).maybeSingle(),
  ]);

  if (siteResult.error || identityResult.error) {
    return NextResponse.json({ message: '멤버십 이용 조건을 확인하지 못했습니다.' }, { status: 500 });
  }

  const { isAuthor } = await getAuthorState(currentStigma.stigmaId);

  const hasOperatingSite = (siteResult.data?.length ?? 0) > 0;

  return NextResponse.json({
    hasOperatingSite,
    isAuthor,
    owner: {
      available: hasOperatingSite,
      message: hasOperatingSite ? null : '유료 기능은 운영 중인 사이트가 있을 때 이용할 수 있습니다.',
    },
    creator: {
      available: isAuthor,
      message: isAuthor ? null : '유료 기능은 작가만 이용할 수 있습니다.',
    },
    allInOne: {
      available: hasOperatingSite && isAuthor,
      message:
        hasOperatingSite && isAuthor
          ? null
          : '올인원 유료 기능은 운영 중인 사이트가 있고 작가인 경우 이용할 수 있습니다.',
    },
  });
}
