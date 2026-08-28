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
  onSaved: (paymentEmail: string) => void | Promise<void>;
};

type PaymentEmailResponse = {
  paymentEmail?: string;
  error?: string;
};

const PAYMENT_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function PaymentEmailDialog({ open, onClose, onSaved }: PaymentEmailDialogProps) {
  const [paymentEmail, setPaymentEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  function handleClose() {
    if (isSaving) return;

    setPaymentEmail('');
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

      if (!PAYMENT_EMAIL_PATTERN.test(normalizedPaymentEmail)) {
        throw new Error('이메일 형식이 올바르지 않습니다.');
      }

      setIsSaving(true);
      setErrorMessage('');

      const response = await fetch('/api/payments/portone/payment-email', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentEmail: normalizedPaymentEmail }),
      });
      const result = (await response.json()) as PaymentEmailResponse;

      if (!response.ok || !result.paymentEmail) {
        throw new Error(result.error ?? '결제 이메일을 저장하지 못했습니다.');
      }

      setPaymentEmail('');
      onClose();
      await onSaved(result.paymentEmail);
    } catch (unknownError) {
      setErrorMessage(
        unknownError instanceof Error
          ? unknownError.message || '결제 이메일을 저장하지 못했습니다.'
          : '결제 이메일을 저장하지 못했습니다.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  function renderContent() {
    return (
      <Stack gap={2}>
        <p>결제 과정에서 구매자를 식별하기 위해 실명 대신 사용하는 이메일 주소입니다.</p>
        <TextField
          type="email"
          value={paymentEmail}
          placeholder="이메일 주소"
          onChange={handleChange}
          disabled={isSaving}
          fullWidth
          size="small"
        />
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
        <h2>결제 이메일 입력</h2>
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
      <DialogTitle>결제 이메일 입력</DialogTitle>
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
