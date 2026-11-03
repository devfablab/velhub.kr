import { NextResponse } from 'next/server';
import { getCreatorFollowedLibraries } from '@/lib/creator/following';
import { getCurrentStigma } from '@/lib/session/utils';

export async function GET(_: Request, context: { params: Promise<{ handleName: string }> }) {
  const { handleName } = await context.params;
  const currentStigma = await getCurrentStigma();

  try {
    const data = await getCreatorFollowedLibraries(handleName, currentStigma?.stigmaId ?? null);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : '팔로잉한 서재를 불러오지 못했습니다.' },
      { status: 500 },
    );
  }
}
