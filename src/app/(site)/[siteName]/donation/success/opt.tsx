'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import Anchor from '@/components/Anchor';

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

        const paymentKey = normalizeText(searchParams.get('paymentKey')) || normalizeText(searchParams.get('paymentId'));
        const orderId = normalizeText(searchParams.get('orderId')) || normalizeText(searchParams.get('orderNo'));
        const txId = normalizeText(searchParams.get('txId'));
        const amountText = normalizeText(searchParams.get('amount'));
        const siteId = normalizeText(searchParams.get('siteId'));
        const targetType = normalizeText(searchParams.get('targetType'));
        const boardId = normalizeText(searchParams.get('boardId'));

        if (!paymentKey || !orderId || !amountText || !siteId) {
          throw new Error('후원 결제 승인 정보가 없습니다.');
        }

        const amount = Number(amountText);

        if (!Number.isInteger(amount)) {
          throw new Error('후원 결제 금액이 올바르지 않습니다.');
        }

        const response = await fetch('/api/payments/portone/donation/success', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            paymentKey,
            orderId,
            txId,
            amount,
            siteId,
            targetType,
            boardId,
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

  if (isLoading) {
    return (
      <Container pageBack={`/${siteName}`} pageTitle="후원" pageFin>
        <div className="container">
          <div className={`content`}>
            <div className="paper">
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageBack={`/${siteName}`} pageTitle="후원" pageFin>
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          {isSuccess ? (
            <>
              <h2>후원 완료되었습니다.</h2>
              <div className="paper" style={{ marginTop: 12, marginBottom: 12 }}>
                <p>응원해 주셔서 감사합니다.</p>
              </div>
            </>
          ) : (
            <>
              <h2>후원 결제를 완료하지 못했습니다.</h2>
              <div className="paper" style={{ marginTop: 12, marginBottom: 12 }}>
                {errorMessage ? <p>{errorMessage}</p> : null}
              </div>
            </>
          )}
          <Anchor type="button" className="button medium submit" href={`/${siteName}`}>
            메인으로 이동
          </Anchor>
        </div>
      </div>
    </Container>
  );
}
