import { NextResponse } from 'next/server';
import { getCreatorFollowingTimeline } from '@/lib/creator/following';
import { getAuthorState } from '@/lib/session/author';
import { getCurrentStigma } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';

export async function GET(_: Request, context: { params: Promise<{ handleName: string }> }) {
  const { handleName } = await context.params;
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const authorState = await getAuthorState(currentStigma.stigmaId);
  if (!authorState.isAuthor)
    return NextResponse.json({ message: '작가만 작가들의 서재를 이용할 수 있습니다.' }, { status: 403 });

  try {
    const data = await getCreatorFollowingTimeline(currentStigma.stigmaId);
    if (normalizeText(handleName).toLowerCase() !== data.owner.handleName.toLowerCase()) {
      return NextResponse.json({ message: '본인의 작가들의 서재만 볼 수 있습니다.' }, { status: 403 });
    }
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '작가들의 서재를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
