'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type PaymentFailResponse = {
  ok?: boolean;
  paymentId?: string;
  status?: string;
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();

  const siteName = normalizeText(params.siteName).toLowerCase();
  const boardName = normalizeText(params.boardName).toLowerCase();
  const contentId = normalizeText(params.contentId);

  const isRequestedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isRequestedRef.current) {
      return;
    }

    isRequestedRef.current = true;

    async function saveFailLog() {
      try {
        setErrorMessage('');

        const orderNo = normalizeText(searchParams.get('orderNo')) || normalizeText(searchParams.get('orderId'));
        const code = normalizeText(searchParams.get('code'));
        const message = normalizeText(searchParams.get('message'));
        const paymentType = normalizeText(searchParams.get('paymentType'));
        const targetType = normalizeText(searchParams.get('targetType'));
        const siteId = normalizeText(searchParams.get('siteId'));
        const boardId = normalizeText(searchParams.get('boardId'));
        const seriesId = normalizeText(searchParams.get('seriesId'));
        const postId = normalizeText(searchParams.get('postId'));
        const amountText = normalizeText(searchParams.get('amount'));
        const amount = Number(amountText);

        if (!orderNo || !paymentType || !siteId || !postId || !amountText || !Number.isInteger(amount)) {
          throw new Error('후원 실패 정보를 저장하지 못했습니다.');
        }

        const response = await fetch('/api/payments/toss/fail', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentType,
            orderNo,
            code,
            message,
            siteId,
            targetType,
            boardId,
            boardName,
            seriesId,
            postId,
            contentId,
            amount,
          }),
        });

        const result = (await response.json()) as PaymentFailResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '후원 실패 정보를 저장하지 못했습니다.');
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '후원 실패 정보를 저장하지 못했습니다.');
        } else {
          setErrorMessage('후원 실패 정보를 저장하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void saveFailLog();
  }, [searchParams, boardName, contentId]);

  function handleGoPost() {
    router.replace(`/${siteName}/${boardName}/${contentId}`);
  }

  if (isLoading) {
    return (
      <main>
        <div className="container">
          <div className="content">
            <div className="paper">
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="container">
        <div className="content">
          <div className="paper">
            <Stack spacing={3} alignItems="center">
              <Typography variant="h5" component="h1">
                글 후원이 완료되지 않았습니다.
              </Typography>
              {errorMessage ? (
                <Typography color="error" role="alert">
                  {errorMessage}
                </Typography>
              ) : (
                <Typography>결제가 취소되었거나 승인되지 않았습니다.</Typography>
              )}
              <Button type="button" variant="contained" onClick={handleGoPost}>
                글로 이동
              </Button>
            </Stack>
          </div>
        </div>
      </div>
    </main>
  );
}
