import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import Opt from './opt';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type SiteInfo = {
  created_at: string;
  site_key: string;
  site_label: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  summary: string | null;
  site_type: string;
  visibility_type: string;
  theme_type: string;
  is_shutdown: boolean;
};

type MemberGeneral = {
  id: string;
  created_at: string;
  name_ko: string | null;
  name_en: string | null;
  description_ko: string | null;
  description_en: string | null;
  start_work_date: string | null;
  job: string | null;
  member_id: string;
  site_id: string;
  nickname: string;
  isMine: boolean;
};

type MemberEducation = {
  id: string;
  created_at: string;
  school: string;
  major: string | null;
  start_date: string | null;
  end_date: string | null;
  member_id: string;
  site_id: string;
  sort_order: number;
  nickname: string;
  isMine: boolean;
};

type MemberAward = {
  id: string;
  created_at: string;
  subject: string;
  institution: string;
  date_time: string | null;
  member_id: string;
  site_id: string;
  sort_order: number;
  nickname: string;
  isMine: boolean;
};

type MemberProject = {
  id: string;
  created_at: string;
  work_start_date: string | null;
  work_end_date: string | null;
  subject: string;
  description: string | null;
  client: string | null;
  agency: string | null;
  site_name: string | null;
  site_url: string | null;
  member_id: string;
  site_id: string;
  sort_order: number;
  nickname: string;
  isMine: boolean;
};

type MemberCareer = {
  id: string;
  created_at: string;
  organization: string;
  team_position: string;
  role_job: string;
  work_start_date: string | null;
  work_end_date: string | null;
  member_id: string;
  site_id: string;
  sort_order: number;
  nickname: string;
  isMine: boolean;
};

type BlogInfoResponse = {
  siteInfo?: SiteInfo;
  profilePictureUrl?: string;
  profileLogoUrl?: string;
  memberGeneral?: MemberGeneral[];
  memberEducations?: MemberEducation[];
  memberAwards?: MemberAward[];
  memberProjects?: MemberProject[];
  memberCareers?: MemberCareer[];
  canEditMyMemberGeneral?: boolean;
  error?: string;
};

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? '';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const cookie = requestHeaders.get('cookie') ?? '';

  const response = await fetch(`${protocol}://${host}/api/team-blog?siteName=${normalizedSiteName}`, {
    method: 'GET',
    headers: {
      cookie,
    },
    cache: 'no-store',
  });

  const result = (await response.json()) as BlogInfoResponse;

  if (!response.ok || !result.siteInfo) {
    return (
      <main>
        <div className="container">
          <div className="content">
            <div className="paper paper-error">{result.error ?? '블로그 정보를 불러오지 못했습니다.'}</div>
          </div>
        </div>
      </main>
    );
  }

  if (result.siteInfo.site_type === 'community') {
    return redirect(`/${siteName}`);
  }

  return (
    <Opt
      siteName={normalizedSiteName}
      siteInfo={result.siteInfo}
      memberGeneral={result.memberGeneral ?? []}
      memberEducations={result.memberEducations ?? []}
      memberAwards={result.memberAwards ?? []}
      memberProjects={result.memberProjects ?? []}
      memberCareers={result.memberCareers ?? []}
      canEditMyMemberGeneral={result.canEditMyMemberGeneral === true}
    />
  );
}
