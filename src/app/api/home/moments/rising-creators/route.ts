import { getRisingMomentCreators } from '@/lib/service/lounge/loungeMoments';

export async function GET() {
  try {
    return Response.json({ creators: await getRisingMomentCreators() });
  } catch (error) {
    console.error('[API home/moments/rising-creators]', error);
    return Response.json({ error: '인기 급상승 서재를 불러오지 못했습니다.' }, { status: 500 });
  }
}
