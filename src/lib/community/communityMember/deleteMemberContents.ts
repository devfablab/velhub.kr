import { getSupabaseAdmin } from '@/lib/supabase';

type CloseMemberContentsParams = {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  siteId: string;
  memberStigmaId: string;
  managerStigmaId: string;
  closedMessage: string;
};

export async function deleteMemberContents({
  supabaseAdmin,
  siteId,
  memberStigmaId,
  managerStigmaId,
  closedMessage,
}: CloseMemberContentsParams) {
  const closedAt = new Date().toISOString();

  const [postsResult, commentsResult] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .update({
        is_closed: true,
        is_locked: true,
        closed_by: managerStigmaId,
        closed_at: closedAt,
        closed_message: closedMessage,
      })
      .eq('site_id', siteId)
      .eq('user_id', memberStigmaId),
    supabaseAdmin
      .from('post_comments')
      .update({
        is_deleted: true,
        is_locked: true,
        deleted_by: managerStigmaId,
        deleted_at: closedAt,
        deleted_message: closedMessage,
      })
      .eq('site_id', siteId)
      .eq('user_id', memberStigmaId),
  ]);

  if (postsResult.error) {
    throw new Error('작성한 글 삭제 처리에 실패했습니다.');
  }

  if (commentsResult.error) {
    throw new Error('작성한 댓글 삭제 처리에 실패했습니다.');
  }
}
