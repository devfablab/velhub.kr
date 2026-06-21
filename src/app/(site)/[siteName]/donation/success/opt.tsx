'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type DonationSuccessResponse = {
  ok?: boolean;
  paymentId?: string;
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const isRequestedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isRequestedRef.current) {
      return;
    }

    isRequestedRef.current = true;

    async function confirmDonation() {
      try {
        setErrorMessage('');

        const paymentKey = normalizeText(searchParams.get('paymentKey'));
        const orderId = normalizeText(searchParams.get('orderId'));
        const amountText = normalizeText(searchParams.get('amount'));
        const siteId = normalizeText(searchParams.get('siteId'));

        if (!paymentKey || !orderId || !amountText || !siteId) {
          throw new Error('후원 결제 승인 정보가 없습니다.');
        }

        const amount = Number(amountText);

        if (!Number.isInteger(amount)) {
          throw new Error('후원 결제 금액이 올바르지 않습니다.');
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
          }),
        });

        const result = (await response.json()) as DonationSuccessResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '후원 결제를 완료하지 못했습니다.');
        }

        setIsSuccess(true);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '후원 결제를 완료하지 못했습니다.');
        } else {
          setErrorMessage('후원 결제를 완료하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void confirmDonation();
  }, [searchParams]);

  function handleGoSite() {
    router.replace(`/${siteName}`);
  }

  function handleGoBack() {
    router.replace(`/${siteName}`);
  }

  if (isLoading) {
    return (
      <div className="paper">
        <div className="loading-container">
          <LoadingIndicator />
        </div>
      </div>
    );
  }

  return (
    <div className="paper">
      <Stack gap={2}>
        {isSuccess ? (
          <>
            <Typography variant="h6">후원이 완료되었습니다.</Typography>
            <Typography>응원해 주셔서 감사합니다.</Typography>
            <div>
              <Button type="button" variant="contained" onClick={handleGoSite}>
                사이트로 이동
              </Button>
            </div>
          </>
        ) : (
          <>
            <Typography variant="h6">후원 결제를 완료하지 못했습니다.</Typography>
            {errorMessage ? (
              <Typography role="status" color="error">
                {errorMessage}
              </Typography>
            ) : null}
            <div>
              <Button type="button" variant="contained" onClick={handleGoBack}>
                사이트로 이동
              </Button>
            </div>
          </>
        )}
      </Stack>
    </div>
  );
}
