'use client';

import { type JSX, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import {
  EMPTY_SOCIAL_SIGN_UP_FIELD_ERRORS,
  SOCIAL_ACTIVITY_NAME_MAX_LENGTH,
  SOCIAL_ACTIVITY_NAME_MIN_LENGTH,
  type SocialSignUpFieldErrors,
  getSocialActivityName,
  validateSocialSignUpFields,
} from '@/lib/auth/socialSignUp';
import { getSupabaseBrowser } from '@/lib/supabase';
import { SignupAgreementFields, useSignupAgreements } from '@/components/auth/SignupAgreements';
import styles from '@/app/auth.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type SocialProfile = {
  authUserId: string;
  email: string;
  provider: string;
  providerAccountId: string | null;
  userName: string;
  avatar: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
};

type SocialSignUpResponse = {
  ok?: boolean;
  title?: string;
  errors?: string[];
  fieldErrors?: Partial<SocialSignUpFieldErrors>;
};

type ErrorPopup = {
  open: boolean;
  title: string;
  messages: string[];
  fieldErrors: SocialSignUpFieldErrors;
};

function mergeFieldErrors(fieldErrors?: Partial<SocialSignUpFieldErrors>): SocialSignUpFieldErrors {
  return { ...EMPTY_SOCIAL_SIGN_UP_FIELD_ERRORS, ...fieldErrors };
}

function addSentenceLineBreaks(message: string) {
  return message.replace(/([.!?])\s+(?=\S)/g, '$1\n');
}

export default function Opt() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = getSupabaseBrowser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const { isAgreeTerm, isAgreeChild, isAgreePrivacy } = useSignupAgreements();
  const inviteToken = searchParams.get('inviteToken')?.trim() ?? '';
  const inviteSiteName = searchParams.get('siteName')?.trim().toLowerCase() ?? '';
  const inviteType = searchParams.get('inviteType')?.trim().toLowerCase() ?? '';
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [userName, setUserName] = useState('');
  const [paymentEmail, setPaymentEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<SocialSignUpFieldErrors>(EMPTY_SOCIAL_SIGN_UP_FIELD_ERRORS);
  const [popup, setPopup] = useState<ErrorPopup>({
    open: false,
    title: '',
    messages: [],
    fieldErrors: EMPTY_SOCIAL_SIGN_UP_FIELD_ERRORS,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasLoadedProfile = useRef(false);

  function showPopup(
    title: string,
    messages: string[],
    nextFieldErrors: SocialSignUpFieldErrors = EMPTY_SOCIAL_SIGN_UP_FIELD_ERRORS,
  ) {
    setPopup({ open: true, title, messages: messages.map(addSentenceLineBreaks), fieldErrors: nextFieldErrors });
  }

  function handlePopupClose() {
    setFieldErrors(popup.fieldErrors);
    setPopup((previousValue) => ({ ...previousValue, open: false }));
  }

  function showNativeValidationError(field: keyof SocialSignUpFieldErrors, message: string) {
    setPopup((previousValue) => {
      const nextFieldErrors = { ...previousValue.fieldErrors, [field]: message };
      return {
        open: true,
        title: '회원가입 정보 확인',
        messages: Object.values(nextFieldErrors).filter(Boolean),
        fieldErrors: nextFieldErrors,
      };
    });
  }

  function clearFieldError(field: keyof SocialSignUpFieldErrors) {
    setFieldErrors((previousValue) => ({ ...previousValue, [field]: '' }));
    setPopup((previousValue) => ({
      ...previousValue,
      fieldErrors: { ...previousValue.fieldErrors, [field]: '' },
    }));
  }

  useEffect(() => {
    if (hasLoadedProfile.current) return;
    hasLoadedProfile.current = true;

    async function loadProfile() {
      try {
        const sessionResult = await supabase.auth.getSession();

        if (sessionResult.error || !sessionResult.data.session) {
          router.replace('/auth/sign-in');
          return;
        }

        const userResult = await supabase.auth.getUser();

        if (userResult.error || !userResult.data.user) {
          router.replace('/auth/sign-in');
          return;
        }

        const authUser = userResult.data.user;
        const metadata = authUser.user_metadata ?? {};
        const metadataProvider = typeof metadata.provider === 'string' ? metadata.provider.trim().toLowerCase() : '';
        const provider =
          metadataProvider === 'naver'
            ? metadataProvider
            : String(authUser.identities?.[0]?.provider ?? authUser.app_metadata?.provider ?? metadataProvider)
                .trim()
                .toLowerCase();

        if (!provider || !authUser.email) throw new Error('소셜 로그인 정보를 확인하지 못했습니다.');

        const providerAccountId =
          provider === 'naver'
            ? typeof metadata.naver_id === 'string'
              ? metadata.naver_id
              : null
            : (authUser.identities?.[0]?.id ?? (typeof metadata.sub === 'string' ? metadata.sub : null));
        const initialUserName = getSocialActivityName(
          metadata.name ?? metadata.full_name ?? metadata.user_name ?? metadata.preferred_username,
          authUser.email,
          provider,
        );

        setUserName(initialUserName);
        setProfile({
          authUserId: authUser.id,
          email: authUser.email,
          provider,
          providerAccountId,
          userName: initialUserName,
          avatar:
            (typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null) ??
            (typeof metadata.picture === 'string' ? metadata.picture : null) ??
            (typeof metadata.avatar === 'string' ? metadata.avatar : null),
          accessToken: sessionResult.data.session.provider_token ?? null,
          refreshToken: sessionResult.data.session.provider_refresh_token ?? null,
          tokenExpiresAt: sessionResult.data.session.expires_at ?? null,
        });
      } catch {
        showPopup('', ['소셜 로그인 정보를 확인하지 못했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.']);
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [router, supabase]);

  async function moveAfterSignUp() {
    const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (!assuranceLevelResult.error) {
      const { currentLevel, nextLevel } = assuranceLevelResult.data;

      if (currentLevel !== 'aal2' && nextLevel === 'aal2') {
        const afterMfaPath =
          inviteToken && inviteSiteName
            ? `/${inviteSiteName}/${inviteType === 'community' ? 'invite-community' : 'invite-blog'}/${inviteToken}`
            : sessionStorage.getItem('route:returnPath') || '/';
        sessionStorage.setItem('auth:after-mfa', afterMfaPath);
        router.replace('/auth/verify-2fa');
        return;
      }
    }

    if (inviteToken && inviteSiteName) {
      const invitePath = inviteType === 'community' ? 'invite-community' : 'invite-blog';
      router.replace(`/${inviteSiteName}/${invitePath}/${inviteToken}`);
      return;
    }

    const returnPath = sessionStorage.getItem('route:returnPath');
    router.replace(returnPath || '/');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    if (!profile || isSubmitting) return;

    const validation = validateSocialSignUpFields({
      provider: profile.provider,
      userName,
      paymentEmail,
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
      const response = await fetch('/api/auth/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...profile,
          userName: validation.userName,
          paymentEmail: profile.provider === 'naver' ? validation.paymentEmail : undefined,
          isAgreeTerm,
          isAgreeChild,
          isAgreePrivacy,
        }),
      });
      const result = (await response.json().catch(() => null)) as SocialSignUpResponse | null;

      if (!response.ok || !result?.ok) {
        showPopup(
          result?.title ?? '회원가입 오류',
          result?.errors?.length
            ? result.errors
            : ['회원가입 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'],
          mergeFieldErrors(result?.fieldErrors),
        );
        return;
      }

      await moveAfterSignUp();
    } catch {
      showPopup('', ['회원가입 처리 중 오류가 발생했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.']);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack gap={1}>
        {isLoading ? <p>소셜 로그인 정보를 확인하고 있습니다.</p> : null}
        {profile?.provider === 'naver' ? (
          <TextField
            name="paymentEmail"
            placeholder="이메일"
            autoComplete="email"
            type="email"
            required
            slotProps={{ htmlInput: { pattern: EMAIL_PATTERN.source } }}
            value={paymentEmail}
            onChange={(event: InputChangeEvent) => {
              setPaymentEmail(event.currentTarget.value);
              clearFieldError('paymentEmail');
            }}
            onInvalid={(event) => {
              event.preventDefault();
              const input = event.currentTarget as HTMLInputElement;
              showNativeValidationError(
                'paymentEmail',
                input.validity.valueMissing ? '이메일을 입력해 주세요.' : '올바른 이메일 형식으로 입력해 주세요.',
              );
            }}
            error={Boolean(fieldErrors.paymentEmail)}
            helperText={fieldErrors.paymentEmail}
            fullWidth
            size="small"
            disabled={isLoading || isSubmitting}
          />
        ) : null}
        <TextField
          name="userName"
          placeholder="활동명"
          autoComplete="nickname"
          required
          slotProps={{
            htmlInput: { minLength: SOCIAL_ACTIVITY_NAME_MIN_LENGTH, maxLength: SOCIAL_ACTIVITY_NAME_MAX_LENGTH },
          }}
          value={userName}
          onChange={(event: InputChangeEvent) => {
            setUserName(event.currentTarget.value);
            clearFieldError('userName');
          }}
          onInvalid={(event) => {
            event.preventDefault();
            showNativeValidationError('userName', '활동명은 2자 이상 10자 이하로 입력해 주세요.');
          }}
          error={Boolean(fieldErrors.userName)}
          helperText={fieldErrors.userName}
          fullWidth
          size="small"
          disabled={isLoading || isSubmitting}
        />
        {isLoading ? null : (
          <SignupAgreementFields
            errors={{
              child: fieldErrors.isAgreeChild,
              term: fieldErrors.isAgreeTerm,
              privacy: fieldErrors.isAgreePrivacy,
            }}
            onClearError={(field) => clearFieldError(field)}
            onInvalid={(field, message) => showNativeValidationError(field, message)}
          />
        )}
        <div className={styles.actions}>
          <button
            type="submit"
            className={`button medium submit ${styles.submit}`}
            disabled={isLoading || isSubmitting || !profile}
          >
            회원가입 완료
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
            {popup.title ? (
              <ul>
                {popup.messages.map((message, index) => (
                  <li key={`${index}-${message}`} style={{ whiteSpace: 'pre-line' }}>
                    {message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="alert popup-error">
                <ErrorOutlineRoundedIcon />
                <span style={{ whiteSpace: 'pre-line' }}>{popup.messages.join('\n')}</span>
              </p>
            )}
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
            {popup.title ? (
              <ul>
                {popup.messages.map((message, index) => (
                  <li key={`${index}-${message}`} style={{ whiteSpace: 'pre-line' }}>
                    {message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="alert popup-error">
                <ErrorOutlineRoundedIcon />
                <span style={{ whiteSpace: 'pre-line' }}>{popup.messages.join('\n')}</span>
              </p>
            )}
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={handlePopupClose}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
