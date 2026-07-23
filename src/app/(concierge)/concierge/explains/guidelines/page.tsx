import Anchor from '@/components/Anchor';
import Container from '../../menu';
import Opt from './opt';
import styles from '@/app/concierge.module.sass';
import { Stack } from '@mui/material';

export default function Page() {
  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <Stack direction="row" justifyContent="space-between">
            <h1>가이드라인 위반</h1>
            <Anchor href="/concierge/explains" className="button small action">
              이전화면으로 이동
            </Anchor>
          </Stack>
          <Opt />
        </div>
      </div>
    </Container>
  );
}
