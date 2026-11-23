import { readPublicCache } from '@/lib/publicCache';
import { getCategoryRisingSites } from '@/lib/service/lounge/loungeMoments';

export async function GET() {
  try {
    const groups = await readPublicCache({
      key: 'lounge:category-sites:20',
      tags: ['posts', 'sites'],
      ttlSeconds: 300,
      load: () => getCategoryRisingSites(20),
    });

    return Response.json({ groups });
  } catch (error) {
    console.error('[API home/category-sites]', error);
    return Response.json({ error: '주제별 사이트를 불러오지 못했습니다.' }, { status: 500 });
  }
}
