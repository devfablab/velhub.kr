import { Metadata } from 'next';
import { Stack, Typography } from '@mui/material';
import { getSupabaseAuthHealth } from '@/lib/auth/health.server';
import Anchor from '@/components/Anchor';
import Container from '../container';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '인증 서버 상태 - 데브허브',
  description: '데브허브 인증 서버 상태',
};

export default async function Page() {
  const authHealth = await getSupabaseAuthHealth();
  const isOperational = authHealth.status === 'operational';
  const isOutage = authHealth.status === 'outage';

  return (
    <Container>
      <div className={`paper ${isOperational ? 'page-info' : 'page-error'}`}>
        <Typography variant="subtitle2">
          {isOperational ? '인증 서버가 정상적으로 동작 중입니다.' : '인증 서버 상태를 확인해 주세요.'}
        </Typography>
        <Typography variant="body2">
          {isOperational
            ? '현재 인증 서버는 정상 상태입니다.'
            : isOutage
              ? '현재 인증 서버에 문제가 발생했습니다. 복구될 때까지 데브허브는 읽기만 가능합니다.'
              : '인증 서버 상태를 확인하지 못했습니다. 잠시 후 다시 확인해 주세요.'}
        </Typography>
        <Stack gap={1.5} direction="row" sx={{ mt: 2 }}>
          <Anchor href="/" className="button small action">
            라운지로 이동
          </Anchor>
          {isOperational ? (
            <Anchor href="/auth/sign-in" className="button small submit">
              로그인
            </Anchor>
          ) : null}
        </Stack>
      </div>
    </Container>
  );
}
