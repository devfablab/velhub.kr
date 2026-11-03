import { NextResponse } from 'next/server';
import { getAuthorState } from '@/lib/session/author';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

async function getFollowTarget(handleName: string, currentStigmaId: string) {
  const authorState = await getAuthorState(currentStigmaId);
  if (!authorState.isAuthor) {
    return { error: NextResponse.json({ message: '작가만 서재를 팔로우할 수 있습니다.' }, { status: 403 }) };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const creatorResult = await supabaseAdmin
    .from('creators')
    .select('id, user_id')
    .eq('handle_name', handleName.trim().toLowerCase())
    .maybeSingle();

  if (creatorResult.error) {
    return { error: NextResponse.json({ message: '작가 프로필을 불러오지 못했습니다.' }, { status: 500 }) };
  }
  if (!creatorResult.data) {
    return { error: NextResponse.json({ message: '작가 프로필을 찾을 수 없습니다.' }, { status: 404 }) };
  }
  if (creatorResult.data.user_id === currentStigmaId) {
    return { error: NextResponse.json({ message: '내 서재는 팔로우할 수 없습니다.' }, { status: 400 }) };
  }

  return { supabaseAdmin, creatorId: creatorResult.data.id };
}

export async function POST(_: Request, context: { params: Promise<{ handleName: string }> }) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const { handleName } = await context.params;
  const target = await getFollowTarget(handleName, currentStigma.stigmaId);
  if ('error' in target) return target.error;

  const result = await target.supabaseAdmin
    .from('creator_follows')
    .upsert(
      { follower_id: currentStigma.stigmaId, creator_id: target.creatorId },
      { onConflict: 'follower_id,creator_id' },
    );
  if (result.error) return NextResponse.json({ message: '서재를 팔로우하지 못했습니다.' }, { status: 500 });

  return NextResponse.json({ isFollowing: true });
}

export async function DELETE(_: Request, context: { params: Promise<{ handleName: string }> }) {
  const currentStigma = await getCurrentStigma();
  if (!currentStigma) return NextResponse.json({ message: '로그인이 필요합니다.' }, { status: 401 });

  const { handleName } = await context.params;
  const target = await getFollowTarget(handleName, currentStigma.stigmaId);
  if ('error' in target) return target.error;

  const result = await target.supabaseAdmin
    .from('creator_follows')
    .delete()
    .eq('follower_id', currentStigma.stigmaId)
    .eq('creator_id', target.creatorId);
  if (result.error) return NextResponse.json({ message: '서재 팔로우를 취소하지 못했습니다.' }, { status: 500 });

  return NextResponse.json({ isFollowing: false });
}
