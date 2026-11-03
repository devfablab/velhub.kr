import { getNewMomentSites } from '@/lib/service/lounge/loungeMoments';

export async function GET() {
  try {
    return Response.json({ sites: await getNewMomentSites() });
  } catch (error) {
    console.error('[API home/moments/new-sites]', error);
    return Response.json({ error: '새로 문 연 공간을 불러오지 못했습니다.' }, { status: 500 });
  }
}
