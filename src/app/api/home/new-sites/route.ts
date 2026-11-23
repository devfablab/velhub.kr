import { readPublicCache } from '@/lib/publicCache';
import { getNewMomentSites } from '@/lib/service/lounge/loungeMoments';

export async function GET() {
  try {
    const sites = await readPublicCache({
      key: 'lounge:new-sites:10',
      tags: ['posts', 'sites'],
      ttlSeconds: 300,
      load: () => getNewMomentSites(10, 'all'),
    });

    return Response.json({ sites });
  } catch (error) {
    console.error('[API home/new-sites]', error);
    return Response.json({ error: '새로 오픈한 사이트를 불러오지 못했습니다.' }, { status: 500 });
  }
}
