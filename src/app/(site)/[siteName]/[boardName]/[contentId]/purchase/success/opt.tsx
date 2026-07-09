'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Dialog, DialogContent, DialogTitle, Drawer, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Container from '@/app/(site)/[siteName]/menu';
import Anchor from '@/components/Anchor';

type PurchaseSuccessResponse = {
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

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(true);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    async function completePurchase() {
      try {
        setErrorMessage('');
        setIsProcessing(true);

        const paymentKey =
          normalizeText(searchParams.get('paymentKey')) || normalizeText(searchParams.get('paymentId'));
        const orderId = normalizeText(searchParams.get('orderId')) || normalizeText(searchParams.get('orderNo'));
        const txId = normalizeText(searchParams.get('txId'));
        const amount = Number(normalizeText(searchParams.get('amount')));
        const siteId = normalizeText(searchParams.get('siteId'));
        const postId = normalizeText(searchParams.get('postId'));

        if (!paymentKey || !orderId || !Number.isFinite(amount) || !siteId || !postId) {
          throw new Error('포스팅 구매 결제 정보가 올바르지 않습니다.');
        }

        const response = await fetch('/api/payments/portone/purchase/success', {
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
            postId,
          }),
        });

        const result = (await response.json()) as PurchaseSuccessResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '포스팅 구매를 완료하지 못했습니다.');
        }

        setMessage('포스팅 구매가 완료되었습니다.');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '포스팅 구매를 완료하지 못했습니다.');
        } else {
          setErrorMessage('포스팅 구매를 완료하지 못했습니다.');
        }
      } finally {
        setIsProcessing(false);
      }
    }

    if (hasRequestedRef.current) {
      return;
    }

    hasRequestedRef.current = true;

    void completePurchase();
  }, [searchParams]);

  return (
    <Container pageBack={`/${siteName}/${boardName}/${contentId}`} pageTitle="포스팅 구매" pageFin>
      {isMobile ? (
        <Drawer anchor="bottom" open={isProcessing} className="VhiDrawer-bottom">
          <h2>구매 처리중</h2>
          <Stack gap={2}>
            <Typography variant="subtitle2">포스팅 구매를 처리하고 있습니다.</Typography>
            <p className="alert warning">
              <WarningAmberRoundedIcon />
              <span>잠시만 기다려 주세요.</span>
            </p>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={isProcessing} maxWidth="xs" className="VhiDialog">
          <DialogTitle>구매 처리중</DialogTitle>
          <DialogContent>
            <Stack gap={2}>
              <Typography variant="subtitle2">포스팅 구매를 처리하고 있습니다.</Typography>
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>잠시만 기다려 주세요.</span>
              </p>
            </Stack>
          </DialogContent>
        </Dialog>
      )}

      <div className="container">
        <div className="content" style={{ maxWidth: 572 }}>
          <h2>포스팅 구매</h2>
          <div className="paper" style={{ marginTop: 12 }}>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : message ? (
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>{message}</span>
              </p>
            ) : null}

            <Anchor type="button" className="button medium submit" href={`/${siteName}/${boardName}/${contentId}`}>
              포스팅으로 이동
            </Anchor>
          </div>
        </div>
      </div>
    </Container>
  );
}
