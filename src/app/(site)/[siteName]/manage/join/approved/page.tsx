import Opt from './opt';
import type { JoinApprovedResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<JoinApprovedResponse>(
    `/api/manage/join/approved?siteName=${siteName}`,
    '가입 신청 정보를 불러오지 못했습니다.',
  );
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
