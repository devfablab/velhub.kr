import Opt from './opt';
import type { BannedUsersResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<BannedUsersResponse>(
    `/api/manage/join/banned?siteName=${siteName}`,
    '가입불가 멤버 정보를 불러오지 못했습니다.',
  );
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
