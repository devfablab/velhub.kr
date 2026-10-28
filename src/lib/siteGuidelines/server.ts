import { getCommunityManagerAccess } from '@/lib/community/communityManager/utils';
import { r2Storage } from '@/lib/r2Storage';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

export const siteGuidelineTypes = ['common', 'blog-community', 'blog-post', 'board-common', 'board-specific'] as const;
const MAX_GUIDELINE_ITEM_COUNT = 9;

export type SiteGuidelineType = (typeof siteGuidelineTypes)[number];
export type SiteGuidelineServiceTarget = 'blog-community' | 'blog-post' | 'board';

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: 'blog' | 'community' | string;
  profile_picture: string | null;
  summary: string | null;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
};

type GuidelineRow = {
  id: string;
  site_id: string;
  guideline_type: SiteGuidelineType;
  board_id: string | null;
};

type GuidelineItemRow = {
  id: string;
  guideline_id: string;
  content: string;
  sort_order: number;
};

export type SiteGuidelineItem = {
  id: string;
  content: string;
  sortOrder: number;
};

export type SiteGuideline = {
  id: string;
  type: SiteGuidelineType;
  boardId: string | null;
  items: SiteGuidelineItem[];
};

export type SiteGuidelineBoard = {
  id: string;
  key: string;
  label: string;
};

export type SiteGuidelinePermission = {
  canView: boolean;
  canEdit: boolean;
};

export type SiteGuidelineManagementContext = {
  siteId: string;
  siteName: string;
  siteType: 'blog' | 'community';
  boards: SiteGuidelineBoard[];
  guidelines: SiteGuideline[];
  getPermission: (type: SiteGuidelineType, boardId?: string | null) => SiteGuidelinePermission;
};

export function isSiteGuidelineType(value: string): value is SiteGuidelineType {
  return siteGuidelineTypes.includes(value as SiteGuidelineType);
}

function normalizeSiteName(value: string | null | undefined) {
  return normalizeText(value).toLowerCase();
}

function getAllowedTypes(siteType: 'blog' | 'community') {
  return siteType === 'blog'
    ? (['common', 'blog-community', 'blog-post'] as const)
    : (['common', 'board-common', 'board-specific'] as const);
}

function isAllowedType(siteType: 'blog' | 'community', type: SiteGuidelineType) {
  return getAllowedTypes(siteType).includes(type as never);
}

function toGuidelines(rows: GuidelineRow[], itemRows: GuidelineItemRow[]) {
  const itemMap = new Map<string, SiteGuidelineItem[]>();

  for (const item of itemRows) {
    const currentItems = itemMap.get(item.guideline_id) ?? [];
    currentItems.push({ id: item.id, content: item.content, sortOrder: item.sort_order });
    itemMap.set(item.guideline_id, currentItems);
  }

  return rows.map((row) => ({
    id: row.id,
    type: row.guideline_type,
    boardId: row.board_id,
    items: (itemMap.get(row.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder),
  }));
}

async function getGuidelines(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const guidelineResult = await supabaseAdmin
    .from('site_guidelines')
    .select('id, site_id, guideline_type, board_id')
    .eq('site_id', siteId);

  if (guidelineResult.error) {
    throw new Error('가이드라인을 불러오지 못했습니다.');
  }

  const rows = (guidelineResult.data ?? [])
    .filter((row) => isSiteGuidelineType(normalizeText(row.guideline_type)))
    .map((row) => ({
      id: String(row.id),
      site_id: String(row.site_id),
      guideline_type: normalizeText(row.guideline_type) as SiteGuidelineType,
      board_id: row.board_id ? String(row.board_id) : null,
    }));

  if (rows.length === 0) {
    return [];
  }

  const itemResult = await supabaseAdmin
    .from('site_guideline_items')
    .select('id, guideline_id, content, sort_order')
    .in(
      'guideline_id',
      rows.map((row) => row.id),
    )
    .order('sort_order', { ascending: true });

  if (itemResult.error) {
    throw new Error('가이드라인을 불러오지 못했습니다.');
  }

  return toGuidelines(rows, (itemResult.data ?? []) as GuidelineItemRow[]);
}

async function getSite(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type, profile_picture, summary')
    .eq('site_key', siteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    throw new Error('사이트를 찾을 수 없습니다.');
  }

  const site = siteResult.data as SiteRow;

  if (site.site_type !== 'blog' && site.site_type !== 'community') {
    throw new Error('블로그 또는 커뮤니티만 사용할 수 있습니다.');
  }

  return { ...site, site_type: site.site_type as 'blog' | 'community' };
}

async function getBoards(siteId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  const boardsResult = await supabaseAdmin
    .from('boards')
    .select('id, board_key, board_label')
    .eq('site_id', siteId)
    .neq('board_type', 'page')
    .order('sort_order', { ascending: true });

  if (boardsResult.error) {
    throw new Error('게시판을 불러오지 못했습니다.');
  }

  return (boardsResult.data ?? []).map((board) => {
    const row = board as BoardRow;

    return { id: row.id, key: row.board_key, label: row.board_label };
  });
}

export async function getSiteGuidelineManagementContext(siteName: string): Promise<SiteGuidelineManagementContext> {
  const normalizedSiteName = normalizeSiteName(siteName);

  if (!normalizedSiteName) {
    throw new Error('siteName이 유효하지 않습니다.');
  }

  const site = await getSite(normalizedSiteName);

  if (site.site_type === 'blog') {
    const session = await verifySession({ siteId: site.id });

    if (session.case !== 'admin' && session.case !== 'staff') {
      throw new Error('접근 권한이 없습니다.');
    }

    const guidelines = await getGuidelines(site.id);

    return {
      siteId: site.id,
      siteName: site.site_key,
      siteType: 'blog',
      boards: [],
      guidelines,
      getPermission: (type) => ({
        canView: isAllowedType('blog', type),
        canEdit: isAllowedType('blog', type),
      }),
    };
  }

  const access = await getCommunityManagerAccess(normalizedSiteName, { requireManagerControlPermission: false });
  const roles = access.actor.communityRoles;
  const canUseManagement = roles.length > 0;

  if (!canUseManagement) {
    throw new Error('접근 권한이 없습니다.');
  }

  const [boards, guidelines] = await Promise.all([getBoards(site.id), getGuidelines(site.id)]);
  const canEditCommon = roles.some((role) => ['owner', 'community-manager', 'board-manager'].includes(role));
  const canView = true;

  return {
    siteId: site.id,
    siteName: site.site_key,
    siteType: 'community',
    boards,
    guidelines,
    getPermission: (type, boardId) => {
      if (!isAllowedType('community', type)) {
        return { canView: false, canEdit: false };
      }

      if (type !== 'board-specific') {
        return { canView, canEdit: canEditCommon };
      }

      const targetBoardId = normalizeText(boardId);
      const canEditBoard =
        canEditCommon ||
        (targetBoardId !== '' &&
          roles.includes('board-general-manager') &&
          access.actor.managedBoardGeneralIds.includes(targetBoardId));

      return { canView, canEdit: canEditBoard };
    },
  };
}

function normalizeItems(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .map((content, index) => ({ content, sortOrder: index + 1 }));
}

export async function saveSiteGuideline({
  siteName,
  type,
  boardId,
  items,
}: {
  siteName: string;
  type: SiteGuidelineType;
  boardId?: string | null;
  items: unknown;
}) {
  const context = await getSiteGuidelineManagementContext(siteName);
  const normalizedBoardId = normalizeText(boardId);

  if (!isAllowedType(context.siteType, type)) {
    throw new Error('해당 가이드라인은 이 사이트에서 사용할 수 없습니다.');
  }

  if (type === 'board-specific') {
    if (
      context.siteType !== 'community' ||
      !normalizedBoardId ||
      !context.boards.some((board) => board.id === normalizedBoardId)
    ) {
      throw new Error('게시판이 유효하지 않습니다.');
    }
  } else if (normalizedBoardId) {
    throw new Error('게시판별 가이드라인에서만 게시판을 지정할 수 있습니다.');
  }

  const permission = context.getPermission(type, normalizedBoardId || null);

  if (!permission.canEdit) {
    throw new Error('수정 권한이 없습니다.');
  }

  const normalizedItems = normalizeItems(items);

  if (normalizedItems.length > MAX_GUIDELINE_ITEM_COUNT) {
    throw new Error('가이드라인은 최대 9개까지 등록할 수 있습니다.');
  }

  const supabaseAdmin = getSupabaseAdmin();
  let existingQuery = supabaseAdmin
    .from('site_guidelines')
    .select('id')
    .eq('site_id', context.siteId)
    .eq('guideline_type', type);

  existingQuery = normalizedBoardId
    ? existingQuery.eq('board_id', normalizedBoardId)
    : existingQuery.is('board_id', null);

  const existingResult = await existingQuery.maybeSingle();

  if (existingResult.error) {
    throw new Error('가이드라인을 저장하지 못했습니다.');
  }

  const existingId = existingResult.data?.id ? String(existingResult.data.id) : null;

  if (normalizedItems.length === 0) {
    if (existingId) {
      const deleteResult = await supabaseAdmin.from('site_guidelines').delete().eq('id', existingId);

      if (deleteResult.error) {
        throw new Error('가이드라인을 저장하지 못했습니다.');
      }
    }

    return { type, boardId: normalizedBoardId || null, items: [] as SiteGuidelineItem[] };
  }

  const guidelineId = existingId
    ? existingId
    : await (async () => {
        const insertResult = await supabaseAdmin
          .from('site_guidelines')
          .insert({
            site_id: context.siteId,
            guideline_type: type,
            board_id: normalizedBoardId || null,
          })
          .select('id')
          .single();

        if (insertResult.error || !insertResult.data) {
          throw new Error('가이드라인을 저장하지 못했습니다.');
        }

        return String(insertResult.data.id);
      })();

  const deleteItemsResult = await supabaseAdmin.from('site_guideline_items').delete().eq('guideline_id', guidelineId);

  if (deleteItemsResult.error) {
    throw new Error('가이드라인을 저장하지 못했습니다.');
  }

  const insertItemsResult = await supabaseAdmin
    .from('site_guideline_items')
    .insert(
      normalizedItems.map((item) => ({ guideline_id: guidelineId, content: item.content, sort_order: item.sortOrder })),
    )
    .select('id, content, sort_order');

  if (insertItemsResult.error) {
    throw new Error('가이드라인을 저장하지 못했습니다.');
  }

  return {
    type,
    boardId: normalizedBoardId || null,
    items: (insertItemsResult.data ?? []).map((item) => ({
      id: String(item.id),
      content: String(item.content),
      sortOrder: Number(item.sort_order),
    })),
  };
}

export async function getServiceSiteGuidelines({
  siteName,
  target,
  boardId,
}: {
  siteName: string;
  target: SiteGuidelineServiceTarget;
  boardId?: string | null;
}) {
  const normalizedSiteName = normalizeSiteName(siteName);

  if (!normalizedSiteName) {
    throw new Error('siteName이 유효하지 않습니다.');
  }

  const site = await getSite(normalizedSiteName);
  const normalizedBoardId = normalizeText(boardId);
  const requiredTypes: SiteGuidelineType[] =
    target === 'blog-community'
      ? ['common', 'blog-community']
      : target === 'blog-post'
        ? ['common', 'blog-post']
        : ['common', 'board-common', 'board-specific'];

  if (
    (target !== 'board' && site.site_type !== 'blog') ||
    (target === 'board' && (site.site_type !== 'community' || !normalizedBoardId))
  ) {
    throw new Error('가이드라인 대상이 유효하지 않습니다.');
  }

  if (target === 'board') {
    const boardResult = await getSupabaseAdmin()
      .from('boards')
      .select('id')
      .eq('id', normalizedBoardId)
      .eq('site_id', site.id)
      .maybeSingle();

    if (boardResult.error || !boardResult.data) {
      throw new Error('게시판을 찾을 수 없습니다.');
    }
  }

  const guidelines = await getGuidelines(site.id);

  return requiredTypes.flatMap((type) =>
    guidelines.filter(
      (guideline) =>
        guideline.type === type &&
        (type !== 'board-specific' || guideline.boardId === normalizedBoardId) &&
        guideline.items.length > 0,
    ),
  );
}

function getAvatarUrl(value: string | null | undefined) {
  const avatar = normalizeText(value);

  if (!avatar) {
    return null;
  }

  if (/^https?:\/\//i.test(avatar)) {
    return avatar;
  }

  return r2Storage.from('avatar').getPublicUrl(avatar).data.publicUrl ?? null;
}

export type SiteGuidelineDialogData = {
  site: {
    name: string;
    avatarUrl: string | null;
    summary: string | null;
    siteType: 'blog' | 'community';
  };
  items: Array<{ id: string; content: string }>;
};

export async function getSiteGuidelineDialogData({
  siteName,
  target,
  boardId,
}: {
  siteName: string;
  target: SiteGuidelineServiceTarget;
  boardId?: string | null;
}): Promise<SiteGuidelineDialogData | null> {
  const normalizedSiteName = normalizeSiteName(siteName);

  if (!normalizedSiteName) {
    throw new Error('siteName이 유효하지 않습니다.');
  }

  const [site, guidelines] = await Promise.all([
    getSite(normalizedSiteName),
    getServiceSiteGuidelines({ siteName: normalizedSiteName, target, boardId }),
  ]);
  const items = guidelines.flatMap((guideline) =>
    guideline.items.map((item) => ({ id: item.id, content: item.content })),
  );

  if (items.length === 0) {
    return null;
  }

  return {
    site: {
      name: normalizeText(site.site_label) || site.site_key,
      avatarUrl: getAvatarUrl(site.profile_picture),
      summary: normalizeText(site.summary) || null,
      siteType: site.site_type,
    },
    items,
  };
}

export async function getCommunityBoardGuidelineDialogDataByBoard({
  siteName,
  boardIds,
}: {
  siteName: string;
  boardIds: string[];
}): Promise<Record<string, SiteGuidelineDialogData | null>> {
  const normalizedSiteName = normalizeSiteName(siteName);
  const normalizedBoardIds = Array.from(new Set(boardIds.map((boardId) => normalizeText(boardId)).filter(Boolean)));

  if (!normalizedSiteName || normalizedBoardIds.length === 0) {
    return {};
  }

  const site = await getSite(normalizedSiteName);
  if (site.site_type !== 'community') {
    throw new Error('커뮤니티 가이드라인 대상이 유효하지 않습니다.');
  }

  const guidelines = await getGuidelines(site.id);
  const siteData = {
    name: normalizeText(site.site_label) || site.site_key,
    avatarUrl: getAvatarUrl(site.profile_picture),
    summary: normalizeText(site.summary) || null,
    siteType: site.site_type,
  } as const;
  const getItems = (type: SiteGuidelineType, boardId?: string) =>
    guidelines
      .filter((guideline) => guideline.type === type && (type !== 'board-specific' || guideline.boardId === boardId))
      .flatMap((guideline) => guideline.items.map((item) => ({ id: item.id, content: item.content })));
  const commonItems = [...getItems('common'), ...getItems('board-common')];

  return Object.fromEntries(
    normalizedBoardIds.map((boardId) => {
      const items = [
        ...commonItems,
        ...getItems('board-specific', boardId),
      ];
      return [boardId, items.length > 0 ? { site: siteData, items } : null];
    }),
  );
}
