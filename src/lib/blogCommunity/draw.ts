import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export type BlogCommunityDrawType = 'first_come' | 'random' | null;

export type BlogCommunityDrawSettings = {
  drawType: BlogCommunityDrawType;
  drawLimit: number | null;
  drawEndsAt: string | null;
};

export function normalizeBlogCommunityDraw(value: {
  drawType?: unknown;
  drawLimit?: unknown;
  drawEndsAt?: unknown;
}): BlogCommunityDrawSettings | { error: string } {
  const drawType = value.drawType === 'first_come' || value.drawType === 'random' ? value.drawType : null;
  if (!drawType) return { drawType: null, drawLimit: null, drawEndsAt: null };

  const drawLimit = typeof value.drawLimit === 'number' ? Math.floor(value.drawLimit) : Number(value.drawLimit);
  if (!Number.isInteger(drawLimit) || drawLimit < 1) return { error: '당첨 인원수를 입력해주세요.' };

  if (drawType === 'first_come') return { drawType, drawLimit, drawEndsAt: null };

  const drawEndsAt = normalizeText(typeof value.drawEndsAt === 'string' ? value.drawEndsAt : '');
  const drawEndsAtTime = new Date(drawEndsAt).getTime();
  if (!drawEndsAt || !Number.isFinite(drawEndsAtTime) || drawEndsAtTime <= Date.now())
    return { error: '추첨 마감 일시는 현재보다 이후로 설정해주세요.' };

  return { drawType, drawLimit, drawEndsAt: new Date(drawEndsAt).toISOString() };
}

function shuffle<T>(values: T[]) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }
  return values;
}

export async function registerBlogCommunityFirstComeDraw({
  siteId,
  postId,
  commentId,
  userId,
  drawType,
  drawLimit,
}: {
  siteId: string;
  postId: string;
  commentId: string;
  userId: string;
  drawType: BlogCommunityDrawType;
  drawLimit: number | null;
}) {
  if (drawType !== 'first_come' || !drawLimit) return;

  const supabaseAdmin = getSupabaseAdmin();
  const existing = await supabaseAdmin
    .from('blog_community_post_draws')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .limit(1);
  if (existing.error) throw new Error('추첨 정보를 확인하지 못했습니다.');
  if ((existing.data ?? []).length) return;

  const count = await supabaseAdmin
    .from('blog_community_post_draws')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId);
  if (count.error) throw new Error('추첨 정보를 확인하지 못했습니다.');
  const drawOrder = (count.count ?? 0) + 1;
  if (drawOrder > drawLimit) return;

  const inserted = await supabaseAdmin.from('blog_community_post_draws').insert({
    site_id: siteId,
    post_id: postId,
    comment_id: commentId,
    user_id: userId,
    draw_order: drawOrder,
  });
  if (inserted.error && inserted.error.code !== '23505') throw new Error('추첨 정보를 저장하지 못했습니다.');
}

export async function completeBlogCommunityRandomDraw({
  siteId,
  postId,
  drawType,
  drawLimit,
  drawEndsAt,
}: {
  siteId: string;
  postId: string;
  drawType: BlogCommunityDrawType;
  drawLimit: number | null;
  drawEndsAt: string | null;
}) {
  if (drawType !== 'random' || !drawLimit || !drawEndsAt || new Date(drawEndsAt).getTime() > Date.now()) return;

  const supabaseAdmin = getSupabaseAdmin();
  const existing = await supabaseAdmin.from('blog_community_post_draws').select('id').eq('post_id', postId).limit(1);
  if (existing.error) throw new Error('추첨 정보를 확인하지 못했습니다.');
  if ((existing.data ?? []).length) return;

  const comments = await supabaseAdmin
    .from('blog_community_comments')
    .select('id, user_id')
    .eq('site_id', siteId)
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .eq('is_blinded', false)
    .lte('created_at', drawEndsAt)
    .order('created_at');
  if (comments.error) throw new Error('추첨 대상 댓글을 확인하지 못했습니다.');

  const candidates = new Map<string, { commentId: string; userId: string }>();
  for (const comment of comments.data ?? []) {
    if (!candidates.has(comment.user_id))
      candidates.set(comment.user_id, { commentId: comment.id, userId: comment.user_id });
  }
  const winners = shuffle([...candidates.values()]).slice(0, drawLimit);
  if (!winners.length) return;

  const inserted = await supabaseAdmin.from('blog_community_post_draws').insert(
    winners.map((winner, index) => ({
      site_id: siteId,
      post_id: postId,
      comment_id: winner.commentId,
      user_id: winner.userId,
      draw_order: index + 1,
    })),
  );
  if (inserted.error && inserted.error.code !== '23505') throw new Error('추첨 결과를 저장하지 못했습니다.');
}
