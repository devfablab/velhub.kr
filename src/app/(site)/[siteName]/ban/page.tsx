import { isPast } from 'date-fns';
import { getSiteApiData } from '../../getSiteApiData';
import Opt, { type UserInfoResponse } from './opt';

export default async function Page({ params }: { params: Promise<{ siteName: string }> }) {
  const { siteName } = await params;
  const initial = await getSiteApiData<UserInfoResponse>(
    `/api/users/${siteName}/me`,
    '가입 불가 정보를 불러오지 못했습니다.',
  );
  const isBanned = initial.data?.status === 'banned' && Boolean(initial.data.userInfo);

  return (
    <Opt
      siteName={siteName}
      initialUserInfo={isBanned ? (initial.data?.userInfo ?? null) : null}
      initialError={
        isBanned ? initial.error : initial.data?.error || initial.error || '가입 불가 정보를 불러오지 못했습니다.'
      }
      canRejoin={Boolean(initial.data?.userInfo?.banTerm && isPast(new Date(initial.data.userInfo.banTerm)))}
    />
  );
}
