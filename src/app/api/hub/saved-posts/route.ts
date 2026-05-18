import verifySession from '@/lib/session/verifySession';
import { decrypt } from '@/lib/encryption/decrypt';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';

type SaveRow = {
  id: string;
  created_at: string;
  site_id: string;
  board_id: string;
  post_id: string;
};

type PostRow = {
  id: string;
  slug: number | string;
  subject: string | null;
  user_id: string | null;
  site_id: string;
  board_id: string;
  published_status: string;
  is_closed: boolean;
};

type BoardRow = {
  id: string;
  board_key: string;
};

type SiteRow = {
  id: string;
  site_key: string;
  site_label: string | null;
  site_type: string;
};

type StigmaRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
};

type MemberRow = {
  site_id: string;
  user_id: string;
  nickname: string | null;
};

function normalizeSiteType(value: string | null): SiteType | null {
  if (value === 'blog' || value === 'community') {
    return value;
  }

  return null;
}

function decryptValue(value: string | null | undefined) {
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

async function getAuthorNameMap(siteIds: string[], authUserIds: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const uniqueSiteIds = Array.from(new Set(siteIds.map((siteId) => normalizeText(siteId)).filter(Boolean)));
  const uniqueAuthUserIds = Array.from(new Set(authUserIds.map((userId) => normalizeText(userId)).filter(Boolean)));
  const authorMap = new Map<string, string>();

  if (uniqueSiteIds.length === 0 || uniqueAuthUserIds.length === 0) {
    return authorMap;
  }

  const stigmasResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id, user_name')
    .in('user_id', uniqueAuthUserIds);

  if (stigmasResult.error) {
    throw new Error('작성자 정보를 불러오지 못했습니다.');
  }

  const stigmaRows = (stigmasResult.data ?? []) as StigmaRow[];
  const stigmaIds = stigmaRows.map((stigma) => stigma.id);

  const membersResult =
    stigmaIds.length > 0
      ? await supabaseAdmin
          .from('rhizome_stigmas')
          .select('site_id, user_id, nickname')
          .in('site_id', uniqueSiteIds)
          .in('user_id', stigmaIds)
      : { data: [], error: null };

  if (membersResult.error) {
    throw new Error('작성자 정보를 불러오지 못했습니다.');
  }

  const memberRows = (membersResult.data ?? []) as MemberRow[];
  const memberMap = new Map(
    memberRows.map((member) => [`${member.site_id}:${member.user_id}`, normalizeText(member.nickname)]),
  );

  stigmaRows.forEach((stigma) => {
    const authUserId = normalizeText(stigma.user_id);

    if (!authUserId) {
      return;
    }

    const nickname = uniqueSiteIds
      .map((siteId) => memberMap.get(`${siteId}:${stigma.id}`))
      .find((value) => Boolean(value));

    authorMap.set(authUserId, nickname || decryptValue(stigma.user_name));
  });

  return authorMap;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteType = normalizeSiteType(normalizeText(requestUrl.searchParams.get('siteType')).toLowerCase());

    if (!siteType) {
      return Response.json({ error: 'siteType이 유효하지 않습니다.' }, { status: 400 });
    }

    const session = await verifySession({ siteId: null });

    if (!session.authUserId) {
      return Response.json({ posts: [] });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const savesResult = await supabaseAdmin
      .from('post_saves')
      .select('id, created_at, site_id, board_id, post_id')
      .eq('user_id', session.authUserId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (savesResult.error) {
      return Response.json({ error: '저장한 글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const saveRows = (savesResult.data ?? []) as SaveRow[];
    const siteIds = Array.from(new Set(saveRows.map((row) => row.site_id)));

    if (siteIds.length === 0) {
      return Response.json({ posts: [] });
    }

    const sitesResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type')
      .in('id', siteIds)
      .eq('site_type', siteType);

    if (sitesResult.error) {
      return Response.json({ error: '사이트 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    const sites = (sitesResult.data ?? []) as SiteRow[];
    const siteMap = new Map(sites.map((site) => [site.id, site]));
    const filteredSaves = saveRows.filter((row) => siteMap.has(row.site_id));

    const postIds = filteredSaves.map((row) => row.post_id);
    const boardIds = Array.from(new Set(filteredSaves.map((row) => row.board_id)));

    const [postsResult, boardsResult] = await Promise.all([
      postIds.length > 0
        ? supabaseAdmin
            .from('posts')
            .select('id, slug, subject, user_id, site_id, board_id, published_status, is_closed')
            .in('id', postIds)
        : { data: [], error: null },
      boardIds.length > 0
        ? supabaseAdmin.from('boards').select('id, board_key').in('id', boardIds)
        : { data: [], error: null },
    ]);

    if (postsResult.error || boardsResult.error) {
      return Response.json({ error: '저장한 글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const posts = (postsResult.data ?? []) as PostRow[];
    const boards = (boardsResult.data ?? []) as BoardRow[];
    const postMap = new Map(posts.map((post) => [post.id, post]));
    const boardMap = new Map(boards.map((board) => [board.id, board.board_key]));
    const authorMap = await getAuthorNameMap(
      posts.map((post) => post.site_id),
      posts.map((post) => normalizeText(post.user_id)).filter(Boolean),
    );

    const resultPosts = filteredSaves
      .map((save) => {
        const site = siteMap.get(save.site_id);
        const post = postMap.get(save.post_id);
        const boardKey = boardMap.get(save.board_id);

        if (!site || !post || !boardKey || post.published_status !== 'published' || post.is_closed) {
          return null;
        }

        return {
          id: save.id,
          title: normalizeText(post.subject),
          authorName: authorMap.get(normalizeText(post.user_id)) ?? '',
          siteName: site.site_label || site.site_key,
          date: save.created_at,
          href: `/${site.site_key}/${boardKey}/${post.slug}`,
        };
      })
      .filter(Boolean);

    return Response.json({ posts: resultPosts });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '저장한 글 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '저장한 글 목록을 불러오지 못했습니다.' }, { status: 500 });
  }
}
