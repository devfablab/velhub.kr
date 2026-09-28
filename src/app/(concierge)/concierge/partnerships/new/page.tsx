import { Metadata } from 'next';
import { getPartnershipFormInfo } from '@/lib/partnerships/server';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = { title: '제휴 제안하기 - 데브허브', description: '데브허브 제휴 제안 접수' };

export default async function Page() {
  let formInfo = null;
  try {
    formInfo = await getPartnershipFormInfo();
  } catch {
    formInfo = null;
  }

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <h1>제휴 제안하기</h1>
          {formInfo ? (
            <Opt formInfo={formInfo} />
          ) : (
            <ScreenState kind="error">제휴 제안 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</ScreenState>
          )}
        </div>
      </div>
    </Container>
  );
}
