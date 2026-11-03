import { getCreatorFollowingTimeline } from '@/lib/creator/following';
import { getAuthorState } from '@/lib/session/author';
import { getCurrentStigma } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';
import Opt, { FollowingResponse } from './opt';

type Props = { params: Promise<{ handleName: string }> };

export default async function Page({ params }: Props) {
  const { handleName } = await params;
  let initialData: FollowingResponse | null = null;
  let initialError = '';

  try {
    const currentStigma = await getCurrentStigma();
    if (!currentStigma) throw new Error('로그인이 필요합니다.');

    const authorState = await getAuthorState(currentStigma.stigmaId);
    if (!authorState.isAuthor) throw new Error('작가만 작가들의 서재를 이용할 수 있습니다.');

    const data = await getCreatorFollowingTimeline(currentStigma.stigmaId);
    if (normalizeText(handleName).toLowerCase() !== data.owner.handleName.toLowerCase()) {
      throw new Error('본인의 작가들의 서재만 볼 수 있습니다.');
    }
    initialData = data;
  } catch (error) {
    initialError = error instanceof Error ? error.message : '작가들의 서재를 불러오지 못했습니다.';
  }

  return <Opt initialData={initialData} initialError={initialError} />;
}
