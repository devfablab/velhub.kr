'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { normalizeText } from '@/lib/utils';
import Container from '@/app/(site)/[siteName]/menu';
import Anchor from '@/components/Anchor';

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

        const paymentKey = normalizeText(searchParams.get('paymentKey')) || normalizeText(searchParams.get('paymentId'));
        const orderId = normalizeText(searchParams.get('orderId')) || normalizeText(searchParams.get('orderNo'));
        const txId = normalizeText(searchParams.get('txId'));
        const amount = Number(normalizeText(searchParams.get('amount')));
        const siteId = normalizeText(searchParams.get('siteId'));
        const targetType = normalizeText(searchParams.get('targetType'));
        const postId = normalizeText(searchParams.get('postId'));

        if (!paymentKey || !orderId || !Number.isFinite(amount) || !siteId || !targetType || !postId) {
          throw new Error('후원 결제 정보가 올바르지 않습니다.');
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
    <Container pageBack={`/${siteName}/${boardName}/${contentId}`} pageTitle="포스팅 후원" pageFin>
      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          <h2>포스팅 후원</h2>
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
            <Anchor type="button" className="button medium submit" href={`/${siteName}/${boardName}/${contentId}`}>
              포스팅으로 이동
            </Anchor>
          </div>
        </div>
      </div>
    </Container>
  );
}
