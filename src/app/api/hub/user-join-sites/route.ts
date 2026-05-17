import { decrypt } from '@/lib/encryption/decrypt';
import { getSessionClaims } from '@/lib/session';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RhizomeStigmaRow = {
  site_id: string;
  role: string | null;
};

type RhizomeRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  profile_picture: string | null;
  profile_logo: string | null;
};

type LatestPostRow = {
  id: string;
  site_id: string;
  board_id: string;
  slug: number | string;
  subject: string | null;
  user_id: string;
  published_at: string;
};

type BoardRow = {
  id: string;
  board_key: string;
};

type StigmaRow = {
  id: string;
  user_id: string | null;
  user_name: string | null;
};

type MembershipRow = {
  user_id: string;
  nickname: string | null;
};

type CommentRow = {
  post_id: string;
};

function getPublicUrl(bucket: string, path: string | null | undefined) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return null;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrlResult = supabaseAdmin.storage.from(bucket).getPublicUrl(normalizedPath);

  return publicUrlResult.data.publicUrl ?? null;
}

async function getAuthorNameMap(siteIds: string[], userIds: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const uniqueSiteIds = Array.from(new Set(siteIds.map((siteId) => normalizeText(siteId)).filter(Boolean)));
  const uniqueUserIds = Array.from(new Set(userIds.map((userId) => normalizeText(userId)).filter(Boolean)));
  const authorMap = new Map<string, string>();

  if (uniqueSiteIds.length === 0 || uniqueUserIds.length === 0) {
    return authorMap;
  }

  const [stigmasByIdResult, stigmasByAuthResult] = await Promise.all([
    supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('id', uniqueUserIds),
    supabaseAdmin.from('stigmas').select('id, user_id, user_name').in('user_id', uniqueUserIds),
  ]);

  if (stigmasByIdResult.error || stigmasByAuthResult.error) {
    throw new Error('최신글 작성자 정보를 불러오지 못했습니다.');
  }

  const stigmaRows = [
    ...((stigmasByIdResult.data ?? []) as StigmaRow[]),
    ...((stigmasByAuthResult.data ?? []) as StigmaRow[]),
  ];

  const stigmaIds = Array.from(new Set(stigmaRows.map((stigma) => stigma.id).filter(Boolean)));

  const membershipResult =
    stigmaIds.length > 0
      ? await supabaseAdmin
          .from('rhizome_stigmas')
          .select('site_id, user_id, nickname')
          .in('site_id', uniqueSiteIds)
          .in('user_id', stigmaIds)
      : { data: [], error: null };

  if (membershipResult.error) {
    throw new Error('최신글 작성자 정보를 불러오지 못했습니다.');
  }

  const membershipMap = new Map(
    ((membershipResult.data ?? []) as (MembershipRow & { site_id: string })[]).map((membership) => [
      `${membership.site_id}:${membership.user_id}`,
      normalizeText(membership.nickname),
    ]),
  );

  uniqueUserIds.forEach((userId) => {
    const stigma = stigmaRows.find((row) => row.id === userId || row.user_id === userId);

    if (!stigma) {
      authorMap.set(userId, '');
      return;
    }

    const nickname = uniqueSiteIds
      .map((siteId) => membershipMap.get(`${siteId}:${stigma.id}`))
      .find((value) => Boolean(value));

    if (nickname) {
      authorMap.set(userId, nickname);
      return;
    }

    if (stigma.user_name) {
      try {
        authorMap.set(userId, decrypt(stigma.user_name));
      } catch {
        authorMap.set(userId, '');
      }

      return;
    }

    authorMap.set(userId, '');
  });

  return authorMap;
}

async function getLatestPosts(siteIds: string[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const uniqueSiteIds = Array.from(new Set(siteIds.map((siteId) => normalizeText(siteId)).filter(Boolean)));

  if (uniqueSiteIds.length === 0) {
    return new Map<string, unknown[]>();
  }

  const postResults = await Promise.all(
    uniqueSiteIds.map((siteId) =>
      supabaseAdmin
        .from('posts')
        .select('id, site_id, board_id, slug, subject, user_id, published_at')
        .eq('site_id', siteId)
        .eq('published_status', 'published')
        .eq('is_closed', false)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(3),
    ),
  );

  const latestPosts = postResults.flatMap((result) => {
    if (result.error) {
      throw new Error('최신글 목록을 불러오지 못했습니다.');
    }

    return (result.data ?? []) as LatestPostRow[];
  });

  const postMap = new Map<string, unknown[]>();

  if (latestPosts.length === 0) {
    return postMap;
  }

  const boardIds = Array.from(new Set(latestPosts.map((post) => post.board_id).filter(Boolean)));
  const postIds = latestPosts.map((post) => post.id).filter(Boolean);
  const userIds = latestPosts.map((post) => post.user_id).filter(Boolean);

  const [boardResult, commentResult, authorMap] = await Promise.all([
    boardIds.length > 0
      ? supabaseAdmin.from('boards').select('id, board_key').in('id', boardIds)
      : { data: [], error: null },
    postIds.length > 0
      ? supabaseAdmin
          .from('post_comments')
          .select('post_id')
          .in('post_id', postIds)
          .eq('is_deleted', false)
          .eq('is_blinded', false)
      : { data: [], error: null },
    getAuthorNameMap(uniqueSiteIds, userIds),
  ]);

  if (boardResult.error || commentResult.error) {
    throw new Error('최신글 목록을 불러오지 못했습니다.');
  }

  const boardMap = new Map(((boardResult.data ?? []) as BoardRow[]).map((board) => [board.id, board.board_key]));
  const commentCountMap = new Map<string, number>();

  ((commentResult.data ?? []) as CommentRow[]).forEach((comment) => {
    commentCountMap.set(comment.post_id, (commentCountMap.get(comment.post_id) ?? 0) + 1);
  });

  latestPosts.forEach((post) => {
    const boardKey = boardMap.get(post.board_id);

    if (!boardKey) {
      return;
    }

    const sitePosts = postMap.get(post.site_id) ?? [];

    sitePosts.push({
      id: post.id,
      subject: normalizeText(post.subject),
      href: `/${boardKey}/${post.slug}`,
      authorName: authorMap.get(post.user_id) ?? '',
      commentCount: commentCountMap.get(post.id) ?? 0,
      publishedAt: post.published_at,
    });

    postMap.set(post.site_id, sitePosts);
  });

  return postMap;
}

export async function GET() {
  try {
    const sessionClaims = await getSessionClaims();

    if (!sessionClaims) {
      return Response.json({
        isLoggedIn: false,
        role: null,
        joinSites: [],
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const stigmaResult = await supabaseAdmin
      .from('stigmas')
      .select('id, role')
      .eq('user_id', sessionClaims.userId)
      .maybeSingle();

    if (stigmaResult.error || !stigmaResult.data) {
      return Response.json({ error: '사용자 정보를 확인하지 못했습니다.' }, { status: 500 });
    }

    const joinSitesResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('site_id, role')
      .eq('user_id', stigmaResult.data.id)
      .eq('is_approval', true);

    if (joinSitesResult.error) {
      return Response.json({ error: '가입한 사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const joinSiteRows = (joinSitesResult.data ?? []) as RhizomeStigmaRow[];
    const siteIdList = Array.from(new Set(joinSiteRows.map((row) => row.site_id).filter(Boolean)));

    if (siteIdList.length === 0) {
      return Response.json({
        isLoggedIn: true,
        role: stigmaResult.data.role ?? null,
        joinSites: [],
      });
    }

    const rhizomesResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_label, site_type, profile_picture, profile_logo')
      .in('id', siteIdList);

    if (rhizomesResult.error) {
      return Response.json({ error: '가입한 사이트 목록을 불러오지 못했습니다.' }, { status: 500 });
    }

    const latestPostMap = await getLatestPosts(siteIdList);

    const rhizomeMap = new Map(
      ((rhizomesResult.data ?? []) as RhizomeRow[]).map((row) => [
        row.id,
        {
          id: row.id,
          site_key: normalizeText(row.site_key),
          site_label: normalizeText(row.site_label),
          site_type: normalizeText(row.site_type).toLowerCase(),
          profilePictureUrl: getPublicUrl('avatar', row.profile_picture),
          profileLogoUrl: getPublicUrl('site-logo', row.profile_logo),
          latestPosts: latestPostMap.get(row.id) ?? [],
        },
      ]),
    );

    const joinSites = joinSiteRows
      .map((row) => {
        const rhizome = rhizomeMap.get(row.site_id);

        if (!rhizome) {
          return null;
        }

        return {
          id: rhizome.id,
          site_key: rhizome.site_key,
          site_label: rhizome.site_label,
          site_type: rhizome.site_type,
          profilePictureUrl: rhizome.profilePictureUrl,
          profileLogoUrl: rhizome.profileLogoUrl,
          role: normalizeText(row.role).toLowerCase(),
          latestPosts: rhizome.latestPosts,
        };
      })
      .filter(
        (
          row,
        ): row is {
          id: string;
          site_key: string;
          site_label: string;
          site_type: string;
          profilePictureUrl: string | null;
          profileLogoUrl: string | null;
          role: string;
          latestPosts: unknown[];
        } => Boolean(row && row.id && row.site_key && row.site_label),
      );

    return Response.json({
      isLoggedIn: true,
      role: stigmaResult.data.role ?? null,
      joinSites,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사용자 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}
