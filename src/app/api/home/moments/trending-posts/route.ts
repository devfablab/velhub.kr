import { getTrendingMomentPosts } from '@/lib/service/lounge/loungeMoments';

export async function GET() {
  try {
    return Response.json({ posts: await getTrendingMomentPosts() });
  } catch (error) {
    console.error('[API home/moments/trending-posts]', error);
    return Response.json({ error: '인기 급상승 글을 불러오지 못했습니다.' }, { status: 500 });
  }
}
