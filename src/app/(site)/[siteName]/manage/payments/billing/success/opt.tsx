'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { normalizeText } from '@/lib/utils';
import Container from '../../../menu';

type PlanBillingSuccessResponse = {
  ok?: boolean;
  subscriptionId?: string;
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const isRequestedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function completeBillingAuth() {
      try {
        setErrorMessage('');

        const authKey = normalizeText(searchParams.get('authKey'));
        const customerKey = normalizeText(searchParams.get('customerKey'));
        const siteId = normalizeText(searchParams.get('siteId'));
        const orderNo = normalizeText(searchParams.get('orderNo'));
        const purpose = normalizeText(searchParams.get('purpose'));

        if (!authKey || !customerKey || !siteId || !orderNo) {
          throw new Error('결제수단 등록 승인 정보가 없습니다.');
        }

        const response = await fetch('/api/payments/toss/plan-billing/success', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            authKey,
            customerKey,
            siteId,
            orderNo,
            purpose,
          }),
        });

        const result = (await response.json()) as PlanBillingSuccessResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '결제수단 등록을 완료하지 못했습니다.');
        }

        setIsSuccess(true);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '결제수단 등록을 완료하지 못했습니다.');
        } else {
          setErrorMessage('결제수단 등록을 완료하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (isRequestedRef.current) {
      return;
    }

    isRequestedRef.current = true;
    void completeBillingAuth();
  }, [searchParams]);

  function handleGoBilling() {
    router.replace(`/${siteName}/manage/payments/billing`);
  }

  function handleGoManage() {
    router.replace(`/${siteName}/manage`);
  }

  if (isLoading) {
    return (
      <Container menu="payments">
        <LoadingIndicator />
      </Container>
    );
  }

  return (
    <Container menu="payments">
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack spacing={3} alignItems="center">
          {isSuccess ? (
            <>
              <Typography variant="h6" component="h1">
                {normalizeText(searchParams.get('purpose')) === 'billing_method'
                  ? '결제수단이 추가되었습니다.'
                  : '결제수단 등록이 완료되었습니다.'}
              </Typography>
              {normalizeText(searchParams.get('purpose')) === 'billing_method' ? null : (
                <Typography color="text.secondary">무료체험이 적용되었고 사이트 운영이 가능합니다.</Typography>
              )}
            </>
          ) : (
            <>
              <Typography variant="h6" component="h1">
                결제수단 등록을 완료하지 못했습니다.
              </Typography>
              {errorMessage ? (
                <Typography color="error" role="alert">
                  {errorMessage}
                </Typography>
              ) : null}
            </>
          )}

          <Button type="button" variant="contained" onClick={handleGoBilling}>
            결제/구독 관리로 이동
          </Button>
          {isSuccess ? (
            <Button type="button" onClick={handleGoManage}>
              관리 홈으로 이동
            </Button>
          ) : null}
        </Stack>
      </Paper>
    </Container>
  );
}
