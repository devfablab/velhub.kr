import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type RouteContext = {
  params: Promise<{
    siteName: string;
    userId: string;
  }>;
};

type RequestBody = {
  mode?: 'restore' | 'reset' | null;
};

type StigmaRow = {
  id: string;
  user_id: string;
  user_name: string | null;
};

type MembershipRow = {
  id: string;
  created_at: string;
  user_id: string;
  site_id: string;
  kicked_at: string | null;
  kick_reason: string | null;
  kick_term: string | null;
  withdrawn_at: string | null;
};

type UserRow = {
  id: string;
  kickedAt: string;
  kickReason: string;
  kickTerm: string;
};

type ImageItem = {
  path?: unknown;
};

type PollOption = {
  image?: {
    path?: unknown;
  } | null;
};

type PollData = {
  options?: PollOption[];
};

type PostRow = {
  id: string;
  thumbnail_image: string | null;
  og_image: string | null;
  images: unknown;
  poll: unknown;
  content_html: string | null;
  content_markdown: string | null;
};

const POST_BUCKET = 'post';
const OG_IMAGE_BUCKET = 'og-image';

function addPostImagePath(pathSet: Set<string>, value: unknown, userId: string) {
  if (typeof value !== 'string') {
    return;
  }

  const path = normalizeText(value);

  if (
    path.startsWith(`thumbnail/${userId}/`) ||
    path.startsWith(`images/${userId}/`) ||
    path.startsWith(`editor/${userId}/`)
  ) {
    pathSet.add(path);
  }
}

function addStructuredPostImagePaths(pathSet: Set<string>, post: PostRow, userId: string) {
  addPostImagePath(pathSet, post.thumbnail_image, userId);

  if (Array.isArray(post.images)) {
    post.images.forEach((image) => {
      if (!image || typeof image !== 'object') {
        return;
      }

      addPostImagePath(pathSet, (image as ImageItem).path, userId);
    });
  }

  if (!post.poll || typeof post.poll !== 'object') {
    return;
  }

  const poll = post.poll as PollData;

  if (!Array.isArray(poll.options)) {
    return;
  }

  poll.options.forEach((option) => {
    addPostImagePath(pathSet, option.image?.path, userId);
  });
}

function addEditorPostImagePaths(pathSet: Set<string>, value: string | null, userId: string) {
  const content = normalizeText(value);

  if (!content) {
    return;
  }

  const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pathPattern = new RegExp(`(?:thumbnail|images|editor)/${escapedUserId}/[^"'\\s<>?)]+`, 'g');
  const paths = content.match(pathPattern) ?? [];

  paths.forEach((path) => {
    try {
      addPostImagePath(pathSet, decodeURIComponent(path), userId);
    } catch {
      addPostImagePath(pathSet, path, userId);
    }
  });
}

function addOgImagePath(pathSet: Set<string>, value: unknown) {
  if (typeof value !== 'string') {
    return;
  }

  const path = normalizeText(value);

  if (!path) {
    return;
  }

  if (!path.startsWith('http://') && !path.startsWith('https://')) {
    pathSet.add(path.replace(/^og-image\//, ''));
    return;
  }

  try {
    const imageUrl = new URL(path);
    const publicBucketPath = '/storage/v1/object/public/og-image/';
    const authenticatedBucketPath = '/storage/v1/object/authenticated/og-image/';
    const publicPathIndex = imageUrl.pathname.indexOf(publicBucketPath);
    const authenticatedPathIndex = imageUrl.pathname.indexOf(authenticatedBucketPath);

    if (publicPathIndex !== -1) {
      const objectPath = decodeURIComponent(imageUrl.pathname.slice(publicPathIndex + publicBucketPath.length));

      if (objectPath) {
        pathSet.add(objectPath);
      }

      return;
    }

    if (authenticatedPathIndex !== -1) {
      const objectPath = decodeURIComponent(
        imageUrl.pathname.slice(authenticatedPathIndex + authenticatedBucketPath.length),
      );

      if (objectPath) {
        pathSet.add(objectPath);
      }
    }
  } catch {
    return;
  }
}

async function removeStorageFiles(bucket: string, paths: string[], errorMessage: string) {
  if (paths.length === 0) {
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();

  for (let index = 0; index < paths.length; index += 100) {
    const removeResult = await supabaseAdmin.storage.from(bucket).remove(paths.slice(index, index + 100));

    if (removeResult.error) {
      throw new Error(errorMessage);
    }
  }
}

async function getUserInfo(siteName: string) {
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
    return {
      ok: false,
      status: 400,
      error: 'siteName이 유효하지 않습니다.',
    } as const;
  }

  const supabaseAdmin = getSupabaseAdmin();

  const siteResult = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_type')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (siteResult.error || !siteResult.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  const siteType = normalizeText(siteResult.data.site_type).toLowerCase();

  const site = {
    id: siteResult.data.id,
    siteKey: siteResult.data.site_key,
    siteType,
  };

  const session = await verifySession({
    siteId: site.id,
  });

  if (!session.authUserId) {
    return {
      ok: true,
      status: 200,
      data: {
        status: 'guest',
      },
    } as const;
  }

  const stigmaResult = await supabaseAdmin
    .from('stigmas')
    .select('id, user_id, user_name, avatar')
    .eq('user_id', session.authUserId)
    .maybeSingle();

  if (stigmaResult.error || !stigmaResult.data) {
    return {
      ok: false,
      status: 500,
      error: '사용자 정보를 불러오지 못했습니다.',
    } as const;
  }

  const stigma = stigmaResult.data as StigmaRow;

  const membershipResult = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('id, created_at, user_id, site_id, kicked_at, kick_reason, kick_term')
    .eq('site_id', site.id)
    .eq('user_id', stigma.id)
    .maybeSingle();

  if (membershipResult.error) {
    return {
      ok: false,
      status: 500,
      error: '멤버 정보를 불러오지 못했습니다.',
    } as const;
  }

  const membership = membershipResult.data as MembershipRow;

  return {
    ok: true,
    status: 200,
    data: {
      status: 'active',
      userInfo: {
        id: stigma.id,
        kickedAt: membership.kicked_at,
        kickReason: membership.kick_reason,
        kickTerm: membership.kick_term,
      },
    },
  } as const;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const normalizedSiteName = normalizeText(siteName).toLowerCase();
    const requestBody = (await request.json()) as RequestBody;
    const mode = requestBody.mode;

    if (!normalizedSiteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const result = await getUserInfo(siteName);

    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }

    const userResult = result.data.userInfo as unknown as UserRow;

    if (!userResult.id) {
      return Response.json({ error: 'userId가 유효하지 않습니다.' }, { status: 400 });
    }

    const normalizedUserId = normalizeText(userResult.id);

    if (mode !== 'restore' && mode !== 'reset') {
      return Response.json({ error: '재가입 방식을 선택해주세요.' }, { status: 400 });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_type')
      .eq('site_key', normalizedSiteName)
      .maybeSingle();

    if (siteResult.error || !siteResult.data) {
      return Response.json({ error: '사이트를 찾을 수 없습니다.' }, { status: 404 });
    }

    const session = await verifySession({
      siteId: siteResult.data.id,
    });

    if (!session.authUserId) {
      return Response.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const membershipResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .select('id, is_rejoin, withdrawn_at, is_block')
      .eq('site_id', siteResult.data.id)
      .eq('user_id', normalizedUserId)
      .maybeSingle();

    if (membershipResult.error || !membershipResult.data) {
      return Response.json({ error: '재가입 정보를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (membershipResult.data.is_rejoin !== true) {
      return Response.json({ error: '재가입할 수 없는 상태입니다.' }, { status: 403 });
    }

    if (mode === 'restore') {
      const restorePostsResult = await supabaseAdmin
        .from('posts')
        .update({
          is_closed: false,
          is_locked: false,
          closed_by: null,
          closed_at: null,
          closed_message: null,
        })
        .eq('site_id', siteResult.data.id)
        .eq('user_id', normalizedUserId)
        .eq('is_locked', true);

      if (restorePostsResult.error) {
        return Response.json({ error: '기존 글을 복구하지 못했습니다.' }, { status: 500 });
      }

      const restoreCommentsResult = await supabaseAdmin
        .from('post_comments')
        .update({
          is_deleted: false,
          is_locked: false,
          deleted_by: null,
          deleted_at: null,
          deleted_message: null,
        })
        .eq('site_id', siteResult.data.id)
        .eq('user_id', normalizedUserId)
        .eq('is_locked', true);

      if (restoreCommentsResult.error) {
        return Response.json({ error: '기존 댓글을 복구하지 못했습니다.' }, { status: 500 });
      }
    }

    if (mode === 'reset') {
      const postsResult = await supabaseAdmin
        .from('posts')
        .select('*')
        .eq('site_id', siteResult.data.id)
        .eq('user_id', normalizedUserId)
        .eq('is_locked', true);

      console.log('postsResult: ', postsResult);

      if (postsResult.error) {
        return Response.json({ error: '기존 글을 불러오지 못했습니다.' }, { status: 500 });
      }

      const posts = (postsResult.data ?? []) as PostRow[];
      const postIds = posts.map((post) => post.id);
      const postImagePaths = new Set<string>();
      const ogImagePaths = new Set<string>();

      posts.forEach((post) => {
        addStructuredPostImagePaths(postImagePaths, post, normalizedUserId);
        addEditorPostImagePaths(postImagePaths, post.content_html, normalizedUserId);
        addEditorPostImagePaths(postImagePaths, post.content_markdown, normalizedUserId);
        addOgImagePath(ogImagePaths, post.og_image);
      });

      await removeStorageFiles(POST_BUCKET, [...postImagePaths], '기존 이미지 파일을 삭제하지 못했습니다.');
      await removeStorageFiles(
        OG_IMAGE_BUCKET,
        [...ogImagePaths],
        '기존 오픈그래프 이미지 파일을 삭제하지 못했습니다.',
      );

      if (postIds.length > 0) {
        const deletePostDrawsResult = await supabaseAdmin
          .from('post_draws')
          .delete()
          .eq('user_id', normalizedUserId)
          .in('post_id', postIds);

        if (deletePostDrawsResult.error) {
          return Response.json({ error: '기존 추첨 참여 정보를 삭제하지 못했습니다.' }, { status: 500 });
        }

        const deletePostPollsResult = await supabaseAdmin
          .from('post_polls')
          .delete()
          .eq('creator_id', normalizedUserId)
          .in('post_id', postIds);

        if (deletePostPollsResult.error) {
          return Response.json({ error: '기존 투표 정보를 삭제하지 못했습니다.' }, { status: 500 });
        }
      }

      const deleteCommentsResult = await supabaseAdmin
        .from('post_comments')
        .delete()
        .eq('site_id', siteResult.data.id)
        .eq('user_id', normalizedUserId)
        .eq('is_locked', true);

      if (deleteCommentsResult.error) {
        return Response.json({ error: '기존 댓글을 삭제하지 못했습니다.' }, { status: 500 });
      }

      if (postIds.length > 0) {
        const deletePostsResult = await supabaseAdmin
          .from('posts')
          .delete()
          .eq('site_id', siteResult.data.id)
          .eq('user_id', normalizedUserId)
          .eq('is_locked', true)
          .in('id', postIds);

        if (deletePostsResult.error) {
          return Response.json({ error: '기존 글을 삭제하지 못했습니다.' }, { status: 500 });
        }
      }
    }

    const updateMembershipResult = await supabaseAdmin
      .from('rhizome_stigmas')
      .update({
        withdrawn_at: null,
        is_rejoin: false,
        is_approval: true,
      })
      .eq('id', membershipResult.data.id)
      .eq('site_id', siteResult.data.id)
      .eq('user_id', normalizedUserId);

    if (updateMembershipResult.error) {
      return Response.json({ error: '재가입 처리에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      mode,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '재가입에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '재가입에 실패했습니다.' }, { status: 500 });
  }
}
