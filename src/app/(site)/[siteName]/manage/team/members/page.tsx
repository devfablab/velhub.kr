import Opt from './opt';
import type { InviteResponse, TeamResponse } from './opt';
import { getSiteApiData } from '@/app/(site)/getSiteApiData';

type RouteContext = { params: Promise<{ siteName: string }> };

export default async function Page({ params }: RouteContext) {
  const { siteName } = await params;
  const [teams, invites] = await Promise.all([
    getSiteApiData<TeamResponse>(`/api/manage/team/members?siteName=${siteName}`, '팀블로그 목록을 불러오지 못했습니다.'),
    getSiteApiData<InviteResponse>(`/api/manage/team/members/invite?siteName=${siteName}`, '초대 목록을 불러오지 못했습니다.'),
  ]);
  return <Opt initialTeams={teams.data} initialInvites={invites.data} initialError={teams.error || invites.error} />;
}
