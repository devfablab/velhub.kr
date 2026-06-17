'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const message = normalizeText(searchParams.get('message'));

  function handleGoSite() {
    router.replace(`/${siteName}`);
  }

  return (
    <div className="paper">
      <Stack spacing={2}>
        <Typography variant="h6">후원 결제에 실패했습니다.</Typography>
        <Typography>후원을 다시 시도해 주세요.</Typography>

        {message ? (
          <Typography role="status" color="error">
            {message}
          </Typography>
        ) : null}

        <div>
          <Button type="button" variant="contained" onClick={handleGoSite}>
            사이트로 이동
          </Button>
        </div>
      </Stack>
    </div>
  );
}
