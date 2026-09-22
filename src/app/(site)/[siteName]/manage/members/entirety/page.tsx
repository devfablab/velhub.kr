import Opt from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';
import type { LevelsResponse, UsersResponse } from './opt';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const [usersInitial, levelsInitial] = await Promise.all([
    getSiteApiData<UsersResponse>(`/api/users/${siteName}`, '멤버 목록을 불러오지 못했습니다.'),
    getSiteApiData<LevelsResponse>(`/api/manage/members/levels?siteName=${siteName}`, '등급 정보를 불러오지 못했습니다.'),
  ]);

  return (
    <Opt
      initialUsers={usersInitial.data}
      initialLevels={levelsInitial.data}
      initialError={usersInitial.error || levelsInitial.error}
    />
  );
}
