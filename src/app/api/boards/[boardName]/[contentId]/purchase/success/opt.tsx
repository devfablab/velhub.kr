'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { normalizeText } from '@/lib/utils';

type PurchaseSuccessResponse = {
  ok?: boolean;
  paymentId?: string;
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

  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function completePurchase() {
      try {
        const paymentKey = normalizeText(searchParams.get('paymentKey'));
        const orderId = normalizeText(searchParams.get('orderId'));
        const amountText = normalizeText(searchParams.get('amount'));
        const siteId = normalizeText(searchParams.get('siteId'));
        const postId = normalizeText(searchParams.get('postId'));
        const amount = Number(amountText);

        if (!paymentKey || !orderId || !siteId || !postId || !Number.isFinite(amount)) {
          throw new Error('포스팅 구매 승인 정보가 올바르지 않습니다.');
        }

        const response = await fetch('/api/payments/toss/purchase/success', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            amount,
            siteId,
            postId,
          }),
        });

        const result = (await response.json()) as PurchaseSuccessResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '포스팅 구매를 완료하지 못했습니다.');
        }

        router.replace(`/${siteName}/${boardName}/${contentId}`);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '포스팅 구매를 완료하지 못했습니다.');
        } else {
          setErrorMessage('포스팅 구매를 완료하지 못했습니다.');
        }
      }
    }

    if (hasProcessedRef.current) {
      return;
    }

    hasProcessedRef.current = true;
    void completePurchase();
  }, [boardName, contentId, router, searchParams, siteName]);

  function handleGoPost() {
    router.replace(`/${siteName}/${boardName}/${contentId}`);
  }

  if (errorMessage) {
    return (
      <main>
        <div className="container">
          <div className="content">
            <div className="paper">
              <Stack gap={3} alignItems="center">
                <Typography color="error" role="alert">
                  {errorMessage}
                </Typography>
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
