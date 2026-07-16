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
  const memberStigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('user_id')
    .eq('id', memberStigmaId)
    .maybeSingle();

  if (memberStigmaResult.error || !memberStigmaResult.data?.user_id) {
    throw new Error('사용자 정보를 불러오지 못했습니다.');
  }

  const closedAt = new Date().toISOString();
  const memberUserId = memberStigmaResult.data.user_id;

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
      .eq('user_id', memberUserId),
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
      .eq('user_id', memberUserId),
  ]);

  if (postsResult.error) {
    throw new Error('작성한 글 삭제 처리에 실패했습니다.');
  }

  if (commentsResult.error) {
    throw new Error('작성한 댓글 삭제 처리에 실패했습니다.');
  }
}
