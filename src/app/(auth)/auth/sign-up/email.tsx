'use client';

import { type JSX, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ACTIVITY_NAME_MAX_LENGTH,
  ACTIVITY_NAME_MIN_LENGTH,
  EMAIL_PATTERN,
  EMPTY_EMAIL_SIGN_UP_FIELD_ERRORS,
  type EmailSignUpFieldErrors,
  getEmailLocalPart,
  isValidActivityName,
  validateEmailSignUpFields,
} from '@/lib/auth/emailSignUp';
import { PASSWORD_REQUIREMENTS } from '@/lib/auth/password';
import { getSupabaseBrowser } from '@/lib/supabase';
import Anchor from '@/components/Anchor';
import { SignupAgreementFields, useSignupAgreements } from '@/components/auth/SignupAgreements';
import DarkThemeProvider from '../DarkThemeProvider';
import styles from '@/app/auth.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type SignUpResponse = {
  ok?: boolean;
  emailConfirmed?: boolean;
  code?: string;
  title?: string;
  errors?: string[];
  fieldErrors?: Partial<EmailSignUpFieldErrors>;
};

type SignUpPopup = {
  open: boolean;
  title: string;
  messages: string[];
  fieldErrors: EmailSignUpFieldErrors;
  success: boolean;
};

const isDevelopment = process.env.NODE_ENV === 'development';
const PASSWORD_HTML_PATTERN = '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z0-9\\s]).{8,}';

function addSentenceLineBreaks(message: string) {
  return message.replace(/([.!?])\s+(?=\S)/g, '$1\n');
}

function mergeFieldErrors(fieldErrors?: Partial<EmailSignUpFieldErrors>): EmailSignUpFieldErrors {
  return { ...EMPTY_EMAIL_SIGN_UP_FIELD_ERRORS, ...fieldErrors };
}

function getInitialInviteErrorTitle(message: string) {
  return message && message !== '초대장을 불러오지 못했습니다.' ? '초대 정보 확인' : '';
}

export default function EmailSignUp({
  initialInviteEmail = '',
  initialInviteError = '',
}: {
  initialInviteEmail?: string;
  initialInviteError?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const { isAgreeTerm, isAgreeChild, isAgreePrivacy } = useSignupAgreements();
  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const inviteSiteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';
  const inviteType = searchParams.get('inviteType')?.trim().toLowerCase() ?? '';
  const inviteProof = searchParams.get('inviteProof')?.trim() ?? '';
  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState(initialInviteEmail);
  const isInviteEmailLocked = Boolean(initialInviteEmail);
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [bypassEmailConfirm, setBypassEmailConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<EmailSignUpFieldErrors>(EMPTY_EMAIL_SIGN_UP_FIELD_ERRORS);
  const [popup, setPopup] = useState<SignUpPopup>({
    open: Boolean(initialInviteError),
    title: getInitialInviteErrorTitle(initialInviteError),
    messages: initialInviteError ? [initialInviteError] : [],
    fieldErrors: EMPTY_EMAIL_SIGN_UP_FIELD_ERRORS,
    success: false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const emailLocalPart = getEmailLocalPart(email.trim().toLowerCase());
  const isActivityNameRequired = Boolean(email) && !isValidActivityName(emailLocalPart);

  function showPopup(
    title: string,
    messages: string[],
    nextFieldErrors = EMPTY_EMAIL_SIGN_UP_FIELD_ERRORS,
    success = false,
  ) {
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

  function showNativeValidationError(field: keyof EmailSignUpFieldErrors, message: string) {
    setPopup((previousValue) => {
      const nextFieldErrors = { ...previousValue.fieldErrors, [field]: message };
      return {
        open: true,
        title: '회원가입 정보 확인',
        messages: Object.values(nextFieldErrors).filter(Boolean),
        fieldErrors: nextFieldErrors,
        success: false,
      };
    });
  }

  function clearFieldError(field: keyof EmailSignUpFieldErrors) {
    setFieldErrors((previousValue) => ({ ...previousValue, [field]: '' }));
    setPopup((previousValue) => ({
      ...previousValue,
      fieldErrors: { ...previousValue.fieldErrors, [field]: '' },
    }));
  }

  function handleUserNameChange(event: InputChangeEvent) {
    setUserName(event.currentTarget.value);
    clearFieldError('userName');
  }

  function handleEmailChange(event: InputChangeEvent) {
    if (isInviteEmailLocked) return;
    setEmail(event.currentTarget.value);
    clearFieldError('email');
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

    const trimmedEmail = email.trim().toLowerCase();
    const validation = validateEmailSignUpFields({
      email: trimmedEmail,
      userName,
      password,
      passwordConfirm,
      isAgreeTerm,
      isAgreeChild,
      isAgreePrivacy,
    });

    if (validation.messages.length > 0) {
      showPopup('회원가입 정보 확인', validation.messages, validation.fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/email/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: trimmedEmail,
          userName: userName.trim(),
          password,
          passwordConfirm,
          isAgreeTerm,
          isAgreeChild,
          isAgreePrivacy,
          bypassEmailConfirm: isDevelopment ? bypassEmailConfirm : false,
          inviteToken,
          inviteSiteName,
          inviteType,
          inviteProof,
        }),
      });
      const result = (await response.json().catch(() => null)) as SignUpResponse | null;

      if (!response.ok || !result?.ok) {
        showPopup(
          result && typeof result.title === 'string' ? result.title : '회원가입 오류',
          result?.errors?.length
            ? result.errors
            : ['회원가입 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'],
          mergeFieldErrors(result?.fieldErrors),
        );
        return;
      }

      if (!result.emailConfirmed) {
        showPopup(
          '이메일 인증 안내',
          ['이메일 인증 메일을 보냈습니다.\n메일함에서 인증을 완료해 주세요.'],
          EMPTY_EMAIL_SIGN_UP_FIELD_ERRORS,
          true,
        );
        return;
      }

      const signInResult = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });

      if (signInResult.error) {
        showPopup('로그인 오류', [
          '가입은 완료되었지만 로그인하지 못했습니다.\n이메일 로그인으로 다시 로그인해 주세요.',
        ]);
        return;
      }

      if (inviteToken && inviteSiteName && inviteType === 'community') {
        router.replace(`/${inviteSiteName}/invite-community/${inviteToken}`);
        return;
      }

      if (inviteToken && inviteSiteName && inviteType === 'blog') {
        router.replace(`/${inviteSiteName}/invite-blog/${inviteToken}`);
        return;
      }

      router.replace('/');
    } catch {
      showPopup('', ['회원가입 처리 중 오류가 발생했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.']);
    } finally {
      setIsSubmitting(false);
    }
  }

  const inviteParams = new URLSearchParams();
  if (inviteToken) inviteParams.set('inviteToken', inviteToken);
  if (inviteSiteName) inviteParams.set('siteName', inviteSiteName);
  if (inviteType) inviteParams.set('inviteType', inviteType);
  const signInHref = inviteParams.toString() ? `/auth/sign-in?${inviteParams.toString()}` : '/auth/sign-in';

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
            inputProps={{ readOnly: isInviteEmailLocked, pattern: EMAIL_PATTERN.source }}
            onInvalid={(event) => {
              event.preventDefault();
              const input = event.currentTarget as HTMLInputElement;
              showNativeValidationError(
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
            name="userName"
            placeholder="활동명"
            type="text"
            required={isActivityNameRequired}
            inputProps={{ minLength: ACTIVITY_NAME_MIN_LENGTH, maxLength: ACTIVITY_NAME_MAX_LENGTH }}
            autoComplete="nickname"
            value={userName}
            onChange={handleUserNameChange}
            onInvalid={(event) => {
              event.preventDefault();
              showNativeValidationError('userName', '활동명은 2자 이상 10자 이하로 입력해 주세요.');
            }}
            error={Boolean(fieldErrors.userName)}
            helperText={fieldErrors.userName}
            fullWidth
            size="small"
          />

          <TextField
            name="password"
            placeholder="비밀번호"
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
                input.validity.valueMissing ? '비밀번호를 입력해 주세요.' : PASSWORD_REQUIREMENTS,
              );
            }}
            error={Boolean(fieldErrors.password)}
            helperText={fieldErrors.password || PASSWORD_REQUIREMENTS}
            fullWidth
            size="small"
          />

          <TextField
            name="passwordConfirm"
            placeholder="비밀번호 확인"
            type="password"
            required
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={handlePasswordConfirmChange}
            onInvalid={(event) => {
              event.preventDefault();
              showNativeValidationError('passwordConfirm', '비밀번호 확인을 입력해 주세요.');
            }}
            error={Boolean(fieldErrors.passwordConfirm)}
            helperText={fieldErrors.passwordConfirm}
            fullWidth
            size="small"
          />

          <SignupAgreementFields
            errors={{
              child: fieldErrors.isAgreeChild,
              term: fieldErrors.isAgreeTerm,
              privacy: fieldErrors.isAgreePrivacy,
            }}
            onClearError={(field) => clearFieldError(field)}
            onInvalid={(field, message) => showNativeValidationError(field, message)}
          />

          {isDevelopment ? (
            <FormControlLabel
              control={
                <Switch
                  checked={bypassEmailConfirm}
                  onChange={(event) => setBypassEmailConfirm(event.target.checked)}
                />
              }
              label="이메일 인증 바이패스"
            />
          ) : null}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Anchor href={signInHref} className={`button small action ${styles.action}`}>
              로그인 하기
            </Anchor>
          </Box>

          <div className={styles.actions}>
            <button type="submit" className={`button medium submit ${styles.submit}`} disabled={isSubmitting}>
              이메일로 시작하기
            </button>
          </div>
        </Stack>

        {isMobile ? (
          <Drawer
            anchor="bottom"
            open={popup.open}
            onClose={handlePopupClose}
            className="VhiDrawer-bottom VhiDrawer-bottom-service"
          >
            {popup.title ? <h2>{popup.title}</h2> : null}
            <button type="button" className="close-button" onClick={handlePopupClose} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <div className="VhiDrawer-bottom-content">
              <ul>
                {popup.messages.map((message, index) => (
                  <li key={`${index}-${message}`} style={{ whiteSpace: 'pre-line' }}>
                    {message}
                  </li>
                ))}
              </ul>
            </div>
            <div className="drawer-dialog-actions">
              <button type="button" className="button small cancel" onClick={handlePopupClose}>
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
            {popup.title ? <DialogTitle>{popup.title}</DialogTitle> : null}
            <button type="button" className="close-button" onClick={handlePopupClose} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <DialogContent>
              <ul>
                {popup.messages.map((message, index) => (
                  <li key={`${index}-${message}`} style={{ whiteSpace: 'pre-line' }}>
                    {message}
                  </li>
                ))}
              </ul>
            </DialogContent>
            <DialogActions>
              <button type="button" onClick={handlePopupClose}>
                확인
              </button>
            </DialogActions>
          </Dialog>
        )}
      </Box>
    </DarkThemeProvider>
  );
}
