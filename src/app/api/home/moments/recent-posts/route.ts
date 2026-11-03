import { getRecentMomentPosts } from '@/lib/service/lounge/loungeMoments';

export async function GET() {
  try {
    return Response.json({ posts: await getRecentMomentPosts() });
  } catch (error) {
    console.error('[API home/moments/recent-posts]', error);
    return Response.json({ error: '작가들의 새 글을 불러오지 못했습니다.' }, { status: 500 });
  }
}
