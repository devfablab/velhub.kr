'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { normalizeText } from '@/lib/utils';

type SubscriptionTargetType = 'board' | 'series';

type SubscriptionSuccessResponse = {
  ok?: boolean;
  subscriptionId?: string | null;
  paymentId?: string | null;
  error?: string;
};

function getTargetType(value: string): SubscriptionTargetType | null {
  if (value === 'board' || value === 'series') {
    return value;
  }

  return null;
}

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hasRequestedRef = useRef(false);

  const siteName = normalizeText(params.siteName).toLowerCase();
  const boardName = normalizeText(params.boardName).toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('구독을 처리하고 있습니다.');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function completeSubscription() {
      try {
        setErrorMessage('');

        const authKey = normalizeText(searchParams.get('authKey'));
        const customerKey = normalizeText(searchParams.get('customerKey'));
        const orderNo = normalizeText(searchParams.get('orderNo'));
        const targetType = getTargetType(normalizeText(searchParams.get('targetType')));
        const seriesName = normalizeText(searchParams.get('seriesName')).toLowerCase();

        if (!authKey || !customerKey || !orderNo || !targetType) {
          throw new Error('구독 정보가 올바르지 않습니다.');
        }

        if (targetType === 'series' && !seriesName) {
          throw new Error('연재 구독 정보가 올바르지 않습니다.');
        }

        const response = await fetch('/api/payments/toss/subscriptions/success', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            authKey,
            customerKey,
            orderNo,
            siteName,
            boardName,
            targetType,
            seriesName: targetType === 'series' ? seriesName : null,
          }),
        });

        const result = (await response.json()) as SubscriptionSuccessResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '구독을 완료하지 못했습니다.');
        }

        setMessage(targetType === 'series' ? '연재 구독이 완료되었습니다.' : '게시판 구독이 완료되었습니다.');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '구독을 완료하지 못했습니다.');
        } else {
          setErrorMessage('구독을 완료하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;
    void completeSubscription();
  }, [boardName, searchParams, siteName]);

  return (
    <main>
      <div className="container">
        <div className="content">
          <div className="paper">
            {isLoading ? (
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            ) : (
              <Stack spacing={3} alignItems="center">
                <Typography variant="h5" component="h1">
                  구독
                </Typography>
                {errorMessage ? (
                  <Typography color="error" role="alert">
                    {errorMessage}
                  </Typography>
                ) : (
                  <Typography>{message}</Typography>
                )}
                <Button type="button" variant="contained" href={`/${siteName}/${boardName}`}>
                  게시판으로 이동
                </Button>
              </Stack>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
