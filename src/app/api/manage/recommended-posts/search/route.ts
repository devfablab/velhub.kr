import { getBlogRecommendationContext, searchRecommendedBlogPosts } from '@/lib/blogRecommendations/server';
import { normalizeText } from '@/lib/utils';

function getErrorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : '';

  if (message === 'siteName이 유효하지 않습니다.') {
    return 400;
  }

  if (message === '블로그를 찾을 수 없습니다.') {
    return 404;
  }

  if (message === '접근 권한이 없습니다.') {
    return 403;
  }

  return 500;
}

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const siteName = normalizeText(requestUrl.searchParams.get('siteName')).toLowerCase();
    const keyword = normalizeText(requestUrl.searchParams.get('keyword'));
    const context = await getBlogRecommendationContext(siteName);
    const posts = await searchRecommendedBlogPosts(context, keyword);

    return Response.json({ posts });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : '게시물을 검색하지 못했습니다.' },
      { status: getErrorStatus(error) },
    );
  }
}
