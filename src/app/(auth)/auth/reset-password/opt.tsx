'use client';

import { type JSX, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { isValidPassword, PASSWORD_REQUIREMENTS } from '@/lib/auth/password';
import { getSupabaseBrowser } from '@/lib/supabase';
import Container from '../container';
import DarkThemeProvider from '../DarkThemeProvider';
import styles from '@/app/auth.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type ResetPasswordFieldErrors = {
  password: string;
  passwordConfirm: string;
};

type ResetPasswordResponse = {
  ok?: boolean;
  title?: string;
  errors?: string[];
  fieldErrors?: Partial<ResetPasswordFieldErrors>;
};

type ResetPasswordPopup = {
  open: boolean;
  title: string;
  messages: string[];
  fieldErrors: ResetPasswordFieldErrors;
  success: boolean;
};

const EMPTY_FIELD_ERRORS: ResetPasswordFieldErrors = {
  password: '',
  passwordConfirm: '',
};
const PASSWORD_HTML_PATTERN = '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s]).{8,}';

function addSentenceLineBreaks(message: string) {
  return message.replace(/([.!?])\s+(?=\S)/g, '$1\n');
}

function mergeFieldErrors(fieldErrors?: Partial<ResetPasswordFieldErrors>): ResetPasswordFieldErrors {
  return { ...EMPTY_FIELD_ERRORS, ...fieldErrors };
}

function validateFields(password: string, passwordConfirm: string) {
  const fieldErrors: ResetPasswordFieldErrors = {
    password: !password ? '새 비밀번호를 입력해 주세요.' : !isValidPassword(password) ? PASSWORD_REQUIREMENTS : '',
    passwordConfirm: !passwordConfirm
      ? '새 비밀번호 확인을 입력해 주세요.'
      : password !== passwordConfirm
        ? '비밀번호가 일치하지 않습니다.'
        : '',
  };

  return { fieldErrors, messages: Object.values(fieldErrors).filter(Boolean) };
}

export default function Opt() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ResetPasswordFieldErrors>(EMPTY_FIELD_ERRORS);
  const [popup, setPopup] = useState<ResetPasswordPopup>({
    open: false,
    title: '',
    messages: [],
    fieldErrors: EMPTY_FIELD_ERRORS,
    success: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);

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

    if (popup.success) router.replace('/auth/sign-in');
  }

  useEffect(() => {
    async function initializeRecoverySession() {
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (type !== 'recovery' || !accessToken || !refreshToken) {
        showPopup('비밀번호 재설정 링크', ['비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.']);
        return;
      }

      const sessionResult = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionResult.error) {
        showPopup('비밀번호 재설정 링크', ['비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.']);
        return;
      }

      setIsRecoveryReady(true);
      window.history.replaceState(null, '', window.location.pathname);
    }

    void initializeRecoverySession();
  }, [supabase]);

  function clearFieldError(field: keyof ResetPasswordFieldErrors) {
    setFieldErrors((previousValue) => ({ ...previousValue, [field]: '' }));
    setPopup((previousValue) => ({
      ...previousValue,
      fieldErrors: { ...previousValue.fieldErrors, [field]: '' },
    }));
  }

  function showNativeValidationError(field: keyof ResetPasswordFieldErrors, message: string) {
    const nextFieldErrors = { ...fieldErrors, [field]: message };
    showPopup('새 비밀번호 확인', Object.values(nextFieldErrors).filter(Boolean), nextFieldErrors);
  }

  function handlePasswordChange(event: InputChangeEvent) {
    setPassword(event.currentTarget.value);
    clearFieldError('password');
  }

  function handlePasswordConfirmChange(event: InputChangeEvent) {
    setPasswordConfirm(event.currentTarget.value);
    clearFieldError('passwordConfirm');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    if (!isRecoveryReady) {
      showPopup('비밀번호 재설정 링크', ['비밀번호 재설정 링크가 유효하지 않거나 만료되었습니다.']);
      return;
    }

    const validation = validateFields(password, passwordConfirm);
    if (validation.messages.length > 0) {
      showPopup('새 비밀번호 확인', validation.messages, validation.fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password, passwordConfirm }),
      });
      const result = (await response.json().catch(() => null)) as ResetPasswordResponse | null;

      if (!response.ok || !result?.ok) {
        showPopup(
          result && typeof result.title === 'string' ? result.title : '',
          result?.errors?.length
            ? result.errors
            : ['비밀번호 재설정 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'],
          mergeFieldErrors(result?.fieldErrors),
        );
        return;
      }

      showPopup(
        '비밀번호 재설정 완료',
        ['비밀번호를 재설정했습니다.\n모든 로그인 세션이 종료되었습니다. 다시 로그인해 주세요.'],
        EMPTY_FIELD_ERRORS,
        true,
      );
    } catch {
      showPopup('', ['비밀번호 재설정 중 오류가 발생했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.']);
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
              name="password"
              placeholder="새 비밀번호"
              type="password"
              required
              inputProps={{ minLength: 8, pattern: PASSWORD_HTML_PATTERN }}
              autoComplete="new-password"
              value={password}
              onChange={handlePasswordChange}
              onInvalid={(event) => {
                event.preventDefault();
                const input = event.currentTarget as HTMLInputElement;
                showNativeValidationError(
                  'password',
                  input.validity.valueMissing ? '새 비밀번호를 입력해 주세요.' : PASSWORD_REQUIREMENTS,
                );
              }}
              error={Boolean(fieldErrors.password)}
              helperText={fieldErrors.password || PASSWORD_REQUIREMENTS}
              fullWidth
              size="small"
            />

            <TextField
              name="passwordConfirm"
              placeholder="새 비밀번호 확인"
              type="password"
              required
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={handlePasswordConfirmChange}
              onInvalid={(event) => {
                event.preventDefault();
                showNativeValidationError('passwordConfirm', '새 비밀번호 확인을 입력해 주세요.');
              }}
              error={Boolean(fieldErrors.passwordConfirm)}
              helperText={fieldErrors.passwordConfirm}
              fullWidth
              size="small"
            />

            <div className={styles.actions}>
              <button
                type="submit"
                className={`button medium submit ${styles.submit}`}
                disabled={isSubmitting || !isRecoveryReady}
              >
                비밀번호 재설정
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
