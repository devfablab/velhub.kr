import { getMostReadMomentPosts } from '@/lib/lounge/moments';

export async function GET() {
  try {
    return Response.json({ posts: await getMostReadMomentPosts() });
  } catch (error) {
    console.error('[API home/moments/popular-posts]', error);
    return Response.json({ error: '지금 많이 읽는 글을 불러오지 못했습니다.' }, { status: 500 });
  }
}
