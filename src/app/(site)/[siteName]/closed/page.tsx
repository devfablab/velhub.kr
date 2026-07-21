import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import Anchor from '@/components/Anchor';
import { getCurrentStigma, getRhizomeStigma, getSiteByName } from '@/lib/session/utils';
import { normalizeText } from '@/lib/utils';
import Container from '../menu';
import styles from '@/app/board.module.sass';

type PageProps = {
  params: Promise<{
    siteName: string;
  }>;
};

export default async function Page({ params }: PageProps) {
  const { siteName: rawSiteName } = await params;
  const siteName = normalizeText(rawSiteName).toLowerCase();
  const currentStigma = await getCurrentStigma();
  const site = siteName ? await getSiteByName(siteName) : null;
  const membership = currentStigma && site ? await getRhizomeStigma(site.id, currentStigma.stigmaId) : null;
  const isOwner = membership?.role === 'owner';

  return (
    <Container>
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper pape-error">
            <NearbyErrorRoundedIcon />
            <h2>운영 중단</h2>
            <p>해당 사이트는 운영자의 사정에 의해 운영 중단되었습니다.</p>
            {isOwner ? (
              <Anchor href="/concierge/rights" className="button medium submit">
                운영중단 해제요청
              </Anchor>
            ) : (
              <Anchor href="/" className="button medium submit">
                라운지로 이동
              </Anchor>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
