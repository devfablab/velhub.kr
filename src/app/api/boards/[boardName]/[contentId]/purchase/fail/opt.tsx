'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { normalizeText } from '@/lib/utils';

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
  const hasProcessedRef = useRef(false);

  const siteName = normalizeText(params.siteName).toLowerCase();
  const boardName = normalizeText(params.boardName).toLowerCase();
  const contentId = normalizeText(params.contentId);

  const [message, setMessage] = useState('포스팅 구매가 취소되었거나 실패했습니다.');
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    async function saveFailPayment() {
      try {
        const orderNo = normalizeText(searchParams.get('orderId')) || normalizeText(searchParams.get('orderNo'));
        const code = normalizeText(searchParams.get('code'));
        const failMessage = normalizeText(searchParams.get('message'));
        const siteId = normalizeText(searchParams.get('siteId'));
        const postId = normalizeText(searchParams.get('postId'));

        if (!orderNo || !siteId || !postId) {
          throw new Error('포스팅 구매 실패 정보를 저장하지 못했습니다.');
        }

        const response = await fetch('/api/payments/toss/fail', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentType: 'post_purchase',
            targetType: 'post',
            orderNo,
            code,
            message: failMessage,
            siteId,
            postId,
          }),
        });

        const result = (await response.json()) as PaymentFailResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '포스팅 구매 실패 정보를 저장하지 못했습니다.');
        }

        setMessage(failMessage || '포스팅 구매가 취소되었거나 실패했습니다.');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setMessage(unknownError.message || '포스팅 구매가 취소되었거나 실패했습니다.');
        } else {
          setMessage('포스팅 구매가 취소되었거나 실패했습니다.');
        }
      } finally {
        setIsProcessing(false);
      }
    }

    if (hasProcessedRef.current) {
      return;
    }

    hasProcessedRef.current = true;
    void saveFailPayment();
  }, [searchParams]);

  function handleGoBack() {
    router.replace(`/${siteName}/${boardName}/${contentId}`);
  }

  if (isProcessing) {
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
              <Typography role="alert">{message}</Typography>
              <Button type="button" variant="contained" onClick={handleGoBack}>
                글로 돌아가기
              </Button>
            </Stack>
          </div>
        </div>
      </div>
    </main>
  );
}
