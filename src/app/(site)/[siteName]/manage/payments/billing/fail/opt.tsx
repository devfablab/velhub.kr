'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
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
    <Container pageTitle="결제수단 등록 실패">
      <Paper variant="outlined">
        <Stack spacing={2} sx={{ p: 3 }}>
          <Typography variant="h6">결제수단 등록에 실패했습니다.</Typography>
          <Typography>결제수단을 다시 등록해 주세요.</Typography>

          {message ? (
            <Typography role="status" color="error">
              {message}
            </Typography>
          ) : null}

          <div>
            <Button type="button" variant="contained" onClick={handleRetry}>
              다시 등록하기
            </Button>
          </div>
        </Stack>
      </Paper>
    </Container>
  );
}
