import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption/decrypt';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    boardName: string;
    contentId: string;
  }>;
};

type AuthorRole =
  | 'owner'
  | 'community-manager'
  | 'board-manager'
  | 'board-general-manager'
  | 'board-assistant-manager'
  | 'member';

type AuthorManageRole = {
  role: Exclude<AuthorRole, 'owner' | 'member'>;
  boardId: string | null;
};

type AuthorManageIcon = {
  role: Exclude<AuthorRole, 'member'>;
  icon: string | null;
  iconUrl: string;
};

type AuthorLevel = {
  id: string;
  lv: number;
  name: string;
  icon: string | null;
  iconUrl: string;
};

type CommentRow = {
  id: string;
  created_at: string;
  site_id: string;
  board_id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  reply_to_id: string | null;
  content: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  is_blinded: boolean;
  blinded_at: string | null;
  blinded_by: string | null;
  blinded_message: string | null;
};

type CommentItem = {
  id: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  reply_to_id: string | null;
  reply_to_author_name: string;
  content: string;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  is_blinded: boolean;
  blinded_at: string | null;
  blinded_by: string | null;
  blinded_message: string | null;
  author_name: string;
  author_avatar_url: string;
  author_level: AuthorLevel | null;
  author_role: AuthorRole;
  author_manage_roles: AuthorManageRole[];
  author_manage_icon: AuthorManageIcon | null;
  is_author: boolean;
  is_me: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_blind: boolean;
  can_unblind: boolean;
  poll_choice: PollChoice | null;
  like_count: number;
  is_liked: boolean;
  replies: CommentItem[];
};

type RequestBody = {
  siteName?: string | null;
  content?: string | null;
  parentId?: string | null;
};

type LevelRow = {
  id: string;
  lv: number;
  icon: string | null;
  name: string | null;
};

type PollOptionRow = {
  id: number;
  label: string;
};

type PollRow = {
  question: string;
  anonymity?: 'anonymous' | 'named';
  options: PollOptionRow[];
};

type PollChoice = {
  option_index: number;
  label: string;
};

type DrawType = 'first_come' | 'random' | null;

const AVATAR_BUCKET = 'avatar';
const LEVEL_ICON_BUCKET = 'lv-icon';
const MANAGER_ICON_BUCKET = 'manager_icon';

function isNumericSlug(value: string) {
  return /^\d+$/.test(value);
}

function isExternalUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://');
}

function getStoragePath(value: string | null | undefined) {
  if (!value) {
    return '';
  }

  return value.trim();
}

function getAvatarUrl(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  if (isExternalUrl(normalizedValue)) {
    return normalizedValue;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(AVATAR_BUCKET).getPublicUrl(normalizedValue);

  return publicUrl.data.publicUrl ?? '';
}

function getLevelIconUrl(value: string | null | undefined) {
  const targetPath = getStoragePath(value);

  if (!targetPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(LEVEL_ICON_BUCKET).getPublicUrl(targetPath);

  return publicUrl.data.publicUrl ?? '';
}

function getManagerIconUrl(value: string | null | undefined) {
  const targetPath = normalizeText(value);

  if (!targetPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from(MANAGER_ICON_BUCKET).getPublicUrl(targetPath);

  return publicUrl.data.publicUrl ?? '';
}

function isManageRole(value: string): value is AuthorManageRole['role'] {
  return (
    value === 'community-manager' ||
    value === 'board-manager' ||
    value === 'board-general-manager' ||
    value === 'board-assistant-manager'
  );
}

async function getUserDisplayInfo(siteId: string, boardId: string, userId: string | null | undefined) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    return {
      name: '',
      avatarUrl: '',
      level: null,
      role: 'member' as AuthorRole,
      manageRoles: [] as AuthorManageRole[],
      manageIcon: null as AuthorManageIcon | null,
    };
  }

  const supabaseAdmin = getSupabaseAdmin();

  const stigmaByIdResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id, user_name, avatar')
    .eq('id', normalizedUserId)
    .maybeSingle();

  const stigmaByAuthIdResult = stigmaByIdResult.data
    ? null
    : await supabaseAdmin
        .from('stigmas')
        .select('id, user_id, user_name, avatar')
        .eq('user_id', normalizedUserId)
        .maybeSingle();

  const stigma = stigmaByIdResult.data ?? stigmaByAuthIdResult?.data ?? null;
  const stigmaId = normalizeText(stigma?.id);

  const membershipResult = stigmaId
    ? await supabaseAdmin
        .from('rhizome_stigmas')
        .select('id, nickname, lv, role')
        .eq('site_id', siteId)
        .eq('user_id', stigmaId)
        .maybeSingle()
    : await supabaseAdmin
        .from('rhizome_stigmas')
        .select('id, nickname, lv, role')
        .eq('site_id', siteId)
        .eq('user_id', normalizedUserId)
        .maybeSingle();

  const rhizomeStigmaId = normalizeText(membershipResult.data?.id);
  const baseRole = normalizeText(membershipResult.data?.role);
  const levelId = normalizeText(membershipResult.data?.lv);

  let name = '';
  let avatarUrl = '';
  let role: AuthorRole = baseRole === 'owner' ? 'owner' : 'member';
  let manageRoles: AuthorManageRole[] = [];
  let manageIcon: AuthorManageIcon | null = null;
  let level: AuthorLevel | null = null;

  if (!membershipResult.error && membershipResult.data?.nickname) {
    name = normalizeText(membershipResult.data.nickname);
  }

  if (levelId) {
    const levelResult = await supabaseAdmin
      .from('community_levels')
      .select('id, lv, icon, name')
      .eq('site_id', siteId)
      .eq('id', levelId)
      .maybeSingle();

    if (!levelResult.error && levelResult.data) {
      const levelData = levelResult.data as LevelRow;

      level = {
        id: levelData.id,
        lv: Number(levelData.lv),
        name: normalizeText(levelData.name) || String(levelData.lv),
        icon: levelData.icon,
        iconUrl: getLevelIconUrl(levelData.icon),
      };
    }
  }

  if (rhizomeStigmaId) {
    const communityResult = await supabaseAdmin.from('communities').select('id').eq('site_id', siteId).maybeSingle();

    if (!communityResult.error && communityResult.data?.id) {
      const manageRoleResult = await supabaseAdmin
        .from('community_manage_role')
        .select('role, board_id')
        .eq('community_id', communityResult.data.id)
        .eq('manager_id', rhizomeStigmaId);

      if (!manageRoleResult.error) {
        manageRoles = (manageRoleResult.data ?? [])
          .map((row) => {
            const manageRole = normalizeText(row.role);

            if (!isManageRole(manageRole)) {
              return null;
            }

            return {
              role: manageRole,
              boardId: row.board_id ?? null,
            };
          })
          .filter((item): item is AuthorManageRole => Boolean(item));

        if (role !== 'owner') {
          const communityWideRole = manageRoles.find(
            (item) => item.role === 'community-manager' || item.role === 'board-manager',
          );

          const boardRole = manageRoles.find(
            (item) =>
              item.boardId === boardId &&
              (item.role === 'board-general-manager' || item.role === 'board-assistant-manager'),
          );

          role = communityWideRole?.role ?? boardRole?.role ?? 'member';
        }
      }
    }
  }

  if (role !== 'member') {
    const managerIconResult = await supabaseAdmin
      .from('community_manage_icons')
      .select('role, icon')
      .eq('site_id', siteId)
      .eq('role', role)
      .maybeSingle();

    if (!managerIconResult.error && managerIconResult.data) {
      const iconPath = normalizeText(managerIconResult.data.icon);

      manageIcon = {
        role,
        icon: iconPath || null,
        iconUrl: getManagerIconUrl(iconPath),
      };
    }
  }

  if (stigma) {
    avatarUrl = getAvatarUrl(stigma.avatar ?? null);

    if (!name && stigma.user_name) {
      try {
        name = decrypt(stigma.user_name as string);
      } catch {
        name = '';
      }
    }
  }

  return {
    name,
    avatarUrl,
    level,
    role,
    manageRoles,
    manageIcon,
  };
}

async function getCommentAccess(siteId: string, boardId: string, userId: string | null, sessionCase: string) {
  if (sessionCase === 'staff' || sessionCase === 'admin') {
    return true;
  }

  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    return false;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const stigmaByAuthIdResult = await supabaseAdmin
    .from('stigmas')
    .select('id')
    .eq('user_id', normalizedUserId)
    .maybeSingle();

  const stigmaId = normalizeText(stigmaByAuthIdResult.data?.id) || normalizedUserId;

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, role')
    .eq('site_id', siteId)
    .eq('user_id', stigmaId)
    .maybeSingle();

  if (membershipResult.error || !membershipResult.data) {
    return false;
  }

  if (membershipResult.data.role === 'owner') {
    return true;
  }

  const communityResult = await supabaseAdmin.from('communities').select('id').eq('site_id', siteId).maybeSingle();

  if (communityResult.error || !communityResult.data?.id) {
    return false;
  }

  const manageRoleResult = await supabaseAdmin
    .from('community_manage_role')
    .select('role, board_id')
    .eq('community_id', communityResult.data.id)
    .eq('manager_id', membershipResult.data.id);

  if (manageRoleResult.error) {
    return false;
  }

  return (manageRoleResult.data ?? []).some((row) => {
    const role = normalizeText(row.role);

    if (role === 'community-manager' || role === 'board-manager') {
      return true;
    }

    if (row.board_id === boardId && (role === 'board-general-manager' || role === 'board-assistant-manager')) {
      return true;
    }

    return false;
  });
}

function isPollRow(value: unknown): value is PollRow {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const rawValue = value as {
    question?: unknown;
    options?: unknown;
  };

  return typeof rawValue.question === 'string' && Array.isArray(rawValue.options);
}

function getPollAnonymity(value: PollRow | null) {
  return value?.anonymity === 'named' ? 'named' : 'anonymous';
}

function buildPollOptionMap(poll: PollRow) {
  return new Map(
    poll.options.map((option, optionIndex) => [
      optionIndex,
      {
        option_index: optionIndex,
        label: normalizeText(option.label),
      },
    ]),
  );
}

async function getBoardAndPost(siteName: string, boardName: string, contentId: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('id, visibility_type, is_shutdown')
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      error: Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  const board = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_type')
    .eq('site_id', rhizome.data.id)
    .eq('board_key', boardName)
    .maybeSingle();

  if (board.error || !board.data) {
    return {
      error: Response.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  if (board.data.board_type === 'page') {
    return {
      error: Response.json({ error: '댓글을 사용할 수 없는 게시판입니다.' }, { status: 400 }),
      data: null,
    };
  }

  const postQuery = supabaseAdmin
    .from('posts')
    .select('id, user_id, is_closed, published_status, is_comment, poll, draw_type, draw_limit, draw_ends_at')
    .eq('site_id', rhizome.data.id)
    .eq('board_id', board.data.id);

  const post = isNumericSlug(contentId)
    ? await postQuery.eq('slug', Number(contentId)).maybeSingle()
    : await postQuery.eq('id', contentId).maybeSingle();

  if (post.error || !post.data) {
    return {
      error: Response.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 }),
      data: null,
    };
  }

  return {
    error: null,
    data: {
      siteId: rhizome.data.id as string,
      boardId: board.data.id as string,
      postId: post.data.id as string,
      postAuthorId: post.data.user_id as string,
      isClosed: post.data.is_closed === true,
      isPublished: post.data.published_status === 'published' || post.data.published_status === 'unknown',
      isCommentEnabled: post.data.is_comment !== false,
      poll: isPollRow(post.data.poll) ? post.data.poll : null,
      drawType: (post.data.draw_type === 'first_come' || post.data.draw_type === 'random'
        ? post.data.draw_type
        : null) as DrawType,
      drawLimit:
        typeof post.data.draw_limit === 'number' && Number.isFinite(post.data.draw_limit)
          ? Math.floor(post.data.draw_limit)
          : null,
      drawEndsAt: typeof post.data.draw_ends_at === 'string' ? post.data.draw_ends_at : null,
      visibilityType: rhizome.data.visibility_type as string,
      isShutdown: rhizome.data.is_shutdown === true,
    },
  };
}

async function insertFirstComeDrawIfNeeded({
  siteId,
  boardId,
  postId,
  commentId,
  userId,
  drawType,
  drawLimit,
}: {
  siteId: string;
  boardId: string;
  postId: string;
  commentId: string;
  userId: string;
  drawType: DrawType;
  drawLimit: number | null;
}) {
  if (drawType !== 'first_come' || !drawLimit) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const existingDraw = await supabaseAdmin
    .from('post_draws')
    .select('id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .limit(1);

  if (existingDraw.error) {
    throw new Error('추첨 정보를 확인하지 못했습니다.');
  }

  if ((existingDraw.data ?? []).length > 0) {
    return;
  }

  const drawCount = await supabaseAdmin
    .from('post_draws')
    .select('id', { count: 'exact', head: true })
    .eq('post_id', postId);

  if (drawCount.error) {
    throw new Error('추첨 정보를 확인하지 못했습니다.');
  }

  const nextOrder = (drawCount.count ?? 0) + 1;

  if (nextOrder > drawLimit) {
    return;
  }

  const insertDraw = await supabaseAdmin.from('post_draws').insert({
    post_id: postId,
    site_id: siteId,
    board_id: boardId,
    comment_id: commentId,
    user_id: userId,
    draw_order: nextOrder,
  });

  if (insertDraw.error) {
    throw new Error('추첨 정보를 저장하지 못했습니다.');
  }
}

async function buildCommentItem({
  comment,
  commentMap,
  authorMap,
  siteId,
  boardId,
  postAuthorId,
  authUserId,
  canManageComment,
  pollChoiceMap,
  commentLikeCountMap,
  likedCommentIdSet,
}: {
  comment: CommentRow;
  commentMap: Map<string, CommentRow>;
  authorMap: Map<string, Awaited<ReturnType<typeof getUserDisplayInfo>>>;
  siteId: string;
  boardId: string;
  postAuthorId: string;
  authUserId: string | null;
  canManageComment: boolean;
  pollChoiceMap: Map<string, PollChoice>;
  commentLikeCountMap: Map<string, number>;
  likedCommentIdSet: Set<string>;
}) {
  let author = authorMap.get(comment.user_id);

  if (!author) {
    author = await getUserDisplayInfo(siteId, boardId, comment.user_id);
    authorMap.set(comment.user_id, author);
  }

  let replyToAuthorName = '';

  if (comment.reply_to_id) {
    const replyTargetComment = commentMap.get(comment.reply_to_id);

    if (replyTargetComment) {
      let replyToAuthor = authorMap.get(replyTargetComment.user_id);

      if (!replyToAuthor) {
        replyToAuthor = await getUserDisplayInfo(siteId, boardId, replyTargetComment.user_id);
        authorMap.set(replyTargetComment.user_id, replyToAuthor);
      }

      replyToAuthorName = replyToAuthor.name;
    }
  }

  const isDeleted = comment.is_deleted === true;
  const isBlinded = comment.is_blinded === true;
  const isMe = Boolean(authUserId) && comment.user_id === authUserId;

  let content = comment.content;

  if (isDeleted && !canManageComment) {
    content = '삭제된 댓글입니다.';
  } else if (isBlinded && !canManageComment) {
    content = '숨겨진 댓글입니다.';
  }

  return {
    id: comment.id,
    created_at: comment.created_at,
    user_id: comment.user_id,
    parent_id: comment.parent_id,
    reply_to_id: comment.reply_to_id,
    reply_to_author_name: replyToAuthorName,
    content,
    is_deleted: isDeleted,
    deleted_at: comment.deleted_at,
    deleted_by: comment.deleted_by,
    is_blinded: isBlinded,
    blinded_at: comment.blinded_at,
    blinded_by: comment.blinded_by,
    blinded_message: comment.blinded_message,
    author_name: author.name,
    author_avatar_url: author.avatarUrl,
    author_level: author.level,
    author_role: author.role,
    author_manage_roles: author.manageRoles,
    author_manage_icon: author.manageIcon,
    is_author: comment.user_id === postAuthorId,
    is_me: isMe,
    can_edit: isMe && !isDeleted && !isBlinded,
    can_delete: isMe && !isDeleted,
    can_blind: canManageComment && !isDeleted && !isBlinded,
    can_unblind: canManageComment && !isDeleted && isBlinded,
    poll_choice: pollChoiceMap.get(comment.user_id) ?? null,
    like_count: commentLikeCountMap.get(comment.id) ?? 0,
    is_liked: likedCommentIdSet.has(comment.id),
    replies: [],
  } satisfies CommentItem;
}

function groupComments(comments: CommentItem[]) {
  const rootComments = comments
    .filter((comment) => !comment.parent_id)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const repliesByParentId = new Map<string, CommentItem[]>();

  comments
    .filter((comment) => comment.parent_id)
    .forEach((comment) => {
      const parentId = comment.parent_id as string;
      const replies = repliesByParentId.get(parentId) ?? [];
      replies.push(comment);
      repliesByParentId.set(parentId, replies);
    });

  return rootComments.map((comment) => ({
    ...comment,
    replies: (repliesByParentId.get(comment.id) ?? []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    ),
  }));
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const target = await getBoardAndPost(siteName, normalizedBoardName, normalizedContentId);

    if (target.error || !target.data) {
      return target.error;
    }

    const session = await verifySession({
      siteId: target.data.siteId,
    });

    const canManageComment = await getCommentAccess(
      target.data.siteId,
      target.data.boardId,
      session.authUserId ?? null,
      session.case,
    );

    const supabaseAdmin = getSupabaseAdmin();

    let mySelfAvatarUrl = '';

    if (session.authUserId) {
      const stigmaResult = await supabaseAdmin
        .from('stigmas')
        .select('avatar')
        .eq('user_id', session.authUserId)
        .maybeSingle();

      if (!stigmaResult.error && stigmaResult.data?.avatar) {
        const avatarUrl = getAvatarUrl(stigmaResult.data.avatar ?? null);
        mySelfAvatarUrl = avatarUrl;
      }
    }

    const commentsResult = await supabaseAdmin
      .from('post_comments')
      .select(
        'id, created_at, site_id, board_id, post_id, user_id, parent_id, reply_to_id, content, is_deleted, deleted_at, deleted_by, is_blinded, blinded_at, blinded_by, blinded_message',
      )
      .eq('site_id', target.data.siteId)
      .eq('board_id', target.data.boardId)
      .eq('post_id', target.data.postId);

    if (commentsResult.error) {
      return Response.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const commentRows = (commentsResult.data ?? []) as CommentRow[];
    const commentIds = commentRows.map((comment) => comment.id);
    const commentMap = new Map(commentRows.map((comment) => [comment.id, comment]));
    const authorMap = new Map<string, Awaited<ReturnType<typeof getUserDisplayInfo>>>();
    const pollChoiceMap = new Map<string, PollChoice>();
    const commentLikeCountMap = new Map<string, number>();
    const likedCommentIdSet = new Set<string>();
    let myPollChoice: PollChoice | null = null;

    if (commentIds.length > 0) {
      const commentLikesResult = await supabaseAdmin
        .from('comment_likes')
        .select('comment_id, user_id')
        .eq('site_id', target.data.siteId)
        .eq('board_id', target.data.boardId)
        .eq('post_id', target.data.postId)
        .in('comment_id', commentIds);

      if (commentLikesResult.error) {
        return Response.json({ error: '댓글 좋아요 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      (commentLikesResult.data ?? []).forEach((like) => {
        const commentId = normalizeText(like.comment_id);
        const userId = normalizeText(like.user_id);

        if (!commentId) {
          return;
        }

        commentLikeCountMap.set(commentId, (commentLikeCountMap.get(commentId) ?? 0) + 1);

        if (session.authUserId && userId === session.authUserId) {
          likedCommentIdSet.add(commentId);
        }
      });
    }

    if (target.data.poll && getPollAnonymity(target.data.poll) === 'named') {
      const pollOptionMap = buildPollOptionMap(target.data.poll);
      const pollRowsResult = await supabaseAdmin
        .from('post_polls')
        .select('voter_id, option_index')
        .eq('post_id', target.data.postId);

      if (pollRowsResult.error) {
        return Response.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
      }

      (pollRowsResult.data ?? []).forEach((row) => {
        const voterId = normalizeText(row.voter_id);
        const optionIndex = typeof row.option_index === 'number' ? row.option_index : -1;
        const pollChoice = pollOptionMap.get(optionIndex);

        if (!voterId || !pollChoice) {
          return;
        }

        pollChoiceMap.set(voterId, pollChoice);

        if (session.authUserId && voterId === session.authUserId) {
          myPollChoice = pollChoice;
        }
      });
    }

    const commentItems = await Promise.all(
      commentRows.map((comment) =>
        buildCommentItem({
          comment,
          commentMap,
          authorMap,
          siteId: target.data.siteId,
          boardId: target.data.boardId,
          postAuthorId: target.data.postAuthorId,
          authUserId: session.authUserId ?? null,
          canManageComment,
          pollChoiceMap,
          commentLikeCountMap,
          likedCommentIdSet,
        }),
      ),
    );

    return Response.json({
      comments: groupComments(commentItems),
      mySelfAvatarUrl,
      myPollChoice,
      actions: {
        canWrite:
          Boolean(session.authUserId) &&
          target.data.isPublished &&
          target.data.isCommentEnabled &&
          !target.data.isClosed,
        canManageComment,
      },
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '댓글 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName) {
      return Response.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return Response.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;
    const siteName = normalizeText(requestBody.siteName).toLowerCase();
    const content = normalizeText(requestBody.content);
    const parentId = normalizeText(requestBody.parentId);

    if (!siteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!content) {
      return Response.json({ error: '댓글 내용을 입력해주세요.' }, { status: 400 });
    }

    const target = await getBoardAndPost(siteName, normalizedBoardName, normalizedContentId);

    if (target.error || !target.data) {
      return target.error;
    }

    const session = await verifySession({
      siteId: target.data.siteId,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요한 서비스입니다.' }, { status: 401 });
    }

    if (!target.data.isPublished || target.data.isClosed || !target.data.isCommentEnabled) {
      return Response.json({ error: '댓글을 작성할 수 없습니다.' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdmin();
    let resolvedParentId: string | null = null;
    let replyToId: string | null = null;

    if (parentId) {
      const parentResult = await supabaseAdmin
        .from('post_comments')
        .select('id, parent_id, site_id, board_id, post_id, is_deleted, is_blinded')
        .eq('id', parentId)
        .eq('site_id', target.data.siteId)
        .eq('board_id', target.data.boardId)
        .eq('post_id', target.data.postId)
        .maybeSingle();

      if (parentResult.error || !parentResult.data) {
        return Response.json({ error: '답글을 작성할 댓글을 찾을 수 없습니다.' }, { status: 404 });
      }

      if (parentResult.data.is_deleted || parentResult.data.is_blinded) {
        return Response.json({ error: '이 댓글에는 답글을 작성할 수 없습니다.' }, { status: 400 });
      }

      resolvedParentId = parentResult.data.parent_id ?? parentResult.data.id;
      replyToId = parentResult.data.id;
    }

    const insertResult = await supabaseAdmin
      .from('post_comments')
      .insert({
        site_id: target.data.siteId,
        board_id: target.data.boardId,
        post_id: target.data.postId,
        user_id: session.authUserId,
        parent_id: resolvedParentId,
        reply_to_id: replyToId,
        content,
        is_deleted: false,
        deleted_at: null,
        deleted_by: null,
        is_blinded: false,
        blinded_at: null,
        blinded_by: null,
        blinded_message: null,
      })
      .select(
        'id, created_at, site_id, board_id, post_id, user_id, parent_id, reply_to_id, content, is_deleted, deleted_at, deleted_by, is_blinded, blinded_at, blinded_by, blinded_message',
      )
      .maybeSingle();

    if (insertResult.error || !insertResult.data) {
      return Response.json({ error: '댓글 작성에 실패했습니다.' }, { status: 500 });
    }

    await insertFirstComeDrawIfNeeded({
      siteId: target.data.siteId,
      boardId: target.data.boardId,
      postId: target.data.postId,
      commentId: insertResult.data.id,
      userId: session.authUserId,
      drawType: target.data.drawType,
      drawLimit: target.data.drawLimit,
    });

    const canManageComment = await getCommentAccess(
      target.data.siteId,
      target.data.boardId,
      session.authUserId,
      session.case,
    );

    const commentMap = new Map([[insertResult.data.id, insertResult.data as CommentRow]]);
    const authorMap = new Map<string, Awaited<ReturnType<typeof getUserDisplayInfo>>>();

    const comment = await buildCommentItem({
      comment: insertResult.data as CommentRow,
      commentMap,
      authorMap,
      siteId: target.data.siteId,
      boardId: target.data.boardId,
      postAuthorId: target.data.postAuthorId,
      authUserId: session.authUserId,
      canManageComment,
      pollChoiceMap: new Map(),
      commentLikeCountMap: new Map(),
      likedCommentIdSet: new Set(),
    });

    return Response.json({
      ok: true,
      comment,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '댓글 작성에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '댓글 작성에 실패했습니다.' }, { status: 500 });
  }
}
