import SiteProfile from '@/components/service/blog/SiteProfile';
import { getSiteApiData } from '../../../getSiteApiData';
import Container from '../../menu';
import Opt, { type InviteResponse } from './opt';
import styles from '@/app/board.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
    token: string;
  }>;
};

export default async function Page(context: RouteContext) {
  const { siteName, token } = await context.params;
  const initial = await getSiteApiData<InviteResponse>(
    `/api/manage/team/members/invite/${token}?siteName=${siteName}`,
    '초대 정보를 불러오지 못했습니다.',
  );

  return (
    <Container pageBack={`/${siteName}`} pageTitle="블로그 가입">
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']} `}>
          <SiteProfile />
          <Opt siteName={siteName} token={token} initialData={initial.data} initialError={initial.error} />
        </div>
      </div>
    </Container>
  );
}
