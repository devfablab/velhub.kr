import { redirect } from 'next/navigation';
import Opt, { type NoticeManageResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<NoticeManageResponse & { redirect?: boolean }>(
    `/api/manage/notice?siteName=${encodeURIComponent(siteName)}`,
    '공지 설정을 불러오지 못했습니다.',
  );

  // 팀 블로그이거나 운영자가 아니면 관리 홈으로 이동
  if (initial.data?.redirect) {
    redirect(`/${siteName}/manage`);
  }

  return <Opt initialData={initial.data} initialError={initial.error} />;
}
