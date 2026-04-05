import { redirect } from 'next/navigation';
import { Box, Container, Stack, Typography } from '@mui/material';
import { getSessionClaims } from '@/lib/session';
import Opt from './opt';

export default async function Page() {
  const sessionClaims = await getSessionClaims();

  if (!sessionClaims) {
    redirect('/auth/sign-in');
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack spacing={4}>
          <Typography variant="h4" component="h1">
            블로그 생성
          </Typography>

          <Opt />
        </Stack>
      </Box>
    </Container>
  );
}
