import { Metadata } from 'next';
import { Stack } from '@mui/material';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = { title: '제휴 제안 접수 - 데브허브', description: '데브허브 제휴 제안 접수 안내' };

export default function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles.minimal}`}>
          <h1>제휴 제안 결과</h1>
          <div className="paper">
            <ScreenState>보내신 제휴 제안 내용의 답변은 이메일로 받으실 수 있습니다.</ScreenState>
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Anchor href="/concierge/partnerships" className="button medium action">
                제휴 제안 내역 보기
              </Anchor>
            </Stack>
          </div>
        </div>
      </div>
    </Container>
  );
}
