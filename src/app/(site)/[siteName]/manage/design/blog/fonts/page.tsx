import Opt from './opt';
import type { BlogFontResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<BlogFontResponse>(`/api/manage/design/blog/fonts?siteName=${siteName}`, '기본 서체 설정을 불러오지 못했습니다.');
  return <Opt initialData={initial.data} initialError={initial.error} />;
}
