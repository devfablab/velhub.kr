import SiteInfo from '@/components/service/community/SiteInfo';
import { getSiteApiData } from '../../../getSiteApiData';
import Container from '../../menu';
import Aside from './aside';
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
    `/api/manage/join/invite/${token}?siteName=${siteName}`,
    '초대 정보를 불러오지 못했습니다.',
  );

  return (
    <Container pageBack={`/${siteName}`} pageTitle="커뮤니티 가입">
      <div className="container">
        <aside>
          <SiteInfo />
        </aside>
        <div className={`content ${styles.content} ${styles['home-content']} `}>
          <Opt siteName={siteName} token={token} initialData={initial.data} initialError={initial.error} />
        </div>
        <Aside />
      </div>
    </Container>
  );
}
