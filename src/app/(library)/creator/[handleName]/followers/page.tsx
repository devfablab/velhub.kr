import { redirect } from 'next/navigation';
import { getCreatorFollowedLibraries } from '@/lib/service/lounge/creatorFollowing';
import { getCurrentStigma } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';
import Opt, { FollowersResponse } from './opt';

type Props = { params: Promise<{ handleName: string }>; searchParams: Promise<{ fromUser?: string }> };

export default async function Page({ params, searchParams }: Props) {
  const { handleName } = await params;
  const { fromUser } = await searchParams;
  const returnToUserHandle = normalizeText(fromUser).toLowerCase() || null;
  let initialData: FollowersResponse | null = null;
  let initialError = '';

  try {
    const currentStigma = await getCurrentStigma();
    initialData = await getCreatorFollowedLibraries(handleName, currentStigma?.stigmaId ?? null);
    if (initialData.isOwner) {
      redirect(
        `/creator/${initialData.owner.handleName}/following${returnToUserHandle ? `?fromUser=${encodeURIComponent(returnToUserHandle)}` : ''}`,
      );
    }
  } catch (error) {
    initialError = error instanceof Error ? error.message : '팔로잉한 서재를 불러오지 못했습니다.';
  }

  return <Opt initialData={initialData} initialError={initialError} returnToUserHandle={returnToUserHandle} />;
}
