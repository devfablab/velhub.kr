import { Metadata } from 'next';
import { getCurrentStigma } from '@/lib/session/utils';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '제안하기 - 기능 연구소 - 데브허브',
  description: '데브허브 기능 연구소 새 제안 작성',
};

export default async function Page() {
  const current = await getCurrentStigma();

  if (!current?.userId) {
    return (
      <Container>
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles.minimal}`}>
            <h1>기능 연구소 제안하기</h1>
            <ScreenState kind="error">
              로그인이 필요한 서비스입니다.
              <div style={{ marginTop: '1rem' }}>
                <Anchor href="/auth/sign-in" className="button medium action">
                  로그인하기
                </Anchor>
              </div>
            </ScreenState>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <h1>기능 연구소 제안하기</h1>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
