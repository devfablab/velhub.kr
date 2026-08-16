import { Metadata } from 'next';
import { Stack, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import Container from '../menu';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '컨시어지 문의하기 - 데브허브',
  description: '데브허브 컨시어지 문의 안내',
};

export default function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>컨시어지 문의하기</h1>
          <div className="paper">
            <Typography>
              결제 · 환불 처리 오류, 계정 · 본인인증, 작가 · 정산, 서비스 이용, 기능 오류를 문의할 수 있습니다.
            </Typography>
            <Typography>
              미성년자 결제 청약취소는 결제 한 건을 선택해 접수해 주세요. 신고는 신고센터를 이용해 주세요.
            </Typography>
            <Stack direction="row" justifyContent="center">
              <Anchor href="/concierge/contact/inquiries" className="button medium action">
                문의 접수 및 내역 보기
              </Anchor>
            </Stack>
          </div>
        </div>
      </div>
    </Container>
  );
}
