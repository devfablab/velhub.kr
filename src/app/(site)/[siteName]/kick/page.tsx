import { isPast } from 'date-fns';
import { getSiteApiData } from '../../getSiteApiData';
import Opt, { type UserInfoResponse } from './opt';

export default async function Page({ params }: { params: Promise<{ siteName: string }> }) {
  const { siteName } = await params;
  const initial = await getSiteApiData<UserInfoResponse>(
    `/api/users/${siteName}/me`,
    '강제 탈퇴 정보를 불러오지 못했습니다.',
  );
  const isKicked = initial.data?.status === 'kicked' && Boolean(initial.data.userInfo);

  return (
    <Opt
      siteName={siteName}
      initialUserInfo={isKicked ? (initial.data?.userInfo ?? null) : null}
      initialError={
        isKicked ? initial.error : initial.data?.error || initial.error || '강제 탈퇴 정보를 불러오지 못했습니다.'
      }
      canRejoin={Boolean(initial.data?.userInfo?.kickTerm && isPast(new Date(initial.data.userInfo.kickTerm)))}
    />
  );
}
