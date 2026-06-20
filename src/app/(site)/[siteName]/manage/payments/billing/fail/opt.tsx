'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';
import Container from '../../../menu';

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const siteName = normalizeText(params.siteName);
  const message = normalizeText(searchParams.get('message'));

  function handleRetry() {
    router.replace(`/${siteName}/manage/payments/billing`);
  }

  return (
    <Container menu="payments">
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={3} alignItems="center">
          <Typography variant="h6" component="h1">
            결제수단 등록에 실패했습니다.
          </Typography>
          <Typography>결제수단을 다시 등록해 주세요.</Typography>
          {message ? (
            <Typography color="error" role="alert">
              {message}
            </Typography>
          ) : null}
          <Button type="button" variant="contained" onClick={handleRetry}>
            다시 등록하기
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}
