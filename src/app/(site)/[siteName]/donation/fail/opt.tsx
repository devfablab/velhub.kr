'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';

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
        const amountText = normalizeText(searchParams.get('amount'));
        const amount = Number(amountText);

        if (!orderNo || !paymentType || !siteId || !amountText || !Number.isInteger(amount)) {
          throw new Error('후원 실패 정보를 저장하지 못했습니다.');
        }

        const response = await fetch('/api/payments/portone/fail', {
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
            amount,
          }),
        });

        const result = (await response.json()) as PaymentFailResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '후원 실패 정보를 저장하지 못했습니다.');
        }

        setErrorMessage(message);
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
  }, [searchParams]);

  function handleGoSite() {
    router.replace(`/${siteName}`);
  }

  if (isLoading) {
    return (
      <Container pageBack={`/${siteName}`} pageTitle="후원" pageFin>
        <div className="container">
          <div className="content">
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
          <h2>후원 결제에 실패했습니다.</h2>
          <div className="paper" style={{ marginTop: 12, marginBottom: 12 }}>
            <p>후원을 다시 시도해 주세요.</p>
          </div>
          {errorMessage ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{errorMessage}</span>
            </p>
          ) : null}
          <button type="button" className="button small submit" onClick={handleGoSite}>
            사이트로 이동
          </button>
        </div>
      </div>
    </Container>
  );
}
