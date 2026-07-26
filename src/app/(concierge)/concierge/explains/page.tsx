import { Metadata } from 'next';
import { Stack } from '@mui/material';
import Anchor from '@/components/Anchor';
import Container from '../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';

export const metadata: Metadata = {
  title: '소명센터 - 데브허브',
  description: '소명센터',
};

export default function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Stack direction="row" justifyContent="space-between">
            <h1>소명센터</h1>
            <Anchor href="/concierge/explains/guidelines" className="button small action">
              가이드라인 소명 보기
            </Anchor>
          </Stack>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
