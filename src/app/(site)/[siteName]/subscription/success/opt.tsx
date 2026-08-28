'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';

type BlogSubscriptionSuccessResponse = {
  ok?: boolean;
  subscriptionId?: string | null;
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hasRequestedRef = useRef(false);

  const siteName = normalizeText(params.siteName).toLowerCase();

  const [message, setMessage] = useState('블로그 구독 가입을 처리하고 있습니다.');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function completeBlogSubscription() {
      try {
        setErrorMessage('');

        const billingKey = normalizeText(searchParams.get('billingKey'));
        const customerKey = normalizeText(searchParams.get('customerKey'));
        const orderNo = normalizeText(searchParams.get('orderNo'));
        const guardianIdentityVerificationId = normalizeText(searchParams.get('guardianIdentityVerificationId'));

        if (!billingKey || !customerKey || !siteName || !orderNo) {
          throw new Error('블로그 구독 가입 정보가 올바르지 않습니다.');
        }

        const response = await fetch('/api/payments/portone/subscriptions/success', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            billingKey,
            customerKey,
            siteName,
            orderNo,
            targetType: 'site',
            guardianIdentityVerificationId,
          }),
        });

        const result = (await response.json()) as BlogSubscriptionSuccessResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '블로그 구독 가입을 완료하지 못했습니다.');
        }

        setMessage('블로그 구독 가입이 완료되었습니다.');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '블로그 구독 가입을 완료하지 못했습니다.');
        } else {
          setErrorMessage('블로그 구독 가입을 완료하지 못했습니다.');
        }
      }
    }

    if (hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;

    void completeBlogSubscription();
  }, [searchParams, siteName]);

  return (
    <div className="paper">
      <Typography variant="h1">블로그 구독 가입</Typography>

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : (
        <p className="alert info">
          <InfoOutlineRoundedIcon />
          <span>{message}</span>
        </p>
      )}

      <Anchor href={`/${siteName}`} className="button medium submit">
        사이트로 이동
      </Anchor>
    </div>
  );
}
