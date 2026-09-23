import { getSitePageMetadata } from '@/lib/seoSite';
import { getSiteApiData } from '../../getSiteApiData';
import Opt, { type UserInfoResponse } from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

export async function generateMetadata(context: RouteContext) {
  const { siteName } = await context.params;

  return getSitePageMetadata({
    siteName,
    pageTitle: '활동 정지',
    pagePath: '/block',
  });
}

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const initial = await getSiteApiData<UserInfoResponse>(
    `/api/users/${siteName}/me`,
    '차단 정보를 불러오지 못했습니다.',
  );
  const isBlocked = initial.data?.status === 'blocked' && initial.data.isBlock === true;

  return (
    <Opt
      siteName={siteName}
      initialData={isBlocked ? initial.data : null}
      initialError={
        isBlocked ? initial.error : initial.data?.error || initial.error || '차단 정보를 불러오지 못했습니다.'
      }
    />
  );
}
