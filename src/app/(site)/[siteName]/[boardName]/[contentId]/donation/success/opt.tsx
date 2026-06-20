'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';

type DonationSuccessResponse = {
  ok?: boolean;
  paymentId?: string;
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hasRequestedRef = useRef(false);

  const siteName = normalizeText(params.siteName).toLowerCase();
  const boardName = normalizeText(params.boardName).toLowerCase();
  const contentId = normalizeText(params.contentId);

  const [message, setMessage] = useState('후원 결제를 처리하고 있습니다.');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function completeDonation() {
      try {
        setErrorMessage('');

        const paymentKey = normalizeText(searchParams.get('paymentKey'));
        const orderId = normalizeText(searchParams.get('orderId'));
        const amount = Number(normalizeText(searchParams.get('amount')));
        const siteId = normalizeText(searchParams.get('siteId'));
        const targetType = normalizeText(searchParams.get('targetType'));
        const postId = normalizeText(searchParams.get('postId'));

        if (!paymentKey || !orderId || !Number.isFinite(amount) || !siteId || !targetType || !postId) {
          throw new Error('후원 결제 정보가 올바르지 않습니다.');
        }

        const response = await fetch('/api/payments/toss/donation/success', {
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
            targetType,
            postId,
          }),
        });

        const result = (await response.json()) as DonationSuccessResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '후원 결제를 완료하지 못했습니다.');
        }

        setMessage('후원이 완료되었습니다.');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '후원 결제를 완료하지 못했습니다.');
        } else {
          setErrorMessage('후원 결제를 완료하지 못했습니다.');
        }
      }
    }

    if (hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;
    void completeDonation();
  }, [searchParams]);

  return (
    <main>
      <div className="container">
        <div className="content">
          <div className="paper">
            <Stack spacing={3} alignItems="center">
              <Typography variant="h5" component="h1">
                글 후원
              </Typography>
              {errorMessage ? (
                <Typography color="error" role="alert">
                  {errorMessage}
                </Typography>
              ) : (
                <Typography role="status">{message}</Typography>
              )}
              <Button type="button" variant="contained" href={`/${siteName}/${boardName}/${contentId}`}>
                글로 이동
              </Button>
            </Stack>
          </div>
        </div>
      </div>
    </main>
  );
}
