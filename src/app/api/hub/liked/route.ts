import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getHubPostDisplayMap } from '@/lib/service/hub/postDisplay';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';

type PostLikeRow = { id: string; created_at: string; post_id: string };
type CommentLikeRow = { id: string; created_at: string; post_id: string; comment_id: string };
type CommentRow = {
  id: string;
  content: string | null;
  is_deleted: boolean;
  is_blinded: boolean;
  is_wording_blinded: boolean;
};

function normalizeSiteType(value: string | null): SiteType | null {
  return value === 'blog' || value === 'community' ? value : null;
}

function truncateText(value: string, maxLength: number) {
  const normalizedValue = normalizeText(value);

  return normalizedValue.length <= maxLength ? normalizedValue : `${normalizedValue.slice(0, maxLength)}…`;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteType = normalizeSiteType(normalizeText(requestUrl.searchParams.get('siteType')).toLowerCase());

    if (!siteType) return Response.json({ error: 'siteType이 유효하지 않습니다.' }, { status: 400 });

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) return Response.json({ postLikes: [], commentLikes: [] });

    const supabaseAdmin = getSupabaseAdmin();
    const [postLikesResult, commentLikesResult] = await Promise.all([
      supabaseAdmin
        .from('post_likes')
        .select('id, created_at, post_id')
        .eq('user_id', session.stigmaId ?? '')
        .order('created_at', { ascending: false })
        .limit(50),
      supabaseAdmin
        .from('comment_likes')
        .select('id, created_at, post_id, comment_id')
        .eq('user_id', session.stigmaId ?? '')
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    if (postLikesResult.error || commentLikesResult.error) {
      return Response.json({ error: '좋아요 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const postLikes = (postLikesResult.data ?? []) as PostLikeRow[];
    const commentLikes = (commentLikesResult.data ?? []) as CommentLikeRow[];
    const [postMap, commentsResult] = await Promise.all([
      getHubPostDisplayMap({
        postIds: [...postLikes.map((like) => like.post_id), ...commentLikes.map((like) => like.post_id)],
        siteType,
        viewerStigmaId: session.stigmaId,
      }),
      commentLikes.length > 0
        ? supabaseAdmin
            .from('post_comments')
            .select('id, content, is_deleted, is_blinded, is_wording_blinded')
            .in(
              'id',
              commentLikes.map((like) => like.comment_id),
            )
        : { data: [], error: null },
    ]);

    if (commentsResult.error) return Response.json({ error: '좋아요 목록을 불러오지 못했습니다.' }, { status: 500 });

    const commentMap = new Map((commentsResult.data ?? []).map((comment) => [comment.id, comment as CommentRow]));

    return Response.json({
      postLikes: postLikes.flatMap((like) => {
        const post = postMap.get(like.post_id);

        return post && post.isPublished && !post.isClosed ? [{ id: like.id, likedAt: like.created_at, post }] : [];
      }),
      commentLikes: commentLikes.flatMap((like) => {
        const post = postMap.get(like.post_id);
        const comment = commentMap.get(like.comment_id);

        if (!post || !post.isPublished || post.isClosed || !comment || comment.is_deleted || comment.is_blinded)
          return [];

        return [
          {
            id: like.id,
            likedAt: like.created_at,
            comment: comment.is_wording_blinded
              ? '워딩 프로파일러에 의해 비공개 처리된 댓글입니다'
              : truncateText(comment.content ?? '', 127),
            post,
          },
        ];
      }),
    });
  } catch (unknownError) {
    return Response.json(
      {
        error:
          unknownError instanceof Error
            ? unknownError.message || '좋아요 목록을 불러오지 못했습니다.'
            : '좋아요 목록을 불러오지 못했습니다.',
      },
      { status: 500 },
    );
  }
}
