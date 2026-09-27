'use client';

import { type JSX, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormHelperText,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { clearChannelWorksCookies } from '@/lib/channelWorks/cookies.client';
import { getSupabaseBrowser } from '@/lib/supabase';
import Anchor from '@/components/Anchor';
import DarkThemeProvider from '../DarkThemeProvider';
import HCaptchaBox from './hCaptcha';
import styles from '@/app/auth.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type SignInDecision = 'idle' | 'confirm-enable-email-login' | 'confirm-email-login';
type SignInFieldErrors = {
  email: string;
  password: string;
  captcha: string;
};

type SignInResponse = {
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  code?: string;
  captchaRequired?: boolean;
  failureCount?: number;
};

type LoginErrorPopup = {
  open: boolean;
  title: string;
  messages: string[];
  fieldErrors: SignInFieldErrors;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_FIELD_ERRORS: SignInFieldErrors = {
  email: '',
  password: '',
  captcha: '',
};
const EMPTY_ERROR_POPUP: LoginErrorPopup = {
  open: false,
  title: '',
  messages: [],
  fieldErrors: EMPTY_FIELD_ERRORS,
};

function addSentenceLineBreaks(message: string) {
  return message.replace(/([.!?])\s+(?=\S)/g, '$1\n');
}

class SignInRequestError extends Error {
  code: string;
  failureCount: number;

  constructor(result: SignInResponse) {
    super(result.error ?? '로그인 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.');
    this.name = 'SignInRequestError';
    this.code = result.code ?? '';
    this.failureCount = result.failureCount ?? 0;
  }
}

class LoginFlowError extends Error {
  title: string;

  constructor(title: string, message: string) {
    super(message);
    this.name = 'LoginFlowError';
    this.title = title;
  }
}

export default function EmailSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const inviteSiteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';
  const inviteType = searchParams.get('inviteType')?.trim().toLowerCase() ?? '';
  const callbackErrorDescription = searchParams.get('errorDescription')?.trim() ?? '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [isCaptchaRequired, setIsCaptchaRequired] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>(EMPTY_FIELD_ERRORS);
  const [errorPopup, setErrorPopup] = useState<LoginErrorPopup>(EMPTY_ERROR_POPUP);
  const [decisionMessage, setDecisionMessage] = useState('');
  const [decisionState, setDecisionState] = useState<SignInDecision>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [returnPath, setReturnPath] = useState<string | null>(null);

  useEffect(() => {
    setReturnPath(sessionStorage.getItem('route:returnPath'));
  }, []);

  useEffect(() => {
    if (callbackErrorDescription) {
      showErrorPopup('로그인 오류', [callbackErrorDescription]);
    }
  }, [callbackErrorDescription]);

  function showErrorPopup(title: string, messages: string[], nextFieldErrors = EMPTY_FIELD_ERRORS) {
    setErrorPopup({
      open: true,
      title,
      messages: messages.map(addSentenceLineBreaks),
      fieldErrors: nextFieldErrors,
    });
  }

  function handleErrorPopupClose() {
    setFieldErrors(errorPopup.fieldErrors);
    setErrorPopup((previousValue) => ({ ...previousValue, open: false }));
  }

  function showFieldValidationError(field: keyof SignInFieldErrors, message: string) {
    setErrorPopup((previousValue) => {
      const nextFieldErrors = {
        ...previousValue.fieldErrors,
        [field]: message,
      };

      return {
        open: true,
        title: '로그인 정보 확인',
        messages: Object.values(nextFieldErrors).filter(Boolean),
        fieldErrors: nextFieldErrors,
      };
    });
  }

  function handleEmailChange(event: InputChangeEvent) {
    setEmail(event.currentTarget.value);
    setFieldErrors((previousValue) => ({ ...previousValue, email: '' }));
    setErrorPopup((previousValue) => ({
      ...previousValue,
      fieldErrors: { ...previousValue.fieldErrors, email: '' },
    }));
  }

  function handlePasswordChange(event: InputChangeEvent) {
    setPassword(event.currentTarget.value);
    setFieldErrors((previousValue) => ({ ...previousValue, password: '' }));
    setErrorPopup((previousValue) => ({
      ...previousValue,
      fieldErrors: { ...previousValue.fieldErrors, password: '' },
    }));
  }

  const handleCaptchaTokenChange = useCallback((token: string) => {
    setCaptchaToken(token);

    if (token) {
      setFieldErrors((previousValue) => ({ ...previousValue, captcha: '' }));
      setErrorPopup((previousValue) => ({
        ...previousValue,
        fieldErrors: { ...previousValue.fieldErrors, captcha: '' },
      }));
    }
  }, []);

  function validateSignInFields() {
    const trimmedEmail = email.trim().toLowerCase();
    const nextFieldErrors: SignInFieldErrors = {
      email: !trimmedEmail
        ? '이메일을 입력해 주세요.'
        : !EMAIL_PATTERN.test(trimmedEmail)
          ? '올바른 이메일 형식으로 입력해 주세요.'
          : '',
      password: password ? '' : '비밀번호를 입력해 주세요.',
      captcha: isCaptchaRequired && !captchaToken ? '보안 확인을 완료해 주세요.' : '',
    };

    const messages = Object.values(nextFieldErrors).filter(Boolean);

    if (messages.length > 0) {
      showErrorPopup('로그인 정보 확인', messages, nextFieldErrors);
      return false;
    }

    return true;
  }

  function showSignInError(error: unknown) {
    if (error instanceof SignInRequestError) {
      const messages = [error.message];

      if (error.failureCount > 0) {
        messages.push(`로그인 ${error.failureCount}회째 시도 중입니다 `);
      }

      if (error.code === 'email_not_confirmed') {
        showErrorPopup('이메일 인증 확인', messages, {
          ...EMPTY_FIELD_ERRORS,
          email: '이메일 인증을 완료해 주세요.',
        });
        return;
      }

      if (error.code === 'password_force_reset') {
        showErrorPopup('로그인 제한', messages, {
          ...EMPTY_FIELD_ERRORS,
          password: '비밀번호를 재설정해 주세요.',
        });
        return;
      }

      if (error.code === 'captcha_required' || error.code === 'captcha_invalid') {
        showErrorPopup('로그인 실패', messages, {
          ...EMPTY_FIELD_ERRORS,
          captcha: '보안 확인을 다시 완료해 주세요.',
        });
        return;
      }

      if (error.code === 'invalid_credentials') {
        showErrorPopup('로그인 실패', messages, {
          ...EMPTY_FIELD_ERRORS,
          email: '로그인 정보를 확인해 주세요.',
          password: '로그인 정보를 확인해 주세요.',
        });
        return;
      }

      showErrorPopup('로그인 오류', messages);
      return;
    }

    if (error instanceof LoginFlowError) {
      showErrorPopup(error.title, [error.message]);
      return;
    }

    showErrorPopup('로그인 오류', [
      error instanceof Error && error.message
        ? error.message
        : '로그인 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.',
    ]);
  }

  async function runInviteAccept() {
    if (!inviteToken) {
      return false;
    }

    const invitePath = inviteType === 'community' ? 'invite-community' : 'invite-blog';
    router.replace(`/${inviteSiteName}/${invitePath}/${inviteToken}`);
    return true;
  }

  async function runSignIn(trimmedEmail: string) {
    const signInResponse = await fetch('/api/auth/email/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: trimmedEmail,
        password,
        captchaToken: captchaToken || null,
      }),
    });

    const signInResult = (await signInResponse.json()) as SignInResponse;

    if (!signInResponse.ok) {
      setIsCaptchaRequired(Boolean(signInResult.captchaRequired));

      if (Boolean(signInResult.captchaRequired)) {
        setCaptchaResetKey((previousValue) => previousValue + 1);
      }

      throw new SignInRequestError(signInResult);
    }

    clearChannelWorksCookies();

    if (!signInResult.accessToken || !signInResult.refreshToken) {
      throw new LoginFlowError('로그인 세션 오류', '로그인 세션을 설정하지 못했습니다.\n잠시 후 다시 시도해 주세요.');
    }

    const setSessionResult = await supabase.auth.setSession({
      access_token: signInResult.accessToken,
      refresh_token: signInResult.refreshToken,
    });

    if (setSessionResult.error) {
      throw new LoginFlowError('로그인 세션 오류', '로그인 세션을 설정하지 못했습니다.\n잠시 후 다시 시도해 주세요.');
    }

    const inviteAccepted = await runInviteAccept();

    if (inviteAccepted) {
      return;
    }

    const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assuranceLevelResult.error) {
      throw new LoginFlowError(
        '보안 정보 확인 오류',
        '로그인은 완료되었지만 보안 정보를 확인하지 못했습니다.\n다시 로그인해 주세요.',
      );
    }

    const currentLevel = assuranceLevelResult.data.currentLevel;
    const nextLevel = assuranceLevelResult.data.nextLevel;

    if (currentLevel !== 'aal2' && nextLevel === 'aal2') {
      router.replace('/');
      return;
    }

    if (inviteSiteName) {
      router.replace(`/${inviteSiteName}`);
      return;
    }

    if (returnPath) {
      router.replace(returnPath);
      return;
    }

    router.replace('/');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!validateSignInFields()) {
      return;
    }

    setDecisionMessage('');
    setDecisionState('idle');
    setIsSubmitting(true);

    try {
      const checkResponse = await fetch('/api/auth/email/sign-in/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: trimmedEmail,
        }),
      });

      const checkResult = await checkResponse.json();

      if (!checkResponse.ok) {
        throw new Error(checkResult.error ?? '계정 정보를 확인하지 못했습니다.');
      }

      if (checkResult.accountType === 'social' && checkResult.hasPassword === false) {
        setDecisionState('confirm-enable-email-login');
        setDecisionMessage(
          '이 계정은 소셜 로그인으로 가입되어 있습니다. 이메일 로그인도 사용할 수 있도록 비밀번호 설정 메일을 보내시겠습니까?',
        );
        setIsSubmitting(false);
        return;
      }

      if (checkResult.accountType === 'social' && checkResult.hasPassword === true) {
        setDecisionState('confirm-email-login');
        setDecisionMessage('이미 소셜 로그인으로 가입한 계정입니다. 그래도 이메일로 로그인하시겠습니까?');
        setIsSubmitting(false);
        return;
      }

      await runSignIn(trimmedEmail);
    } catch (unknownError) {
      showSignInError(unknownError);
      setIsSubmitting(false);
    }
  }

  async function handleConfirmEnableEmailLogin() {
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      showErrorPopup('로그인 정보 확인', ['이메일을 입력해 주세요.'], {
        ...EMPTY_FIELD_ERRORS,
        email: '이메일을 입력해 주세요.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const resetPasswordResponse = await fetch('/api/notifications/email/password-reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: 'recovery',
          email: trimmedEmail,
        }),
      });
      const resetPasswordResult = (await resetPasswordResponse.json()) as { error?: string };

      if (!resetPasswordResponse.ok) {
        throw new Error(resetPasswordResult.error || '비밀번호 설정 메일을 보내지 못했습니다.');
      }

      setDecisionState('idle');
      setDecisionMessage(
        '비밀번호 설정 메일을 보냈습니다. 메일에서 비밀번호를 설정한 뒤 이메일 로그인하실 수 있습니다.',
      );
      setIsSubmitting(false);
    } catch (unknownError) {
      showErrorPopup('메일 전송 오류', [
        unknownError instanceof Error && unknownError.message
          ? unknownError.message
          : '비밀번호 설정 메일을 보내지 못했습니다.',
      ]);
      setIsSubmitting(false);
    }
  }

  async function handleConfirmEmailLogin() {
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!validateSignInFields()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await runSignIn(trimmedEmail);
    } catch (unknownError) {
      showSignInError(unknownError);
      setIsSubmitting(false);
    }
  }

  function handleCancelDecision() {
    if (isSubmitting) {
      return;
    }

    setDecisionState('idle');
    setDecisionMessage('');
  }

  const inviteParams = new URLSearchParams();

  if (inviteToken) {
    inviteParams.set('inviteToken', inviteToken);
  }

  if (inviteSiteName) {
    inviteParams.set('siteName', inviteSiteName);
  }

  if (inviteType) {
    inviteParams.set('inviteType', inviteType);
  }

  const signUpHref = inviteParams.toString() ? `/auth/sign-up?${inviteParams.toString()}` : '/auth/sign-up';

  return (
    <DarkThemeProvider>
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
            onInvalid={(event) => {
              event.preventDefault();
              const input = event.currentTarget as HTMLInputElement;
              showFieldValidationError(
                'email',
                input.validity.valueMissing ? '이메일을 입력해 주세요.' : '올바른 이메일 형식으로 입력해 주세요.',
              );
            }}
            error={Boolean(fieldErrors.email)}
            helperText={fieldErrors.email}
            fullWidth
            size="small"
          />
          <TextField
            name="password"
            placeholder="비밀번호"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={handlePasswordChange}
            onInvalid={(event) => {
              event.preventDefault();
              showFieldValidationError('password', '비밀번호를 입력해 주세요.');
            }}
            error={Boolean(fieldErrors.password)}
            helperText={fieldErrors.password}
            fullWidth
            size="small"
          />

          {isCaptchaRequired ? (
            <Stack gap={1}>
              <Typography variant="subtitle2">로그인 실패가 누적되어 캡챠 확인이 필요합니다.</Typography>
              <HCaptchaBox onTokenChange={handleCaptchaTokenChange} resetKey={captchaResetKey} />
              {fieldErrors.captcha ? <FormHelperText error>{fieldErrors.captcha}</FormHelperText> : null}
            </Stack>
          ) : null}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
            <Anchor href={signUpHref} className={`button small action ${styles.action}`}>
              회원가입
            </Anchor>
            <Anchor href="/auth/find-password" className={`button small action ${styles.action}`}>
              비밀번호 찾기
            </Anchor>
          </Box>

          <div className={styles.actions}>
            <button type="submit" className={`button medium submit ${styles.submit}`} disabled={isSubmitting}>
              이메일로 계속하기
            </button>
          </div>

          {decisionState === 'idle' && decisionMessage ? (
            <p className={`alert info ${styles.alert}`}>
              <InfoOutlineRoundedIcon />
              <span>{decisionMessage}</span>
            </p>
          ) : null}
        </Stack>
        {isMobile ? (
          <Drawer
            anchor="bottom"
            open={errorPopup.open}
            onClose={handleErrorPopupClose}
            className="VhiDrawer-bottom VhiDrawer-bottom-service"
          >
            <h2>{errorPopup.title}</h2>
            <button type="button" className="close-button" onClick={handleErrorPopupClose} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <div className="VhiDrawer-bottom-content">
              <ul>
                {errorPopup.messages.map((message, index) => (
                  <li key={`${index}-${message}`} style={{ whiteSpace: 'pre-line' }}>
                    {message}
                  </li>
                ))}
              </ul>
            </div>
            <div className="drawer-dialog-actions">
              <button type="button" className="button small cancel" onClick={handleErrorPopupClose}>
                확인
              </button>
            </div>
          </Drawer>
        ) : (
          <Dialog
            open={errorPopup.open}
            onClose={handleErrorPopupClose}
            fullWidth
            maxWidth="xs"
            className="vh-dialog vh-alert-dialog"
          >
            <DialogTitle>{errorPopup.title}</DialogTitle>
            <button type="button" className="close-button" onClick={handleErrorPopupClose} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <DialogContent>
              <ul>
                {errorPopup.messages.map((message, index) => (
                  <li key={`${index}-${message}`} style={{ whiteSpace: 'pre-line' }}>
                    {message}
                  </li>
                ))}
              </ul>
            </DialogContent>
            <DialogActions>
              <button type="button" onClick={handleErrorPopupClose}>
                확인
              </button>
            </DialogActions>
          </Dialog>
        )}
        {isMobile ? (
          <Drawer
            anchor="bottom"
            open={decisionState === 'confirm-enable-email-login'}
            onClose={handleCancelDecision}
            className="VhiDrawer-bottom VhiDrawer-bottom-service"
          >
            <h2>이메일 로그인 설정</h2>
            <button
              type="button"
              className="close-button"
              onClick={handleCancelDecision}
              aria-label="닫기"
              disabled={isSubmitting}
            >
              <CloseRoundedIcon />
            </button>
            <div className="VhiDrawer-bottom-content">
              <Typography variant="subtitle2">{decisionMessage}</Typography>
            </div>
            <div className="drawer-dialog-actions">
              <button
                type="button"
                className="button small cancel"
                onClick={handleCancelDecision}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="button small submit"
                onClick={handleConfirmEnableEmailLogin}
                disabled={isSubmitting}
              >
                비밀번호 설정 메일 보내기
              </button>
            </div>
          </Drawer>
        ) : (
          <Dialog
            open={decisionState === 'confirm-enable-email-login'}
            onClose={handleCancelDecision}
            fullWidth
            maxWidth="xs"
            className="vh-dialog vh-alert-dialog"
          >
            <DialogTitle>이메일 로그인 설정</DialogTitle>
            <button
              type="button"
              className="close-button"
              onClick={handleCancelDecision}
              aria-label="닫기"
              disabled={isSubmitting}
            >
              <CloseRoundedIcon />
            </button>
            <DialogContent>
              <Typography variant="subtitle2">{decisionMessage}</Typography>
            </DialogContent>
            <DialogActions>
              <button type="button" className="cancel-button" onClick={handleCancelDecision} disabled={isSubmitting}>
                취소
              </button>
              <button type="button" onClick={handleConfirmEnableEmailLogin} disabled={isSubmitting}>
                비밀번호 설정 메일 보내기
              </button>
            </DialogActions>
          </Dialog>
        )}

        {isMobile ? (
          <Drawer
            anchor="bottom"
            open={decisionState === 'confirm-email-login'}
            onClose={handleCancelDecision}
            className="VhiDrawer-bottom VhiDrawer-bottom-service"
          >
            <h2>이메일 로그인 확인</h2>
            <button
              type="button"
              className="close-button"
              onClick={handleCancelDecision}
              aria-label="닫기"
              disabled={isSubmitting}
            >
              <CloseRoundedIcon />
            </button>
            <div className="VhiDrawer-bottom-content">
              <Typography variant="subtitle2">{decisionMessage}</Typography>
            </div>
            <div className="drawer-dialog-actions">
              <button
                type="button"
                className="button small cancel"
                onClick={handleCancelDecision}
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                className="button small submit"
                onClick={handleConfirmEmailLogin}
                disabled={isSubmitting}
              >
                이메일 로그인
              </button>
            </div>
          </Drawer>
        ) : (
          <Dialog
            open={decisionState === 'confirm-email-login'}
            onClose={handleCancelDecision}
            fullWidth
            maxWidth="xs"
            className="vh-dialog vh-alert-dialog"
          >
            <DialogTitle>이메일 로그인 확인</DialogTitle>
            <button
              type="button"
              className="close-button"
              onClick={handleCancelDecision}
              aria-label="닫기"
              disabled={isSubmitting}
            >
              <CloseRoundedIcon />
            </button>
            <DialogContent>
              <Typography variant="subtitle2">{decisionMessage}</Typography>
            </DialogContent>
            <DialogActions>
              <button type="button" className="cancel-button" onClick={handleCancelDecision} disabled={isSubmitting}>
                취소
              </button>
              <button type="button" onClick={handleConfirmEmailLogin} disabled={isSubmitting}>
                이메일 로그인
              </button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    </DarkThemeProvider>
  );
}
