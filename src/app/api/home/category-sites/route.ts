import { getCategoryRisingSites } from '@/lib/service/lounge/loungeMoments';

export async function GET() {
  try {
    return Response.json({ groups: await getCategoryRisingSites(20) });
  } catch (error) {
    console.error('[API home/category-sites]', error);
    return Response.json({ error: '주제별 사이트를 불러오지 못했습니다.' }, { status: 500 });
  }
}
