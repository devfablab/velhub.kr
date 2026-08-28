'use client';

import { useParams, useSearchParams } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();

  const siteName = normalizeText(params.siteName).toLowerCase();
  const message = normalizeText(searchParams.get('message')) || '블로그 구독 가입이 취소되었거나 실패했습니다.';

  return (
    <div className="paper">
      <Typography variant="h1">블로그 구독 가입 실패</Typography>

      <p className="alert error">
        <ErrorOutlineRoundedIcon />
        <span>{message}</span>
      </p>

      <Anchor href={`/${siteName}`} className={`/${siteName}`}>
        사이트로 이동
      </Anchor>
    </div>
  );
}
