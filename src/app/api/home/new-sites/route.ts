import { getNewMomentSites } from '@/lib/lounge/moments';

export async function GET() {
  try {
    return Response.json({ sites: await getNewMomentSites(10, false) });
  } catch (error) {
    console.error('[API home/new-sites]', error);
    return Response.json({ error: '새로 오픈한 사이트를 불러오지 못했습니다.' }, { status: 500 });
  }
}
