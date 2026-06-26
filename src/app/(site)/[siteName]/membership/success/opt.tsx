'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';

type MembershipSuccessResponse = {
  ok?: boolean;
  subscriptionId?: string | null;
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();
  const hasRequestedRef = useRef(false);

  const siteName = normalizeText(params.siteName).toLowerCase();

  const [message, setMessage] = useState('멤버십 가입을 처리하고 있습니다.');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function completeMembership() {
      try {
        setErrorMessage('');

        const billingKey = normalizeText(searchParams.get('billingKey'));
        const customerKey = normalizeText(searchParams.get('customerKey'));
        const orderNo = normalizeText(searchParams.get('orderNo'));

        if (!billingKey || !customerKey || !siteName || !orderNo) {
          throw new Error('멤버십 가입 정보가 올바르지 않습니다.');
        }

        const response = await fetch('/api/payments/portone/membership/success', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ billingKey, customerKey, siteName, orderNo }),
        });

        const result = (await response.json()) as MembershipSuccessResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '멤버십 가입을 완료하지 못했습니다.');
        }

        setMessage('멤버십 가입이 완료되었습니다.');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '멤버십 가입을 완료하지 못했습니다.');
        } else {
          setErrorMessage('멤버십 가입을 완료하지 못했습니다.');
        }
      }
    }

    if (hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;

    void completeMembership();
  }, [searchParams]);

  return (
    <div className="paper">
      <Typography variant="h1">멤버십 가입</Typography>

      {errorMessage ? (
        <Typography role="status" color="error">
          {errorMessage}
        </Typography>
      ) : (
        <Typography role="status">{message}</Typography>
      )}

      <Button type="button" href={`/${siteName}`} variant="contained">
        사이트로 이동
      </Button>
    </div>
  );
}
