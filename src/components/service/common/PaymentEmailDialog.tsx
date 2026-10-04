'use client';

import { type ChangeEvent, type FormEvent, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
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
import FormErrorDialog from '@/components/FormErrorDialog';

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

type ErrorPopup = {
  title: string | null;
  messages: string[];
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
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [errorPopup, setErrorPopup] = useState<ErrorPopup | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  function handleClose() {
    if (isSaving) return;

    setPaymentEmail('');
    setPaymentPhone('');
    setEmailError('');
    setPhoneError('');
    setErrorPopup(null);
    onClose();
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setPaymentEmail(event.target.value);
    setEmailError('');
  }

  function showValidationErrors(nextEmailError: string, nextPhoneError: string) {
    setEmailError(nextEmailError);
    setPhoneError(nextPhoneError);
    setErrorPopup({
      title: '결제 정보 확인',
      messages: [nextEmailError, nextPhoneError].filter(Boolean),
    });
  }

  function getValidationErrors() {
    const normalizedPaymentEmail = normalizeText(paymentEmail).toLowerCase();
    const normalizedPaymentPhone = paymentPhone.replace(/\D/g, '');

    return {
      normalizedPaymentEmail,
      normalizedPaymentPhone,
      email: requireEmail
        ? !normalizedPaymentEmail
          ? '결제용 이메일 주소를 입력해주세요.'
          : !PAYMENT_EMAIL_PATTERN.test(normalizedPaymentEmail)
            ? '이메일 형식이 올바르지 않습니다.'
            : ''
        : '',
      phone: requirePhone
        ? !normalizedPaymentPhone
          ? '결제용 휴대폰 번호를 입력해주세요.'
          : !/^01[0-9]{8,9}$/.test(normalizedPaymentPhone)
            ? '휴대폰 번호 형식이 올바르지 않습니다.'
            : ''
        : '',
    };
  }

  function handleInvalid(event: FormEvent<HTMLInputElement>) {
    event.preventDefault();
    const validation = getValidationErrors();
    showValidationErrors(validation.email, validation.phone);
  }

  async function handleSave(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    try {
      const validation = getValidationErrors();
      if (validation.email || validation.phone) {
        showValidationErrors(validation.email, validation.phone);
        return;
      }

      setIsSaving(true);
      setEmailError('');
      setPhoneError('');
      setErrorPopup(null);

      const response = await fetch('/api/payments/portone/payment-email', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(requireEmail ? { paymentEmail: validation.normalizedPaymentEmail } : {}),
          ...(requirePhone ? { paymentPhone: validation.normalizedPaymentPhone } : {}),
        }),
      });
      const result = (await response.json().catch(() => null)) as PaymentEmailResponse | null;

      if (!response.ok || (requireEmail && !result?.paymentEmail) || (requirePhone && !result?.paymentPhone)) {
        const message = result?.error ?? '결제 정보를 저장하지 못했습니다.';
        const isKnownError = response.status < 500;
        setEmailError(requireEmail && isKnownError ? message : '');
        setPhoneError(requirePhone && isKnownError ? message : '');
        setErrorPopup({ title: isKnownError ? '결제 정보 확인' : null, messages: [message] });
        return;
      }

      setPaymentEmail('');
      setPaymentPhone('');
      onClose();
      await onSaved(result?.paymentEmail ?? '', result?.paymentPhone ?? '');
    } catch (unknownError) {
      const message =
        unknownError instanceof Error
          ? unknownError.message || '결제 정보를 저장하지 못했습니다.'
          : '결제 정보를 저장하지 못했습니다.';
      setErrorPopup({ title: null, messages: [message] });
    } finally {
      setIsSaving(false);
    }
  }

  function renderContent(formId: string) {
    return (
      <form id={formId} onSubmit={handleSave}>
        <Stack gap={2}>
          {requireEmail ? (
            <TextField
              type="email"
              name="paymentEmail"
              value={paymentEmail}
              placeholder="결제용 이메일 주소"
              onChange={handleChange}
              onInvalid={handleInvalid}
              disabled={isSaving}
              required
              error={Boolean(emailError)}
              helperText={emailError}
              fullWidth
              size="small"
            />
          ) : null}
          {requirePhone ? (
            <TextField
              type="tel"
              name="paymentPhone"
              value={paymentPhone}
              placeholder="결제용 휴대폰 번호"
              onChange={(event) => {
                setPaymentPhone(event.target.value);
                setPhoneError('');
              }}
              onInvalid={handleInvalid}
              disabled={isSaving}
              required
              error={Boolean(phoneError)}
              helperText={phoneError}
              inputMode="tel"
              fullWidth
              size="small"
            />
          ) : null}
        </Stack>
      </form>
    );
  }

  if (isMobile) {
    return (
      <>
        <Drawer anchor="bottom" open={open} onClose={handleClose} className="VhiDrawer-bottom VhiDrawer-bottom-service">
          <h2>결제 정보 입력</h2>
          <button type="button" className="close-button" onClick={handleClose} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{renderContent('payment-email-form-mobile')}</div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button small cancel" onClick={handleClose} disabled={isSaving}>
              취소
            </button>
            <button type="submit" form="payment-email-form-mobile" className="button small submit" disabled={isSaving}>
              저장하고 계속
            </button>
          </div>
        </Drawer>
        <FormErrorDialog
          open={Boolean(errorPopup)}
          title={errorPopup?.title ?? null}
          messages={errorPopup?.messages ?? []}
          onClose={() => setErrorPopup(null)}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
        <DialogTitle>결제 정보 입력</DialogTitle>
        <button type="button" className="close-button" onClick={handleClose} aria-label="닫기">
          <CloseRoundedIcon />
        </button>
        <DialogContent>{renderContent('payment-email-form-desktop')}</DialogContent>
        <DialogActions>
          <button type="button" className="cancel-button" onClick={handleClose} disabled={isSaving}>
            취소
          </button>
          <button type="submit" form="payment-email-form-desktop" disabled={isSaving}>
            저장하고 계속
          </button>
        </DialogActions>
      </Dialog>
      <FormErrorDialog
        open={Boolean(errorPopup)}
        title={errorPopup?.title ?? null}
        messages={errorPopup?.messages ?? []}
        onClose={() => setErrorPopup(null)}
      />
    </>
  );
}
