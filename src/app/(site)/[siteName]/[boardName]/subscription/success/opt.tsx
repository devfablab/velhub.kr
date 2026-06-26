'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../menu';
import Anchor from '@/components/Anchor';

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

        const billingKey = normalizeText(searchParams.get('billingKey'));
        const customerKey = normalizeText(searchParams.get('customerKey'));
        const orderNo = normalizeText(searchParams.get('orderNo'));
        const targetType = getTargetType(normalizeText(searchParams.get('targetType')));
        const seriesName = normalizeText(searchParams.get('seriesName')).toLowerCase();

        if (!billingKey || !customerKey || !orderNo || !targetType) {
          throw new Error('구독 정보가 올바르지 않습니다.');
        }

        if (targetType === 'series' && !seriesName) {
          throw new Error('연재 구독 정보가 올바르지 않습니다.');
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
    <Container pageBack={`/${siteName}/${boardName}`} pageTitle="게시판 구독" pageFin>
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          <h2>게시판 구독</h2>
          <div className="paper" style={{ marginTop: 12 }}>
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
            <Anchor type="button" className="button medium submit" href={`/${siteName}/${boardName}`}>
              포스팅으로 이동
            </Anchor>
          </div>
        </div>
      </div>
    </Container>
  );
}
