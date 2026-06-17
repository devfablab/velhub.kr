'use client';

import { useParams, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();

  const siteName = normalizeText(params.siteName).toLowerCase();
  const boardName = normalizeText(params.boardName).toLowerCase();
  const message = normalizeText(searchParams.get('message')) || '게시판 구독이 취소되었거나 실패했습니다.';

  return (
    <div className="paper">
      <Typography variant="h1">게시판 구독 실패</Typography>

      <Typography role="status" color="error">
        {message}
      </Typography>

      <Button type="button" href={`/${siteName}/${boardName}`} variant="contained">
        게시판으로 이동
      </Button>
    </div>
  );
}
