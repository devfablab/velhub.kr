'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';

type SubscriptionTargetType = 'board' | 'series';

type FailResponse = {
  ok?: boolean;
  error?: string;
};

function getTargetType(value: string): SubscriptionTargetType | null {
  if (value === 'board' || value === 'series') {
    return value;
  }

  return null;
}

function getDefaultMessage(targetType: SubscriptionTargetType | null) {
  if (targetType === 'series') {
    return '연재 구독이 취소되었거나 실패했습니다.';
  }

  return '게시판 구독이 취소되었거나 실패했습니다.';
}

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hasRequestedRef = useRef(false);

  const siteName = normalizeText(params.siteName).toLowerCase();
  const boardName = normalizeText(params.boardName).toLowerCase();

  const targetType = getTargetType(normalizeText(searchParams.get('targetType')));
  const seriesName = normalizeText(searchParams.get('seriesName')).toLowerCase();
  const message = normalizeText(searchParams.get('message')) || getDefaultMessage(targetType);

  const [logErrorMessage, setLogErrorMessage] = useState('');

  useEffect(() => {
    async function saveFailLog() {
      const orderNo = normalizeText(searchParams.get('orderNo'));
      const amount = Number(normalizeText(searchParams.get('amount')));
      const code = normalizeText(searchParams.get('code'));
      const paymentType = normalizeText(searchParams.get('paymentType'));
      const siteId = normalizeText(searchParams.get('siteId'));
      const boardId = normalizeText(searchParams.get('boardId'));
      const seriesId = normalizeText(searchParams.get('seriesId'));

      if (!orderNo || !paymentType || !targetType || !siteId) {
        return;
      }

      try {
        const response = await fetch('/api/payments/portone/fail', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderNo,
            amount: Number.isFinite(amount) ? amount : 0,
            code,
            message,
            paymentType,
            targetType,
            siteId,
            boardId,
            seriesId,
            boardName,
            seriesName: targetType === 'series' ? seriesName : null,
          }),
        });

        const result = (await response.json()) as FailResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '실패 내역을 저장하지 못했습니다.');
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setLogErrorMessage(unknownError.message || '실패 내역을 저장하지 못했습니다.');
        } else {
          setLogErrorMessage('실패 내역을 저장하지 못했습니다.');
        }
      }
    }

    if (hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;
    void saveFailLog();
  }, [boardName, message, searchParams, seriesName, siteName, targetType]);

  return (
    <main>
      <div className="container">
        <div className="content">
          <div className="paper">
            <Stack gap={3} alignItems="center">
              <Typography variant="h5" component="h1">
                {targetType === 'series' ? '연재 구독 실패' : '게시판 구독 실패'}
              </Typography>
              <Typography role="alert">{message}</Typography>
              {logErrorMessage ? (
                <Typography color="error" role="alert">
                  {logErrorMessage}
                </Typography>
              ) : null}
              <Button type="button" variant="contained" href={`/${siteName}/${boardName}`}>
                게시판으로 이동
              </Button>
            </Stack>
          </div>
        </div>
      </div>
    </main>
  );
}
