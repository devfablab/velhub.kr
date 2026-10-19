import {
  addRecommendedBlogPost,
  getBlogRecommendationContext,
  getRecommendedBlogPosts,
  removeRecommendedBlogPost,
  reorderRecommendedBlogPosts,
} from '@/lib/blogRecommendations/server';
import { normalizeText } from '@/lib/utils';

type PostRequestBody = {
  siteName?: unknown;
  postId?: unknown;
};

type PutRequestBody = {
  siteName?: unknown;
  postIds?: unknown;
};

function getErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (
    message === 'siteName이 유효하지 않습니다.' ||
    message === '게시물이 유효하지 않습니다.' ||
    message === '추천 게시물은 최대 20개까지 설정할 수 있습니다.' ||
    message === '추천 게시물 순서가 유효하지 않습니다.'
  ) {
    return 400;
  }

  if (message === '블로그를 찾을 수 없습니다.' || message.includes('찾을 수 없습니다.')) {
    return 404;
  }

  if (message === '접근 권한이 없습니다.') {
    return 403;
  }

  return 500;
}

function getPostId(value: unknown) {
  return normalizeText(typeof value === 'string' ? value : '');
}

function getPostIds(value: unknown) {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    return null;
  }

  return value.map((item) => normalizeText(item));
}

export async function GET(request: Request) {
  try {
    const siteName = normalizeText(new URL(request.url).searchParams.get('siteName')).toLowerCase();
    const context = await getBlogRecommendationContext(siteName);
    const posts = await getRecommendedBlogPosts(context);

    return Response.json({ posts, maxPosts: 20 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '추천 게시물을 불러오지 못했습니다.' },
      { status: getErrorStatus(error) },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PostRequestBody;
    const siteName = normalizeText(typeof body.siteName === 'string' ? body.siteName : '').toLowerCase();
    const postId = getPostId(body.postId);
    const context = await getBlogRecommendationContext(siteName);
    const posts = await addRecommendedBlogPost(context, postId);

    return Response.json({ posts, maxPosts: 20 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '추천 게시물을 추가하지 못했습니다.' },
      { status: getErrorStatus(error) },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as PostRequestBody;
    const siteName = normalizeText(typeof body.siteName === 'string' ? body.siteName : '').toLowerCase();
    const postId = getPostId(body.postId);
    const context = await getBlogRecommendationContext(siteName);
    const posts = await removeRecommendedBlogPost(context, postId);

    return Response.json({ posts, maxPosts: 20 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '추천 게시물을 삭제하지 못했습니다.' },
      { status: getErrorStatus(error) },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as PutRequestBody;
    const siteName = normalizeText(typeof body.siteName === 'string' ? body.siteName : '').toLowerCase();
    const postIds = getPostIds(body.postIds);

    if (!postIds) {
      return Response.json({ error: '추천 게시물 순서가 유효하지 않습니다.' }, { status: 400 });
    }

    const context = await getBlogRecommendationContext(siteName);
    const posts = await reorderRecommendedBlogPosts(context, postIds);

    return Response.json({ posts, maxPosts: 20 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '추천 게시물 순서를 저장하지 못했습니다.' },
      { status: getErrorStatus(error) },
    );
  }
}
