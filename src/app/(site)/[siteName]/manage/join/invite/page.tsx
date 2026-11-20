import { getSiteApiData } from '@/lib/service/site/getSiteApiData';
import Opt from './opt';
import type { InviteResponse } from './opt';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<InviteResponse>(
    `/api/manage/join/invite?siteName=${siteName}`,
    '초대 목록을 불러오지 못했습니다.',
  );
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
