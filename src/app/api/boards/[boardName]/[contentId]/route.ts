import { NextResponse } from 'next/server';
import { PAYMENT_STATUS, PAYMENT_TARGET_TYPE, PAYMENT_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
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

type PostImageRow = {
  path?: string | null;
  width?: number | null;
  height?: number | null;
};

type LevelRow = {
  id: string;
  lv: number;
  icon: string | null;
  name: string | null;
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
  role: Exclude<AuthorRole, 'owner' | 'member'>;
  icon: string | null;
  iconUrl: string;
};

type CommentProvider = 'none' | 'giscus' | 'disqus' | 'velhub';

type GiscusInputPosition = 'top' | 'bottom';

type GiscusFlag = '0' | '1';

type DrawType = 'first_come' | 'random' | null;

type GiscusSettings = {
  repo: string;
  repoId: string;
  strict: GiscusFlag;
  reactionsEnabled: GiscusFlag;
  emitMetadata: GiscusFlag;
  inputPosition: GiscusInputPosition;
};

type DrawWinnerRow = {
  id: string;
  post_id: string;
  site_id: string;
  board_id: string;
  comment_id: string;
  user_id: string;
  draw_order: number;
};

type DrawWinner = {
  id: string;
  comment_id: string;
  user_id: string;
  draw_order: number;
  author_name: string;
  author_email: string;
  author_avatar_url: string;
};

type SeriesSubscriptionSettingRow = {
  price: number;
  is_enabled: boolean;
};

type PaidContentAccess = {
  is_purchase_required: boolean;
  post_purchase_price: number;
  has_board_subscription: boolean;
  has_series_subscription: boolean;
  has_post_purchase: boolean;
  can_view_paid_content: boolean;
};

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

function getPublicPostImageUrl(path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const bucket = normalizedPath.includes('/') ? 'post' : 'og-image';
  const publicUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? '';
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

function normalizeImages(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as PostImageRow[])
    .map((image) => {
      const path = normalizeText(image.path);

      if (!path) {
        return null;
      }

      return {
        path,
        url: getPublicPostImageUrl(path),
        width: typeof image.width === 'number' && Number.isFinite(image.width) ? Math.floor(image.width) : null,
        height: typeof image.height === 'number' && Number.isFinite(image.height) ? Math.floor(image.height) : null,
      };
    })
    .filter((image): image is { path: string; url: string; width: number | null; height: number | null } =>
      Boolean(image),
    );
}

function isManageRole(value: string): value is AuthorManageRole['role'] {
  return (
    value === 'community-manager' ||
    value === 'board-manager' ||
    value === 'board-general-manager' ||
    value === 'board-assistant-manager'
  );
}

function isCommentProvider(value: string): value is CommentProvider {
  return value === 'none' || value === 'giscus' || value === 'disqus' || value === 'velhub';
}

function isGiscusInputPosition(value: string): value is GiscusInputPosition {
  return value === 'top' || value === 'bottom';
}

function normalizeGiscusFlag(value: unknown): GiscusFlag {
  return value === '1' ? '1' : '0';
}

function normalizeGiscusSettings(value: unknown): GiscusSettings | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const rawValue = value as {
    repo?: unknown;
    repoId?: unknown;
    strict?: unknown;
    reactionsEnabled?: unknown;
    emitMetadata?: unknown;
    inputPosition?: unknown;
  };

  const repo = typeof rawValue.repo === 'string' ? normalizeText(rawValue.repo) : '';
  const repoId = typeof rawValue.repoId === 'string' ? normalizeText(rawValue.repoId) : '';
  const inputPositionValue =
    typeof rawValue.inputPosition === 'string' ? normalizeText(rawValue.inputPosition).toLowerCase() : '';

  return {
    repo,
    repoId,
    strict: normalizeGiscusFlag(rawValue.strict),
    reactionsEnabled: normalizeGiscusFlag(rawValue.reactionsEnabled),
    emitMetadata: normalizeGiscusFlag(rawValue.emitMetadata),
    inputPosition: isGiscusInputPosition(inputPositionValue) ? inputPositionValue : 'bottom',
  };
}

function getPostHref(siteName: string, boardKey: string, slug: number | string, categoryName: string) {
  const href = `/${siteName}/${boardKey}/${slug}`;

  if (!categoryName) {
    return href;
  }

  return `${href}?categoryName=${categoryName}`;
}

function shuffleItems<T>(items: T[]) {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [nextItems[index], nextItems[randomIndex]] = [nextItems[randomIndex], nextItems[index]];
  }

  return nextItems;
}

function normalizeDrawType(value: unknown): DrawType {
  if (value === 'first_come' || value === 'random') {
    return value;
  }

  return null;
}

function normalizeDrawLimit(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const limit = Math.floor(value);

  return limit > 0 ? limit : null;
}

function isPastDateTime(value: string | null) {
  if (!value) {
    return false;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() <= Date.now();
}

function getPostPurchasePrice(seriesSubscriptionPrice: number) {
  return Math.floor((seriesSubscriptionPrice * 27) / 100 / 1000) * 1000;
}

function getTextPreview(value: string | null | undefined, maxLength: number) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  return Array.from(normalizedValue).slice(0, maxLength).join('');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdownMedia(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  return normalizedValue
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/<https?:\/\/[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function createPaidContentPreviewText({
  summary,
  contentSimple,
  contentMarkdown,
  contentHtml,
}: {
  summary: string | null | undefined;
  contentSimple: string | null | undefined;
  contentMarkdown: string | null | undefined;
  contentHtml: string | null | undefined;
}) {
  const sourceText =
    normalizeText(summary) ||
    normalizeText(contentSimple) ||
    stripMarkdownMedia(contentMarkdown) ||
    stripHtml(contentHtml);

  if (!sourceText) {
    return null;
  }

  return Array.from(sourceText).slice(0, 170).join('');
}

function createPaidContentPreviewHtml(value: string | null) {
  if (!value) {
    return null;
  }

  return `<p>${escapeHtml(value)}...</p>`;
}

async function getPaidContentAccess({
  supabaseAdmin,
  authUserId,
  siteId,
  boardId,
  seriesId,
  postId,
}: {
  supabaseAdmin: ReturnType<typeof getSupabaseAdmin>;
  authUserId: string | null;
  siteId: string;
  boardId: string;
  seriesId: string | null;
  postId: string;
}): Promise<PaidContentAccess> {
  if (!seriesId) {
    return {
      is_purchase_required: false,
      post_purchase_price: 0,
      has_board_subscription: false,
      has_series_subscription: false,
      has_post_purchase: false,
      can_view_paid_content: true,
    };
  }

  const seriesResult = await supabaseAdmin
    .from('board_series')
    .select('id, is_subscription')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('id', seriesId)
    .maybeSingle();

  if (seriesResult.error) {
    throw new Error('연재 정보를 확인하지 못했습니다.');
  }

  if (seriesResult.data?.is_subscription !== true) {
    return {
      is_purchase_required: false,
      post_purchase_price: 0,
      has_board_subscription: false,
      has_series_subscription: false,
      has_post_purchase: false,
      can_view_paid_content: true,
    };
  }

  const subscriptionSettingResult = await supabaseAdmin
    .from('subscription_settings')
    .select('price, is_enabled')
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', seriesId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
    .maybeSingle();

  if (subscriptionSettingResult.error) {
    throw new Error('연재 구독 설정을 확인하지 못했습니다.');
  }

  if (!subscriptionSettingResult.data?.is_enabled) {
    return {
      is_purchase_required: false,
      post_purchase_price: 0,
      has_board_subscription: false,
      has_series_subscription: false,
      has_post_purchase: false,
      can_view_paid_content: true,
    };
  }

  const setting = subscriptionSettingResult.data as SeriesSubscriptionSettingRow;
  const postPurchasePrice = getPostPurchasePrice(setting.price);

  if (!authUserId) {
    return {
      is_purchase_required: true,
      post_purchase_price: postPurchasePrice,
      has_board_subscription: false,
      has_series_subscription: false,
      has_post_purchase: false,
      can_view_paid_content: false,
    };
  }

  const boardSubscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('subscriber_user_id', authUserId)
    .eq('target_type', PAYMENT_TARGET_TYPE.BOARD)
    .eq('target_id', boardId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.BOARD_SUBSCRIPTION)
    .in('status', ['trialing', 'active', 'past_due'])
    .is('expired_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (boardSubscriptionResult.error) {
    throw new Error('게시판 구독 상태를 확인하지 못했습니다.');
  }

  const hasBoardSubscription = (boardSubscriptionResult.data ?? []).length > 0;

  if (hasBoardSubscription) {
    return {
      is_purchase_required: true,
      post_purchase_price: postPurchasePrice,
      has_board_subscription: true,
      has_series_subscription: false,
      has_post_purchase: false,
      can_view_paid_content: true,
    };
  }

  const seriesSubscriptionResult = await supabaseAdmin
    .from('subscriptions')
    .select('id')
    .eq('subscriber_user_id', authUserId)
    .eq('target_type', PAYMENT_TARGET_TYPE.SERIES)
    .eq('target_id', seriesId)
    .eq('subscription_type', SUBSCRIPTION_TYPE.SERIES_SUBSCRIPTION)
    .in('status', ['trialing', 'active', 'past_due'])
    .is('expired_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (seriesSubscriptionResult.error) {
    throw new Error('연재 구독 상태를 확인하지 못했습니다.');
  }

  const hasSeriesSubscription = (seriesSubscriptionResult.data ?? []).length > 0;

  if (hasSeriesSubscription) {
    return {
      is_purchase_required: true,
      post_purchase_price: postPurchasePrice,
      has_board_subscription: false,
      has_series_subscription: true,
      has_post_purchase: false,
      can_view_paid_content: true,
    };
  }

  const postPurchaseResult = await supabaseAdmin
    .from('payments')
    .select('id')
    .eq('buyer_user_id', authUserId)
    .eq('payment_type', PAYMENT_TYPE.POST_PURCHASE)
    .eq('target_type', PAYMENT_TARGET_TYPE.POST)
    .eq('target_id', postId)
    .eq('status', PAYMENT_STATUS.PAID)
    .order('created_at', { ascending: false })
    .limit(1);

  if (postPurchaseResult.error) {
    throw new Error('포스팅 구매 내역을 확인하지 못했습니다.');
  }

  const hasPostPurchase = (postPurchaseResult.data ?? []).length > 0;

  return {
    is_purchase_required: true,
    post_purchase_price: postPurchasePrice,
    has_board_subscription: false,
    has_series_subscription: false,
    has_post_purchase: hasPostPurchase,
    can_view_paid_content: hasPostPurchase,
  };
}

async function getAdjacentPosts({
  siteId,
  siteName,
  boardId,
  boardKey,
  currentIdx,
  categoryName,
  isStaff,
}: {
  siteId: string;
  siteName: string;
  boardId: string;
  boardKey: string;
  currentIdx: number;
  categoryName: string;
  isStaff: boolean;
}) {
  const supabaseAdmin = getSupabaseAdmin();

  let categoryId = '';
  let selectedCategory: {
    category_key: string;
    category_label: string;
  } | null = null;

  if (categoryName) {
    const category = await supabaseAdmin
      .from('board_categories')
      .select('id, category_key, category_label')
      .eq('site_id', siteId)
      .eq('board_id', boardId)
      .eq('category_key', categoryName)
      .maybeSingle();

    if (category.error || !category.data?.id) {
      return {
        previousPost: null,
        nextPost: null,
        selectedCategory: null,
      };
    }

    categoryId = category.data.id;
    selectedCategory = {
      category_key: category.data.category_key,
      category_label: category.data.category_label,
    };
  }

  let previousQuery = supabaseAdmin
    .from('posts')
    .select('slug, subject')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('published_status', 'published')
    .gt('idx', currentIdx)
    .order('idx', { ascending: true })
    .limit(1);

  let nextQuery = supabaseAdmin
    .from('posts')
    .select('slug, subject')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('published_status', 'published')
    .lt('idx', currentIdx)
    .order('idx', { ascending: false })
    .limit(1);

  if (!isStaff) {
    previousQuery = previousQuery.eq('is_closed', false);
    nextQuery = nextQuery.eq('is_closed', false);
  }

  if (categoryId) {
    previousQuery = previousQuery.contains('categories', [categoryId]);
    nextQuery = nextQuery.contains('categories', [categoryId]);
  }

  const [previousResult, nextResult] = await Promise.all([previousQuery.maybeSingle(), nextQuery.maybeSingle()]);

  if (previousResult.error || nextResult.error) {
    throw new Error('이전글/다음글 정보를 불러오지 못했습니다.');
  }

  return {
    previousPost: previousResult.data
      ? {
          slug: String(previousResult.data.slug),
          subject: previousResult.data.subject,
          href: getPostHref(siteName, boardKey, previousResult.data.slug, categoryName),
        }
      : null,
    nextPost: nextResult.data
      ? {
          slug: String(nextResult.data.slug),
          subject: nextResult.data.subject,
          href: getPostHref(siteName, boardKey, nextResult.data.slug, categoryName),
        }
      : null,
    selectedCategory,
  };
}

async function getUserDisplayInfo(siteId: string, boardId: string, userId: string | null | undefined) {
  const normalizedUserId = normalizeText(userId);

  if (!normalizedUserId) {
    return {
      name: '',
      email: '',
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
    .select('id, user_id, user_name, email, avatar')
    .eq('id', normalizedUserId)
    .maybeSingle();

  const stigmaByAuthIdResult = stigmaByIdResult.data
    ? null
    : await supabaseAdmin
        .from('stigmas')
        .select('id, user_id, user_name, email, avatar')
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
  let email = '';
  let avatarUrl = '';
  let role: AuthorRole = baseRole === 'owner' ? 'owner' : 'member';
  let manageRoles: AuthorManageRole[] = [];
  let manageIcon: AuthorManageIcon | null = null;
  let level: {
    id: string;
    lv: number;
    name: string;
    icon: string | null;
    iconUrl: string;
  } | null = null;

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

  if (isManageRole(role)) {
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

    if (stigma.email) {
      try {
        email = decrypt(stigma.email as string);
      } catch {
        email = '';
      }
    }

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
    email,
    avatarUrl,
    level,
    role,
    manageRoles,
    manageIcon,
  };
}

async function createRandomDrawIfNeeded({
  siteId,
  boardId,
  postId,
  drawType,
  drawLimit,
  drawEndsAt,
}: {
  siteId: string;
  boardId: string;
  postId: string;
  drawType: DrawType;
  drawLimit: number | null;
  drawEndsAt: string | null;
}) {
  if (drawType !== 'random' || !drawLimit || !isPastDateTime(drawEndsAt)) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const existingDraws = await supabaseAdmin
    .from('post_draws')
    .select('id')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('post_id', postId)
    .limit(1);

  if (existingDraws.error) {
    throw new Error('추첨 정보를 확인하지 못했습니다.');
  }

  if ((existingDraws.data ?? []).length > 0) {
    return;
  }

  const commentsResult = await supabaseAdmin
    .from('post_comments')
    .select('id, user_id, created_at')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .eq('is_blinded', false)
    .lte('created_at', drawEndsAt as string)
    .order('created_at', { ascending: true });

  if (commentsResult.error) {
    throw new Error('추첨 대상 댓글을 확인하지 못했습니다.');
  }

  const candidateMap = new Map<string, { comment_id: string; user_id: string }>();

  (commentsResult.data ?? []).forEach((comment) => {
    const userId = normalizeText(comment.user_id);
    const commentId = normalizeText(comment.id);

    if (!userId || !commentId || candidateMap.has(userId)) {
      return;
    }

    candidateMap.set(userId, {
      comment_id: commentId,
      user_id: userId,
    });
  });

  const winners = shuffleItems(Array.from(candidateMap.values())).slice(0, drawLimit);

  if (winners.length === 0) {
    return;
  }

  const insertDraws = await supabaseAdmin.from('post_draws').insert(
    winners.map((winner, index) => ({
      post_id: postId,
      site_id: siteId,
      board_id: boardId,
      comment_id: winner.comment_id,
      user_id: winner.user_id,
      draw_order: index + 1,
    })),
  );

  if (insertDraws.error) {
    throw new Error('추첨 결과를 저장하지 못했습니다.');
  }
}

async function getDrawWinners({
  siteId,
  boardId,
  postId,
  canViewDraws,
}: {
  siteId: string;
  boardId: string;
  postId: string;
  canViewDraws: boolean;
}) {
  if (!canViewDraws) {
    return [];
  }

  const supabaseAdmin = getSupabaseAdmin();

  const drawsResult = await supabaseAdmin
    .from('post_draws')
    .select('id, post_id, site_id, board_id, comment_id, user_id, draw_order')
    .eq('site_id', siteId)
    .eq('board_id', boardId)
    .eq('post_id', postId)
    .order('draw_order', { ascending: true });

  if (drawsResult.error) {
    throw new Error('당첨자 목록을 불러오지 못했습니다.');
  }

  const drawRows = (drawsResult.data ?? []) as DrawWinnerRow[];

  const winners = await Promise.all(
    drawRows.map(async (draw) => {
      const author = await getUserDisplayInfo(siteId, boardId, draw.user_id);

      return {
        id: draw.id,
        comment_id: draw.comment_id,
        user_id: draw.user_id,
        draw_order: draw.draw_order,
        author_name: author.name,
        author_email: author.email,
        author_avatar_url: author.avatarUrl,
      } satisfies DrawWinner;
    }),
  );

  return winners;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { boardName, contentId } = await context.params;
    const normalizedBoardName = normalizeText(boardName).toLowerCase();
    const normalizedContentId = normalizeText(contentId);

    if (!normalizedBoardName) {
      return NextResponse.json({ error: 'boardName이 유효하지 않습니다.' }, { status: 400 });
    }

    if (!normalizedContentId) {
      return NextResponse.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const categoryName = normalizeText(requestUrl.searchParams.get('categoryName')).toLowerCase();

    if (!siteName) {
      return NextResponse.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const rhizome = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type, visibility_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (rhizome.error || !rhizome.data) {
      return NextResponse.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const rhizomeData = rhizome.data;

    const session = await verifySession({
      siteId: rhizomeData.id,
    });

    const isStaff = session.case === 'staff';

    if (rhizomeData.visibility_type !== 'public' || rhizomeData.is_shutdown !== false) {
      if (!isStaff) {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const board = await supabaseAdmin
      .from('boards')
      .select('id, board_key, board_label, board_type, markdown_status, site_id, post_type, is_subscription')
      .eq('site_id', rhizomeData.id)
      .eq('board_key', normalizedBoardName)
      .maybeSingle();

    if (board.error || !board.data) {
      return NextResponse.json({ error: '게시판을 찾을 수 없습니다.' }, { status: 404 });
    }

    const boardData = board.data;

    if (boardData.board_type === 'page') {
      const page = await supabaseAdmin
        .from('pages')
        .select(
          'id, slug, subject, summary, content_html, content_markdown, edited_at, sort_order, user_id, site_id, board_id, created_at, og_image, og_image_url, attachment_slug, attachment_origin, is_comment',
        )
        .eq('site_id', rhizomeData.id)
        .eq('board_id', boardData.id)
        .eq('slug', normalizedContentId)
        .maybeSingle();

      if (page.error || !page.data) {
        return NextResponse.json({ error: '페이지를 찾을 수 없습니다.' }, { status: 404 });
      }

      const author = await getUserDisplayInfo(rhizomeData.id, boardData.id, page.data.user_id);
      const isAuthor = Boolean(session.authUserId) && page.data.user_id === session.authUserId;

      return NextResponse.json({
        board: boardData,
        content: {
          ...page.data,
          slug: String(page.data.slug),
          author_name: author.name,
          author_avatar_url: author.avatarUrl,
          author_level: author.level,
          author_role: author.role,
          author_manage_roles: author.manageRoles,
          author_manage_icon: author.manageIcon,
          is_purchase_required: false,
          post_purchase_price: 0,
          has_board_subscription: false,
          has_series_subscription: false,
          has_post_purchase: false,
          can_view_paid_content: true,
          board_series_count: 0,
          is_post_donation_available: false,
        },
        previousPost: null,
        nextPost: null,
        draw: null,
        isAuthor,
        isStaff,
      });
    }

    if (!isNumericSlug(normalizedContentId)) {
      return NextResponse.json({ error: 'contentId가 유효하지 않습니다.' }, { status: 400 });
    }

    const post = await supabaseAdmin
      .from('posts')
      .select(
        'id, slug, subject, summary, content_html, content_markdown, content_simple, edited_at, thumbnail_image, thumbnail_width, thumbnail_height, youtube_url, youtube_id, youtube_created_at, images, poll, hashtags, idx, series_idx, user_id, site_id, board_id, created_at, is_closed, closed_by, closed_at, closed_message, categories, series_id, prefix_id, published_status, published_at, is_comment, post_count, is_pin, draw_type, draw_limit, draw_ends_at',
      )
      .eq('site_id', rhizomeData.id)
      .eq('board_id', boardData.id)
      .eq('slug', Number(normalizedContentId))
      .maybeSingle();

    if (post.error || !post.data) {
      return NextResponse.json({ error: '글을 찾을 수 없습니다.' }, { status: 404 });
    }

    const postData = post.data;

    const isAuthor = Boolean(session.authUserId) && postData.user_id === session.authUserId;

    if (postData.published_status === 'draft' && !isAuthor) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    if (postData.is_closed === true && !isStaff) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    const boardSeriesCountResult = await supabaseAdmin
      .from('board_series')
      .select('id', { count: 'exact', head: true })
      .eq('site_id', rhizomeData.id)
      .eq('board_id', boardData.id);

    if (boardSeriesCountResult.error) {
      return NextResponse.json({ error: '연재 개수를 확인하지 못했습니다.' }, { status: 500 });
    }

    const boardSeriesCount = boardSeriesCountResult.count ?? 0;

    const paidContentAccess = await getPaidContentAccess({
      supabaseAdmin,
      authUserId: session.authUserId ?? null,
      siteId: rhizomeData.id,
      boardId: boardData.id,
      seriesId: postData.series_id,
      postId: postData.id,
    });

    const shouldShowPaidPreview = paidContentAccess.is_purchase_required && !paidContentAccess.can_view_paid_content;

    const paidContentPreviewText = shouldShowPaidPreview
      ? createPaidContentPreviewText({
          summary: post.data.summary,
          contentSimple: post.data.content_simple,
          contentMarkdown: post.data.content_markdown,
          contentHtml: post.data.content_html,
        })
      : null;

    const canViewPaidContent = isAuthor || isStaff || paidContentAccess.can_view_paid_content;

    const author = await getUserDisplayInfo(rhizomeData.id, boardData.id, postData.user_id);
    const closedBy = await getUserDisplayInfo(rhizomeData.id, boardData.id, postData.closed_by);

    const drawType = normalizeDrawType(postData.draw_type);
    const drawLimit = normalizeDrawLimit(postData.draw_limit);
    const drawEndsAt = typeof postData.draw_ends_at === 'string' ? postData.draw_ends_at : null;

    await createRandomDrawIfNeeded({
      siteId: rhizomeData.id,
      boardId: boardData.id,
      postId: postData.id,
      drawType,
      drawLimit,
      drawEndsAt,
    });

    const drawCountResult = drawType
      ? await supabaseAdmin
          .from('post_draws')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', rhizomeData.id)
          .eq('board_id', boardData.id)
          .eq('post_id', postData.id)
      : { count: 0, error: null };

    if (drawCountResult.error) {
      return NextResponse.json({ error: '추첨 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const drawCount = drawCountResult.count ?? 0;

    const isDrawCompleted =
      drawType === 'first_come'
        ? Boolean(drawLimit && drawCount >= drawLimit)
        : drawType === 'random'
          ? Boolean(drawEndsAt && isPastDateTime(drawEndsAt) && drawCount > 0)
          : false;

    const canViewDraws = isAuthor || isStaff;

    const drawWinners = drawType
      ? await getDrawWinners({
          siteId: rhizomeData.id,
          boardId: boardData.id,
          postId: postData.id,
          canViewDraws,
        })
      : [];

    const categoryIds = Array.isArray(postData.categories)
      ? postData.categories.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value))
      : [];

    let categories: Array<{
      id: string;
      category_key: string;
      category_label: string;
      summary: string | null;
      thumbnail_image: string | null;
      sort_order: number;
      board_id: string;
      site_id: string;
      created_at?: string;
    }> = [];

    if (categoryIds.length > 0) {
      const categoryResult = await supabaseAdmin
        .from('board_categories')
        .select('id, category_key, category_label, summary, thumbnail_image, sort_order, board_id, site_id, created_at')
        .eq('site_id', rhizomeData.id)
        .eq('board_id', boardData.id)
        .in('id', categoryIds)
        .order('sort_order', { ascending: true });

      if (categoryResult.error) {
        return NextResponse.json({ error: '카테고리 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      categories = categoryResult.data ?? [];
    }

    let series: {
      id: string;
      created_at: string;
      series_key: string;
      series_label: string;
      summary: string | null;
      thumbnail_image: string | null;
      board_id: string;
      site_id: string;
      last_published_at: string | null;
      is_completed: boolean;
      is_subscription: boolean | null;
      user_id: string | null;
    } | null = null;

    let seriesContents: Array<{
      id: string;
      slug: string;
      subject: string;
      series_idx: number;
      href: string;
    }> = [];

    if (postData.series_id) {
      const seriesResult = await supabaseAdmin
        .from('board_series')
        .select(
          'id, created_at, series_key, series_label, summary, thumbnail_image, board_id, site_id, last_published_at, is_completed, is_subscription, user_id',
        )
        .eq('site_id', rhizomeData.id)
        .eq('board_id', boardData.id)
        .eq('id', postData.series_id)
        .maybeSingle();

      if (seriesResult.error) {
        return NextResponse.json({ error: '연재 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      series = seriesResult.data ?? null;

      if (series) {
        const seriesContentsResult = await supabaseAdmin
          .from('posts')
          .select('id, slug, subject, series_idx')
          .eq('site_id', rhizomeData.id)
          .eq('board_id', boardData.id)
          .eq('series_id', series.id)
          .eq('is_closed', false)
          .eq('published_status', 'published')
          .not('series_idx', 'is', null)
          .order('series_idx', { ascending: true });

        if (seriesContentsResult.error) {
          return NextResponse.json({ error: '연재 글 목록을 불러오지 못했습니다.' }, { status: 500 });
        }

        seriesContents = (seriesContentsResult.data ?? []).map((seriesContent) => ({
          id: seriesContent.id,
          slug: String(seriesContent.slug),
          subject: normalizeText(seriesContent.subject),
          series_idx: Number(seriesContent.series_idx),
          href: `/${siteName}/${boardData.board_key}/${seriesContent.slug}`,
        }));
      }
    }

    let prefixes: Array<{ id: string; prefix_label: string }> = [];
    let prefixLabel: string | null = null;

    if (boardData.post_type === 'prefix') {
      const prefixResult = await supabaseAdmin
        .from('board_prefixes')
        .select('id, prefix_label')
        .eq('site_id', rhizomeData.id)
        .eq('board_id', boardData.id)
        .order('prefix_key', { ascending: true });

      if (prefixResult.error) {
        return NextResponse.json({ error: '말머리 정보를 불러오지 못했습니다.' }, { status: 500 });
      }

      prefixes = prefixResult.data ?? [];
      prefixLabel = prefixes.find((prefix) => prefix.id === postData.prefix_id)?.prefix_label ?? null;
    }

    let commentProvider: CommentProvider = 'velhub';
    let giscusSettings: GiscusSettings | null = null;

    if (rhizomeData.site_type === 'blog') {
      const blogResult = await supabaseAdmin
        .from('blogs')
        .select('comment_provider, giscus_settings')
        .eq('site_id', rhizomeData.id)
        .maybeSingle();

      if (blogResult.error || !blogResult.data) {
        return NextResponse.json({ error: '댓글 설정을 불러오지 못했습니다.' }, { status: 500 });
      }

      const provider = normalizeText(blogResult.data.comment_provider).toLowerCase();

      if (!isCommentProvider(provider)) {
        return NextResponse.json({ error: '댓글 설정을 불러오지 못했습니다.' }, { status: 500 });
      }

      commentProvider = provider;
      giscusSettings = normalizeGiscusSettings(blogResult.data.giscus_settings);
    }

    const adjacentPosts = await getAdjacentPosts({
      siteId: rhizomeData.id,
      siteName,
      boardId: boardData.id,
      boardKey: boardData.board_key,
      currentIdx: postData.idx,
      categoryName,
      isStaff,
    });

    const postCount = typeof postData.post_count === 'number' ? Number(postData.post_count) : 0;
    const thumbnailImageUrl = getPublicPostImageUrl(postData.thumbnail_image);
    const isPostDonationAvailable = boardSeriesCount >= 2 && Boolean(postData.series_id);

    return NextResponse.json({
      board: boardData,
      content: {
        ...postData,
        summary: shouldShowPaidPreview ? paidContentPreviewText : post.data.summary,
        content_html: shouldShowPaidPreview
          ? createPaidContentPreviewHtml(paidContentPreviewText)
          : post.data.content_html,
        content_markdown: shouldShowPaidPreview ? paidContentPreviewText : post.data.content_markdown,
        content_simple: shouldShowPaidPreview ? paidContentPreviewText : post.data.content_simple,
        slug: String(postData.slug),
        author_name: author.name,
        author_avatar_url: author.avatarUrl,
        author_level: author.level,
        author_role: author.role,
        author_manage_roles: author.manageRoles,
        author_manage_icon: author.manageIcon,
        closed_by_name: closedBy.name,
        prefix_label: prefixLabel,
        thumbnail_image_url: thumbnailImageUrl,
        images: canViewPaidContent ? normalizeImages(postData.images) : [],
        post_count: postCount,
        comment_provider: commentProvider,
        giscus_settings: giscusSettings,
        is_purchase_required: paidContentAccess.is_purchase_required,
        post_purchase_price: paidContentAccess.post_purchase_price,
        has_board_subscription: paidContentAccess.has_board_subscription,
        has_series_subscription: paidContentAccess.has_series_subscription,
        has_post_purchase: paidContentAccess.has_post_purchase,
        can_view_paid_content: canViewPaidContent,
        board_series_count: boardSeriesCount,
        is_post_donation_available: isPostDonationAvailable,
      },
      categories,
      series,
      seriesContents,
      prefixes,
      previousPost: adjacentPosts.previousPost,
      nextPost: adjacentPosts.nextPost,
      selectedCategory: adjacentPosts.selectedCategory,
      draw: drawType
        ? {
            draw_type: drawType,
            draw_limit: drawLimit,
            draw_ends_at: drawEndsAt,
            draw_count: drawCount,
            is_completed: isDrawCompleted,
            can_view_draws: canViewDraws,
            winners: drawWinners,
          }
        : null,
      isAuthor,
      isStaff,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return NextResponse.json(
        {
          error: unknownError.message || '게시글 정보를 불러오지 못했습니다.',
        },
        { status: 500 },
      );
    }

    return NextResponse.json({ error: '게시글 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
