'use client';

import { type JSX, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  Box,
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
import { EMAIL_PATTERN } from '@/lib/auth/emailSignUp';
import Anchor from '@/components/Anchor';
import Container from '../container';
import DarkThemeProvider from '../DarkThemeProvider';
import styles from '@/app/auth.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type EmailFieldErrors = {
  email: string;
};

type PasswordResetMailResponse = {
  ok?: boolean;
  title?: string;
  errors?: string[];
  fieldErrors?: Partial<EmailFieldErrors>;
};

type PasswordResetPopup = {
  open: boolean;
  title: string;
  messages: string[];
  fieldErrors: EmailFieldErrors;
  success: boolean;
};

const EMPTY_FIELD_ERRORS: EmailFieldErrors = { email: '' };

function addSentenceLineBreaks(message: string) {
  return message.replace(/([.!?])\s+(?=\S)/g, '$1\n');
}

function mergeFieldErrors(fieldErrors?: Partial<EmailFieldErrors>): EmailFieldErrors {
  return { ...EMPTY_FIELD_ERRORS, ...fieldErrors };
}

export default function Opt() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<EmailFieldErrors>(EMPTY_FIELD_ERRORS);
  const [popup, setPopup] = useState<PasswordResetPopup>({
    open: false,
    title: '',
    messages: [],
    fieldErrors: EMPTY_FIELD_ERRORS,
    success: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  function showPopup(title: string, messages: string[], nextFieldErrors = EMPTY_FIELD_ERRORS, success = false) {
    setPopup({
      open: true,
      title,
      messages: messages.map(addSentenceLineBreaks),
      fieldErrors: nextFieldErrors,
      success,
    });
  }

  function handlePopupClose() {
    setFieldErrors(popup.fieldErrors);
    setPopup((previousValue) => ({ ...previousValue, open: false }));

    if (popup.success) setEmail('');
  }

  function showNativeValidationError(message: string) {
    const nextFieldErrors = { email: message };
    showPopup('이메일 확인', [message], nextFieldErrors);
  }

  function handleEmailChange(event: InputChangeEvent) {
    setEmail(event.currentTarget.value);
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setPopup((previousValue) => ({
      ...previousValue,
      fieldErrors: EMPTY_FIELD_ERRORS,
    }));
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedEmail = email.trim().toLowerCase();
    const emailError = !trimmedEmail
      ? '이메일을 입력해 주세요.'
      : !EMAIL_PATTERN.test(trimmedEmail)
        ? '올바른 이메일 형식으로 입력해 주세요.'
        : '';

    if (emailError) {
      showNativeValidationError(emailError);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/notifications/email/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
      });
      const result = (await response.json().catch(() => null)) as PasswordResetMailResponse | null;

      if (!response.ok || !result?.ok) {
        showPopup(
          result && typeof result.title === 'string' ? result.title : '',
          result?.errors?.length
            ? result.errors
            : ['비밀번호 재설정 메일 요청 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'],
          mergeFieldErrors(result?.fieldErrors),
        );
        return;
      }

      showPopup(
        '메일 전송 완료',
        ['입력한 이메일로 가입된 계정이 있으면 비밀번호 재설정 메일을 보냈습니다.'],
        EMPTY_FIELD_ERRORS,
        true,
      );
    } catch {
      showPopup('', ['비밀번호 재설정 메일 요청 중 오류가 발생했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.']);
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderPopupContents(isDrawer: boolean) {
    return (
      <>
        {popup.title ? isDrawer ? <h2>{popup.title}</h2> : <DialogTitle>{popup.title}</DialogTitle> : null}
        <button type="button" className="close-button" onClick={handlePopupClose} aria-label="닫기">
          <CloseRoundedIcon />
        </button>
        {popup.title ? (
          isDrawer ? (
            <div className="VhiDrawer-bottom-content">
              <ul>
                {popup.messages.map((message) => (
                  <li key={message} style={{ whiteSpace: 'pre-line' }}>
                    {message}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <DialogContent>
              <ul>
                {popup.messages.map((message) => (
                  <li key={message} style={{ whiteSpace: 'pre-line' }}>
                    {message}
                  </li>
                ))}
              </ul>
            </DialogContent>
          )
        ) : (
          <div className="VhiDrawer-bottom-content">
            {popup.messages.map((message) => (
              <p className="alert popup-error" key={message}>
                <ErrorOutlineRoundedIcon />
                <span style={{ whiteSpace: 'pre-line' }}>{message}</span>
              </p>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <DarkThemeProvider>
      <Container>
        <Box component="form" onSubmit={handleSubmit}>
          <Stack gap={1}>
            <TextField
              name="email"
              placeholder="이메일"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={handleEmailChange}
              slotProps={{ htmlInput: { pattern: EMAIL_PATTERN.source } }}
              onInvalid={(event) => {
                event.preventDefault();
                const input = event.currentTarget as HTMLInputElement;
                showNativeValidationError(
                  input.validity.valueMissing ? '이메일을 입력해 주세요.' : '올바른 이메일 형식으로 입력해 주세요.',
                );
              }}
              error={Boolean(fieldErrors.email)}
              helperText={fieldErrors.email}
              fullWidth
              size="small"
            />

            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Anchor href="/auth/sign-in" className={`button small action ${styles.action}`}>
                로그인으로 돌아가기
              </Anchor>
            </Box>

            <div className={styles.actions}>
              <button type="submit" className={`button medium submit ${styles.submit}`} disabled={isSubmitting}>
                재설정 메일 보내기
              </button>
            </div>
          </Stack>
        </Box>
      </Container>

      {isMobile ? (
        <Drawer anchor="bottom" open={popup.open} onClose={handlePopupClose} className="VhiDrawer-bottom">
          {renderPopupContents(true)}
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium cancel" onClick={handlePopupClose}>
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={popup.open}
          onClose={handlePopupClose}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          {renderPopupContents(false)}
          <DialogActions>
            <button type="button" onClick={handlePopupClose}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </DarkThemeProvider>
  );
}
