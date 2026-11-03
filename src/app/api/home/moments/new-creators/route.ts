import { getNewMomentCreators } from '@/lib/lounge/moments';

export async function GET() {
  try {
    return Response.json({ creators: await getNewMomentCreators() });
  } catch (error) {
    console.error('[API home/moments/new-creators]', error);
    return Response.json({ error: '새 작가의 서재를 불러오지 못했습니다.' }, { status: 500 });
  }
}
