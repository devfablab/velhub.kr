'use client';

import { FormEvent, useState } from 'react';
import * as PortOne from '@portone/browser-sdk/v2';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Snackbar,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { normalizeText } from '@/lib/utils';

type PortOneBillingKeyResponse = {
  billingKey?: string;
  code?: string;
  message?: string;
};

type BillingMethodStatusResponse = {
  paymentEmail: string | null;
  error?: string;
};

type BillingMethodStartResponse =
  | {
      customerName: string | undefined;
      storeId: string;
      channelKey: string;
      customerKey: string;
      orderNo: string;
      orderName: string;
      successUrl: string;
      failUrl: string;
    }
  | { error: string };

type PaymentEmailSaveResponse = {
  paymentEmail?: string | null;
  error?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function BillingMethodButton() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isPaymentEmailDialogOpen, setIsPaymentEmailDialogOpen] = useState(false);
  const [paymentEmail, setPaymentEmail] = useState('');
  const [paymentEmailErrorMessage, setPaymentEmailErrorMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  async function getBillingMethodStatus() {
    const response = await fetch('/api/payments/portone/billing-method/status', {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as BillingMethodStatusResponse;

    if (!response.ok) {
      throw new Error(result.error || '결제 이메일을 확인하지 못했습니다.');
    }

    return normalizeText(result.paymentEmail);
  }

  async function savePaymentEmail() {
    const normalizedPaymentEmail = normalizeText(paymentEmail);

    if (!EMAIL_PATTERN.test(normalizedPaymentEmail)) {
      setPaymentEmailErrorMessage('이메일 형식이 올바르지 않습니다.');
      return null;
    }

    const response = await fetch('/api/payments/portone/payment-email', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        paymentEmail: normalizedPaymentEmail,
      }),
    });

    const result = (await response.json()) as PaymentEmailSaveResponse;

    if (!response.ok) {
      throw new Error(result.error || '결제 이메일을 저장하지 못했습니다.');
    }

    return normalizeText(result.paymentEmail || normalizedPaymentEmail);
  }

  async function startBillingMethodIssue() {
    const response = await fetch('/api/payments/portone/billing-method/start', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderName: '데브허브 결제 수단 추가',
        successUrl: `${window.location.origin}/hub/purchase/success`,
        failUrl: `${window.location.origin}/hub/purchase/fail`,
      }),
    });

    const result = (await response.json()) as BillingMethodStartResponse;

    if (!response.ok || 'error' in result) {
      throw new Error('error' in result ? result.error : '결제 수단 추가를 시작하지 못했습니다.');
    }

    if (
      !result.storeId ||
      !result.channelKey ||
      !result.customerKey ||
      !result.orderNo ||
      !result.orderName ||
      !result.successUrl
    ) {
      throw new Error('결제 수단 추가 정보가 올바르지 않습니다.');
    }

    const billingKeyResponse = (await PortOne.requestIssueBillingKey({
      storeId: result.storeId,
      channelKey: result.channelKey,
      billingKeyMethod: 'CARD',
      issueId: result.orderNo,
      issueName: result.orderName,
      customer: {
        customerId: result.customerKey,
        fullName: result.customerName,
        email: result.customerName,
      },
      redirectUrl: result.successUrl,
    })) as PortOneBillingKeyResponse | undefined;

    if (!billingKeyResponse) {
      throw new Error('결제 수단 추가 응답이 없습니다.');
    }

    if (billingKeyResponse.code) {
      throw new Error(billingKeyResponse.message || '결제 수단 추가에 실패했습니다.');
    }

    if (!billingKeyResponse.billingKey) {
      throw new Error('billingKey가 발급되지 않았습니다.');
    }

    const successResponse = await fetch('/api/payments/portone/billing-method/success', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        billingKey: billingKeyResponse.billingKey,
        customerKey: result.customerKey,
        orderNo: result.orderNo,
      }),
    });

    const successResult = (await successResponse.json()) as { error?: string };

    if (!successResponse.ok) {
      throw new Error(successResult.error ?? '결제 수단을 추가하지 못했습니다.');
    }

    window.location.reload();
  }

  async function handleAddBillingMethod() {
    try {
      setIsProcessing(true);
      setErrorMessage('');
      setPaymentEmailErrorMessage('');

      const billingMethodPaymentEmail = await getBillingMethodStatus();

      if (!billingMethodPaymentEmail) {
        setIsPaymentEmailDialogOpen(true);
        setIsProcessing(false);
        return;
      }

      await startBillingMethodIssue();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '결제 수단 추가를 시작하지 못했습니다.');
      } else {
        setErrorMessage('결제 수단 추가를 시작하지 못했습니다.');
      }

      setIsProcessing(false);
    }
  }

  async function handleSubmitPaymentEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsProcessing(true);
      setErrorMessage('');
      setPaymentEmailErrorMessage('');

      const savedPaymentEmail = await savePaymentEmail();

      if (!savedPaymentEmail) {
        setIsProcessing(false);
        return;
      }

      setIsPaymentEmailDialogOpen(false);
      setPaymentEmail('');
      await startBillingMethodIssue();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setPaymentEmailErrorMessage(unknownError.message || '결제 이메일을 저장하지 못했습니다.');
      } else {
        setPaymentEmailErrorMessage('결제 이메일을 저장하지 못했습니다.');
      }

      setIsProcessing(false);
    }
  }

  function handleClosePaymentEmailDialog() {
    if (isProcessing) {
      return;
    }

    setIsPaymentEmailDialogOpen(false);
    setPaymentEmailErrorMessage('');
  }

  return (
    <>
      <button type="button" className="button small action" onClick={handleAddBillingMethod} disabled={isProcessing}>
        결제 수단 추가
      </button>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isPaymentEmailDialogOpen}
          onClose={handleClosePaymentEmailDialog}
          className="VhiDrawer-bottom"
        >
          <h2>결제 이메일 입력</h2>
          <button className="close-button" onClick={handleClosePaymentEmailDialog}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <form onSubmit={handleSubmitPaymentEmail}>
              <Stack gap={1}>
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>결제시에 사용하는 이메일입니다. 입력하신 이메일은 수정이 불가합니다.</span>
                </p>
                <TextField
                  placeholder="결제용 이메일주소 입력"
                  type="email"
                  value={paymentEmail}
                  onChange={(event) => {
                    setPaymentEmail(event.target.value);
                    setPaymentEmailErrorMessage('');
                  }}
                  error={Boolean(paymentEmailErrorMessage)}
                  helperText={paymentEmailErrorMessage || '이메일은 필수입니다'}
                  autoComplete="email"
                  fullWidth
                  required
                  size="small"
                />
              </Stack>
            </form>
            <Stack direction="column" spacing={1.5}>
              <button
                type="button"
                className="button medium cancel"
                onClick={handleClosePaymentEmailDialog}
                disabled={isProcessing}
              >
                취소
              </button>
              <button type="submit" className="button medium submit" disabled={isProcessing}>
                저장하고 계속
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={isPaymentEmailDialogOpen}
          onClose={handleClosePaymentEmailDialog}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <form onSubmit={handleSubmitPaymentEmail}>
            <DialogTitle>결제 이메일 입력</DialogTitle>
            <button className="close-button" onClick={handleClosePaymentEmailDialog}>
              <CloseRoundedIcon />
            </button>
            <DialogContent>
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>결제시에 사용하는 이메일입니다. 입력하신 이메일은 수정이 불가합니다.</span>
              </p>
              <TextField
                placeholder="결제용 이메일주소 입력"
                type="email"
                value={paymentEmail}
                onChange={(event) => {
                  setPaymentEmail(event.target.value);
                  setPaymentEmailErrorMessage('');
                }}
                error={Boolean(paymentEmailErrorMessage)}
                helperText={paymentEmailErrorMessage || '이메일은 필수입니다'}
                autoComplete="email"
                fullWidth
                required
                size="small"
              />
            </DialogContent>
            <DialogActions>
              <button
                type="button"
                className="button medium close"
                onClick={handleClosePaymentEmailDialog}
                disabled={isProcessing}
              >
                취소
              </button>
              <button type="submit" className="button medium submit" disabled={isProcessing}>
                저장하고 계속
              </button>
            </DialogActions>
          </form>
        </Dialog>
      )}

      <Snackbar
        open={Boolean(normalizeText(errorMessage))}
        message={errorMessage}
        autoHideDuration={3000}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        onClose={() => setErrorMessage('')}
      />
    </>
  );
}
