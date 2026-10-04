import { decrypt } from '@/lib/encryption/decrypt';
import {
  getAppellantMessageStatus,
  type GuidelineAppealItem,
  type GuidelineAppealMessage,
  type GuidelineAppealSenderType,
} from '@/lib/reports/guidelineAppeals';
import { guidelineReportCategories } from '@/lib/reports/guidelines';
import { getReportCategoryTitle } from '@/lib/reports/manage';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type GuidelineReportRow = {
  id: string;
  target_type: 'post' | 'comment' | 'blog_community_post' | 'blog_community_comment';
  site_id: string;
  board_id: string | null;
  post_id: string | null;
  comment_id: string | null;
  blog_community_post_id: string | null;
  blog_community_comment_id: string | null;
  report_category: string;
  status: string;
  created_at: string;
};

type PostRow = {
  id: string;
  site_id: string;
  board_id: string;
  slug: string | number;
  user_id: string;
  subject: string | null;
  is_closed: boolean;
  closed_message: string | null;
};

type CommentRow = {
  id: string;
  site_id: string;
  board_id: string;
  post_id: string;
  user_id: string;
  is_deleted: boolean;
  deleted_message: string | null;
};

type BlogCommunityPostRow = {
  id: string;
  site_id: string;
  slug: string;
  user_id: string;
  content: string | null;
  is_deleted: boolean;
  deleted_message: string | null;
};

type BlogCommunityCommentRow = {
  id: string;
  site_id: string;
  post_id: string;
  user_id: string;
  content: string | null;
  is_deleted: boolean;
  deleted_message: string | null;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string | null;
};

type MessageRow = {
  id: string;
  report_id: string;
  sender_user_id: string;
  sender_type: GuidelineAppealSenderType;
  message: string;
  created_at: string;
};

function isGuidelineAppealCategory(value: string) {
  return guidelineReportCategories.includes(value as (typeof guidelineReportCategories)[number]);
}

export type GuidelineAppealContext = {
  report: GuidelineReportRow;
  post: PostRow | BlogCommunityPostRow;
  comment: CommentRow | BlogCommunityCommentRow | null;
  site: SiteRow;
  board: BoardRow | null;
  authorStigmaId: string;
  deletionMessage: string;
};

function decryptName(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  try {
    return decrypt(normalizedValue);
  } catch {
    return '';
  }
}

export async function getGuidelineAppealAuthorName({ siteId, stigmaId }: { siteId: string; stigmaId: string }) {
  const supabaseAdmin = getSupabaseAdmin();
  const stigmaResult = await supabaseAdmin.from('stigmas').select('id, user_name').eq('id', stigmaId).maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return '사용자';
  }

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('nickname')
    .eq('site_id', siteId)
    .eq('user_id', stigmaResult.data.id)
    .maybeSingle();

  if (membershipResult.error) {
    return decryptName(stigmaResult.data.user_name) || '사용자';
  }

  return normalizeText(membershipResult.data?.nickname) || decryptName(stigmaResult.data.user_name) || '사용자';
}

export async function loadGuidelineAppealContext(reportId: string): Promise<GuidelineAppealContext> {
  const supabaseAdmin = getSupabaseAdmin();
  const reportResult = await supabaseAdmin
    .from('report_guidelines')
    .select('id, target_type, site_id, board_id, post_id, comment_id, blog_community_post_id, blog_community_comment_id, report_category, status, created_at')
    .eq('id', reportId)
    .maybeSingle();

  if (reportResult.error || !reportResult.data) {
    throw new Error('신고 내역을 찾을 수 없습니다.');
  }

  const report = reportResult.data as GuidelineReportRow;

  if (
    report.target_type !== 'post' &&
    report.target_type !== 'comment' &&
    report.target_type !== 'blog_community_post' &&
    report.target_type !== 'blog_community_comment'
  ) {
    throw new Error('소명할 수 없는 신고 대상입니다.');
  }

  if (!isGuidelineAppealCategory(report.report_category)) {
    throw new Error('가이드라인 소명 대상이 아닌 신고입니다.');
  }

  if (report.status !== 'completed') {
    throw new Error('처리완료된 신고가 아닙니다.');
  }

  if (report.target_type === 'blog_community_post' || report.target_type === 'blog_community_comment') {
    let comment: BlogCommunityCommentRow | null = null;
    let postId = report.blog_community_post_id;
    if (report.target_type === 'blog_community_comment') {
      if (!report.blog_community_comment_id) throw new Error('신고 대상 댓글 정보가 없습니다.');
      const commentResult = await supabaseAdmin
        .from('blog_community_comments')
        .select('id, site_id, post_id, user_id, content, is_deleted, deleted_message')
        .eq('id', report.blog_community_comment_id)
        .maybeSingle();
      if (commentResult.error || !commentResult.data) throw new Error('신고 대상 댓글을 찾을 수 없습니다.');
      comment = commentResult.data as BlogCommunityCommentRow;
      postId = comment.post_id;
    }
    if (!postId) throw new Error('신고 대상 게시물 정보가 없습니다.');
    const postResult = await supabaseAdmin
      .from('blog_community_posts')
      .select('id, site_id, slug, user_id, content, is_deleted, deleted_message')
      .eq('id', postId)
      .maybeSingle();
    if (postResult.error || !postResult.data) throw new Error('신고 대상 게시물을 찾을 수 없습니다.');
    const post = postResult.data as BlogCommunityPostRow;
    const deletionMessage = normalizeText(
      report.target_type === 'blog_community_comment' ? comment?.deleted_message : post.deleted_message,
    );
    const isDeleted = report.target_type === 'blog_community_comment' ? comment?.is_deleted === true : post.is_deleted === true;
    if (!isDeleted || !deletionMessage) throw new Error('소명할 수 있는 삭제 내역이 아닙니다.');
    const siteResult = await supabaseAdmin.from('rhizomes').select('id, site_key, site_label').eq('id', report.site_id).maybeSingle();
    if (siteResult.error || !siteResult.data) throw new Error('사이트 정보를 불러오지 못했습니다.');
    return { report, post, comment, site: siteResult.data as SiteRow, board: null, authorStigmaId: comment?.user_id ?? post.user_id, deletionMessage };
  }

  let comment: CommentRow | null = null;
  let postId = report.post_id;

  if (report.target_type === 'comment') {
    if (!report.comment_id) {
      throw new Error('신고 대상 댓글 정보가 없습니다.');
    }

    const commentResult = await supabaseAdmin
      .from('post_comments')
      .select('id, site_id, board_id, post_id, user_id, is_deleted, deleted_message')
      .eq('id', report.comment_id)
      .maybeSingle();

    if (commentResult.error || !commentResult.data) {
      throw new Error('신고 대상 댓글을 찾을 수 없습니다.');
    }

    comment = commentResult.data as CommentRow;
    postId = comment.post_id;
  }

  if (!postId) {
    throw new Error('신고 대상 게시물 정보가 없습니다.');
  }

  const postResult = await supabaseAdmin
    .from('posts')
    .select('id, site_id, board_id, slug, user_id, subject, is_closed, closed_message')
    .eq('id', postId)
    .maybeSingle();

  if (postResult.error || !postResult.data) {
    throw new Error('신고 대상 게시물을 찾을 수 없습니다.');
  }

  const post = postResult.data as PostRow;
  const deletionMessage =
    report.target_type === 'comment' ? normalizeText(comment?.deleted_message) : normalizeText(post.closed_message);
  const isDeleted = report.target_type === 'comment' ? comment?.is_deleted === true : post.is_closed === true;

  if (!isDeleted || !deletionMessage) {
    throw new Error('소명할 수 있는 삭제 내역이 아닙니다.');
  }

  const [siteResult, boardResult] = await Promise.all([
    supabaseAdmin.from('rhizomes').select('id, site_key, site_label').eq('id', report.site_id).maybeSingle(),
    supabaseAdmin.from('boards').select('id, board_key, board_label').eq('id', post.board_id).maybeSingle(),
  ]);

  if (siteResult.error || !siteResult.data || boardResult.error || !boardResult.data) {
    throw new Error('사이트 또는 게시판 정보를 불러오지 못했습니다.');
  }

  return {
    report,
    post,
    comment,
    site: siteResult.data as SiteRow,
    board: boardResult.data as BoardRow,
    authorStigmaId: comment?.user_id ?? post.user_id,
    deletionMessage,
  };
}

export async function loadGuidelineAppealMessages(context: GuidelineAppealContext) {
  const supabaseAdmin = getSupabaseAdmin();
  const messagesResult = await supabaseAdmin
    .from('report_guideline_messages')
    .select('id, report_id, sender_user_id, sender_type, message, created_at')
    .eq('report_id', context.report.id)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  if (messagesResult.error) {
    throw new Error('소명 메시지를 불러오지 못했습니다.');
  }

  const authorName = await getGuidelineAppealAuthorName({
    siteId: context.site.id,
    stigmaId: context.authorStigmaId,
  });
  const siteName = context.site.site_label || context.site.site_key;

  return ((messagesResult.data ?? []) as MessageRow[]).map(
    (message): GuidelineAppealMessage => ({
      id: message.id,
      senderType: message.sender_type,
      senderName: message.sender_type === 'staff' ? siteName : authorName,
      message: message.message,
      createdAt: message.created_at,
    }),
  );
}

async function loadBlogCommunityGuidelineAppealItems({ stigmaId, origin }: { stigmaId: string; origin: string }) {
  const supabaseAdmin = getSupabaseAdmin();
  const [postsResult, commentsResult] = await Promise.all([
    supabaseAdmin
      .from('blog_community_posts')
      .select('id, site_id, slug, user_id, content, is_deleted, deleted_message')
      .eq('user_id', stigmaId)
      .eq('is_deleted', true)
      .not('deleted_message', 'is', null),
    supabaseAdmin
      .from('blog_community_comments')
      .select('id, site_id, post_id, user_id, content, is_deleted, deleted_message')
      .eq('user_id', stigmaId)
      .eq('is_deleted', true)
      .not('deleted_message', 'is', null),
  ]);
  if (postsResult.error || commentsResult.error) throw new Error('소명 대상 콘텐츠를 불러오지 못했습니다.');
  const posts = (postsResult.data ?? []) as BlogCommunityPostRow[];
  const comments = (commentsResult.data ?? []) as BlogCommunityCommentRow[];
  const requests = [];
  if (posts.length) requests.push(
    supabaseAdmin
      .from('report_guidelines')
      .select('id, target_type, site_id, board_id, post_id, comment_id, blog_community_post_id, blog_community_comment_id, report_category, status, created_at')
      .eq('target_type', 'blog_community_post').eq('status', 'completed').in('blog_community_post_id', posts.map((post) => post.id)),
  );
  if (comments.length) requests.push(
    supabaseAdmin
      .from('report_guidelines')
      .select('id, target_type, site_id, board_id, post_id, comment_id, blog_community_post_id, blog_community_comment_id, report_category, status, created_at')
      .eq('target_type', 'blog_community_comment').eq('status', 'completed').in('blog_community_comment_id', comments.map((comment) => comment.id)),
  );
  if (!requests.length) return [];
  const reportResults = await Promise.all(requests);
  const reportError = reportResults.find((result) => result.error)?.error;
  if (reportError) throw new Error('신고 내역을 불러오지 못했습니다.');
  const reports = reportResults.flatMap((result) => (result.data ?? []) as GuidelineReportRow[])
    .filter((report) => isGuidelineAppealCategory(report.report_category));
  if (!reports.length) return [];
  const postById = new Map(posts.map((post) => [post.id, post]));
  const commentById = new Map(comments.map((comment) => [comment.id, comment]));
  const missingPostIds = [...new Set(comments.map((comment) => comment.post_id).filter((id) => !postById.has(id)))];
  const [sitesResult, messageResult, commentPostsResult] = await Promise.all([
    supabaseAdmin.from('rhizomes').select('id, site_key, site_label').in('id', [...new Set(reports.map((report) => report.site_id))]),
    supabaseAdmin.from('report_guideline_messages').select('report_id, sender_type, created_at').in('report_id', reports.map((report) => report.id)).order('created_at').order('id'),
    missingPostIds.length
      ? supabaseAdmin.from('blog_community_posts').select('id, site_id, slug, user_id, content, is_deleted, deleted_message').in('id', missingPostIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (sitesResult.error || messageResult.error || commentPostsResult.error) throw new Error('소명 관련 정보를 불러오지 못했습니다.');
  for (const post of (commentPostsResult.data ?? []) as BlogCommunityPostRow[]) postById.set(post.id, post);
  const siteById = new Map(((sitesResult.data ?? []) as SiteRow[]).map((site) => [site.id, site]));
  const lastSenderByReport = new Map<string, GuidelineAppealSenderType>();
  for (const message of (messageResult.data ?? []) as Pick<MessageRow, 'report_id' | 'sender_type'>[]) lastSenderByReport.set(message.report_id, message.sender_type);
  return reports.flatMap((report): GuidelineAppealItem[] => {
    const comment = report.blog_community_comment_id ? commentById.get(report.blog_community_comment_id) : null;
    const post = postById.get(report.blog_community_post_id ?? comment?.post_id ?? '');
    const site = siteById.get(report.site_id);
    if (!post || !site) return [];
    const isComment = report.target_type === 'blog_community_comment';
    const deletionMessage = normalizeText(isComment ? comment?.deleted_message : post.deleted_message);
    if (!deletionMessage) return [];
    return [{
      reportId: report.id,
      reportName: getReportCategoryTitle(isComment ? 'comment' : 'post', report.report_category),
      targetType: report.target_type,
      targetLabel: isComment ? '댓글' : '커뮤니티 글',
      reportUrl: new URL(`/${site.site_key}/community-on-blog/${post.slug}`, origin).toString(),
      reportedAt: report.created_at,
      siteName: site.site_key,
      siteLabel: site.site_label || site.site_key,
      boardName: 'community-on-blog',
      boardLabel: '커뮤니티',
      postTitle: '커뮤니티 글',
      messageStatus: getAppellantMessageStatus(lastSenderByReport.get(report.id) ?? null),
    }];
  });
}

export async function loadGuidelineAppealItems({ stigmaId, origin }: { stigmaId: string; origin: string }) {
  const supabaseAdmin = getSupabaseAdmin();
  const blogItemsPromise = loadBlogCommunityGuidelineAppealItems({ stigmaId, origin });
  const [postsResult, commentsResult] = await Promise.all([
    supabaseAdmin
      .from('posts')
      .select('id, site_id, board_id, slug, user_id, subject, is_closed, closed_message')
      .eq('user_id', stigmaId)
      .eq('is_closed', true)
      .not('closed_message', 'is', null),
    supabaseAdmin
      .from('post_comments')
      .select('id, site_id, board_id, post_id, user_id, is_deleted, deleted_message')
      .eq('user_id', stigmaId)
      .eq('is_deleted', true)
      .not('deleted_message', 'is', null),
  ]);

  if (postsResult.error || commentsResult.error) {
    throw new Error('소명 대상 콘텐츠를 불러오지 못했습니다.');
  }

  const posts = (postsResult.data ?? []) as PostRow[];
  const comments = (commentsResult.data ?? []) as CommentRow[];
  const postIds = posts.map((post) => post.id);
  const commentIds = comments.map((comment) => comment.id);
  const reportRequests = [];

  if (postIds.length) {
    reportRequests.push(
      supabaseAdmin
        .from('report_guidelines')
        .select('id, target_type, site_id, board_id, post_id, comment_id, report_category, status, created_at')
        .eq('target_type', 'post')
        .eq('status', 'completed')
        .in('post_id', postIds),
    );
  }

  if (commentIds.length) {
    reportRequests.push(
      supabaseAdmin
        .from('report_guidelines')
        .select('id, target_type, site_id, board_id, post_id, comment_id, report_category, status, created_at')
        .eq('target_type', 'comment')
        .eq('status', 'completed')
        .in('comment_id', commentIds),
    );
  }

  if (!reportRequests.length) {
    return blogItemsPromise;
  }

  const reportResults = await Promise.all(reportRequests);
  const reportError = reportResults.find((result) => result.error)?.error;

  if (reportError) {
    throw new Error('신고 내역을 불러오지 못했습니다.');
  }

  const reports = reportResults.flatMap((result) => (result.data ?? []) as GuidelineReportRow[]);
  const reportIds = reports.map((report) => report.id);
  const siteIds = [...new Set(reports.map((report) => report.site_id))];
  const boardIds = [
    ...new Set(
      [
        ...reports.map((report) => report.board_id),
        ...posts.map((post) => post.board_id),
        ...comments.map((comment) => comment.board_id),
      ].filter((id): id is string => Boolean(id)),
    ),
  ];
  const commentPostIds = comments.map((comment) => comment.post_id);
  const missingPostIds = commentPostIds.filter((postId) => !posts.some((post) => post.id === postId));

  const [sitesResult, boardsResult, messageResult, commentPostsResult] = await Promise.all([
    supabaseAdmin.from('rhizomes').select('id, site_key, site_label').in('id', siteIds),
    supabaseAdmin.from('boards').select('id, board_key, board_label').in('id', boardIds),
    supabaseAdmin
      .from('report_guideline_messages')
      .select('id, report_id, sender_type, created_at')
      .in('report_id', reportIds)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true }),
    missingPostIds.length
      ? supabaseAdmin
          .from('posts')
          .select('id, site_id, board_id, slug, user_id, subject, is_closed, closed_message')
          .in('id', missingPostIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (sitesResult.error || boardsResult.error || messageResult.error || commentPostsResult.error) {
    throw new Error('소명 관련 정보를 불러오지 못했습니다.');
  }

  const allPosts = [...posts, ...((commentPostsResult.data ?? []) as PostRow[])];
  const postById = new Map(allPosts.map((post) => [post.id, post]));
  const commentById = new Map(comments.map((comment) => [comment.id, comment]));
  const siteById = new Map(((sitesResult.data ?? []) as SiteRow[]).map((site) => [site.id, site]));
  const boardById = new Map(((boardsResult.data ?? []) as BoardRow[]).map((board) => [board.id, board]));
  const lastSenderByReport = new Map<string, GuidelineAppealSenderType>();

  for (const message of (messageResult.data ?? []) as Pick<
    MessageRow,
    'id' | 'report_id' | 'sender_type' | 'created_at'
  >[]) {
    lastSenderByReport.set(message.report_id, message.sender_type);
  }

  const normalItems = reports
    .filter((report) => isGuidelineAppealCategory(report.report_category))
    .flatMap((report): GuidelineAppealItem[] => {
      const comment = report.comment_id ? commentById.get(report.comment_id) : null;
      const post = postById.get(report.post_id ?? comment?.post_id ?? '');
      const site = siteById.get(report.site_id);
      const board = post ? boardById.get(post.board_id) : null;
      const deletionMessage =
        report.target_type === 'comment'
          ? normalizeText(comment?.deleted_message)
          : normalizeText(post?.closed_message);

      if (!post || !site || !board || !deletionMessage) {
        return [];
      }

      const reportUrl = new URL(`/${site.site_key}/${board.board_key}/${post.slug}`, origin).toString();

      return [
        {
          reportId: report.id,
          reportName: getReportCategoryTitle(report.target_type, report.report_category),
          targetType: report.target_type,
          targetLabel: report.target_type === 'post' ? post.subject || '제목 없음' : '댓글',
          reportUrl,
          reportedAt: report.created_at,
          siteName: site.site_key,
          siteLabel: site.site_label || site.site_key,
          boardName: board.board_key,
          boardLabel: board.board_label || board.board_key,
          postTitle: post.subject || '제목 없음',
          messageStatus: getAppellantMessageStatus(lastSenderByReport.get(report.id) ?? null),
        },
      ];
    })
    .sort((first, second) => second.reportedAt.localeCompare(first.reportedAt));
  const blogItems = await blogItemsPromise;
  return [...normalItems, ...blogItems].sort((first, second) => second.reportedAt.localeCompare(first.reportedAt));
}
