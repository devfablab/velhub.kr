'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();

  const siteName = normalizeText(params.siteName).toLowerCase();
  const message = normalizeText(searchParams.get('message')) || '멤버십 가입이 취소되었거나 실패했습니다.';

  return (
    <div className="paper">
      <Typography variant="h1">멤버십 가입 실패</Typography>

      <Typography role="status" color="error">
        {message}
      </Typography>

      <Button type="button" href={`/${siteName}`} variant="contained">
        사이트로 이동
      </Button>
    </div>
  );
}
