'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
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
  const [isLoading, setIsLoading] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isRequestedRef = useRef(false);

  useEffect(() => {
    if (isRequestedRef.current) {
      return;
    }

    isRequestedRef.current = true;

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
      <Container pageTitle="결제수단 등록 완료">
        <LoadingIndicator />
      </Container>
    );
  }

  return (
    <Container pageTitle="결제수단 등록 완료">
      <Paper variant="outlined">
        <Stack spacing={2} sx={{ p: 3 }}>
          {isSuccess ? (
            <>
              {normalizeText(searchParams.get('purpose')) === 'billing_method' ? (
                <>결제수단이 추가되었습니다.</>
              ) : (
                <>결제수단 등록이 완료되었습니다. 무료체험이 적용되었고 사이트 운영이 가능합니다.</>
              )}
            </>
          ) : (
            <>
              <Typography variant="h6">결제수단 등록을 완료하지 못했습니다.</Typography>
              {errorMessage ? (
                <Typography role="status" color="error">
                  {errorMessage}
                </Typography>
              ) : null}
            </>
          )}

          <Stack direction="row" spacing={1}>
            <Button type="button" variant="contained" onClick={handleGoBilling}>
              결제/구독 관리로 이동
            </Button>
            {isSuccess ? (
              <Button type="button" variant="outlined" onClick={handleGoManage}>
                관리 홈으로 이동
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>
    </Container>
  );
}
