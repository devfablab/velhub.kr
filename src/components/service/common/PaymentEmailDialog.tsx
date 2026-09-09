'use client';

import { type ChangeEvent, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';

type PaymentEmailDialogProps = {
  open: boolean;
  onClose: () => void;
  requireEmail?: boolean;
  requirePhone?: boolean;
  onSaved: (paymentEmail: string, paymentPhone: string) => void | Promise<void>;
};

type PaymentEmailResponse = {
  paymentEmail?: string;
  paymentPhone?: string;
  error?: string;
};

const PAYMENT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PaymentEmailDialog({
  open,
  onClose,
  requireEmail = true,
  requirePhone = false,
  onSaved,
}: PaymentEmailDialogProps) {
  const [paymentEmail, setPaymentEmail] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  function handleClose() {
    if (isSaving) return;

    setPaymentEmail('');
    setPaymentPhone('');
    setErrorMessage('');
    onClose();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setPaymentEmail(event.target.value);
    setErrorMessage('');
  }

  async function handleSave() {
    try {
      const normalizedPaymentEmail = normalizeText(paymentEmail).toLowerCase();
      const normalizedPaymentPhone = paymentPhone.replace(/\D/g, '');

      if (requireEmail && !PAYMENT_EMAIL_PATTERN.test(normalizedPaymentEmail)) {
        throw new Error('이메일 형식이 올바르지 않습니다.');
      }

      if (requirePhone && !/^01[0-9]{8,9}$/.test(normalizedPaymentPhone)) {
        throw new Error('휴대폰 번호 형식이 올바르지 않습니다.');
      }

      setIsSaving(true);
      setErrorMessage('');

      const response = await fetch('/api/payments/portone/payment-email', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(requireEmail ? { paymentEmail: normalizedPaymentEmail } : {}),
          ...(requirePhone ? { paymentPhone: normalizedPaymentPhone } : {}),
        }),
      });
      const result = (await response.json()) as PaymentEmailResponse;

      if (!response.ok || (requireEmail && !result.paymentEmail) || (requirePhone && !result.paymentPhone)) {
        throw new Error(result.error ?? '결제 정보를 저장하지 못했습니다.');
      }

      setPaymentEmail('');
      setPaymentPhone('');
      onClose();
      await onSaved(result.paymentEmail ?? '', result.paymentPhone ?? '');
    } catch (unknownError) {
      setErrorMessage(
        unknownError instanceof Error
          ? unknownError.message || '결제 정보를 저장하지 못했습니다.'
          : '결제 정보를 저장하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderContent() {
    return (
      <Stack gap={2}>
        {requireEmail ? (
          <TextField
            type="email"
            value={paymentEmail}
            placeholder="결제용 이메일 주소"
            onChange={handleChange}
            disabled={isSaving}
            fullWidth
            size="small"
          />
        ) : null}
        {requirePhone ? (
          <TextField
            type="tel"
            value={paymentPhone}
            placeholder="결제용 휴대폰 번호"
            onChange={(event) => {
              setPaymentPhone(event.target.value);
              setErrorMessage('');
            }}
            disabled={isSaving}
            inputMode="tel"
            fullWidth
            size="small"
          />
        ) : null}
        {errorMessage ? (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        ) : null}
      </Stack>
    );
  }

  if (isMobile) {
    return (
      <Drawer anchor="bottom" open={open} onClose={handleClose} className="VhiDrawer-bottom">
        <h2>결제 정보 입력</h2>
        <button type="button" className="close-button" onClick={handleClose} aria-label="닫기">
          <CloseRoundedIcon />
        </button>
        <Stack gap={3}>
          {renderContent()}
          <Stack gap={1.5}>
            <button type="button" className="button medium cancel" onClick={handleClose} disabled={isSaving}>
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              저장하고 계속
            </button>
          </Stack>
        </Stack>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" className="VhiDialog">
      <DialogTitle>결제 정보 입력</DialogTitle>
      <button type="button" className="close-button" onClick={handleClose} aria-label="닫기">
        <CloseRoundedIcon />
      </button>
      <DialogContent>{renderContent()}</DialogContent>
      <DialogActions>
        <button type="button" className="button medium close" onClick={handleClose} disabled={isSaving}>
          취소
        </button>
        <button type="button" className="button medium submit" onClick={() => void handleSave()} disabled={isSaving}>
          저장하고 계속
        </button>
      </DialogActions>
    </Dialog>
  );
}
