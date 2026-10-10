'use client';

import { type JSX, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type TotpFactor = {
  id: string;
  status?: string;
};

export default function Verify2fa() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  const verifyCodeInputRef = useRef<HTMLInputElement | null>(null);
  const submitTimeoutRef = useRef<number | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [errorMessages, setErrorMessages] = useState<string[]>([]);
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    async function initialize() {
      try {
        const sessionResult = await supabase.auth.getSession();

        if (sessionResult.error || !sessionResult.data.session) {
          router.replace('/auth/sign-in');
          return;
        }

        const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (assuranceLevelResult.error) throw new Error('2단계 인증 정보를 확인하지 못했습니다.');

        if (assuranceLevelResult.data.currentLevel === 'aal2') {
          router.refresh();
          return;
        }

        const factorsResult = await supabase.auth.mfa.listFactors();

        if (factorsResult.error) throw new Error('2단계 인증 정보를 확인하지 못했습니다.');

        const verifiedTotpFactor = ((factorsResult.data.totp ?? []) as TotpFactor[]).find(
          (factor) => factor.status === 'verified',
        );

        if (!verifiedTotpFactor) {
          throw new Error('설정된 앱 기반 2단계 인증 정보를 찾지 못했습니다.');
        }

        setFactorId(verifiedTotpFactor.id);
      } catch (error) {
        if (error instanceof Error) {
          setErrorMessages([error.message]);
        } else {
          setErrorMessages(['2단계 인증 정보를 확인하지 못했습니다.']);
        }
      } finally {
        setIsLoading(false);
      }
    }

    void initialize();
  }, [router, supabase]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const focusTimeoutId = window.setTimeout(() => {
      verifyCodeInputRef.current?.focus();
    }, 100);

    return () => {
      window.clearTimeout(focusTimeoutId);
    };
  }, [isLoading]);

  useEffect(() => {
    return () => {
      if (submitTimeoutRef.current) {
        window.clearTimeout(submitTimeoutRef.current);
      }
    };
  }, []);

  function handleVerifyCodeChange(event: InputChangeEvent) {
    const nextVerifyCode = event.target.value.replace(/\D/g, '').slice(0, 6);

    setVerifyCode(nextVerifyCode);
    setFieldError('');
    setErrorMessages([]);

    if (submitTimeoutRef.current) {
      window.clearTimeout(submitTimeoutRef.current);
      submitTimeoutRef.current = null;
    }

    if (nextVerifyCode.length !== 6 || isSubmitting) {
      return;
    }

    const form = event.target.form;

    if (!form) {
      return;
    }

    submitTimeoutRef.current = window.setTimeout(() => {
      form.requestSubmit();
    }, 0);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) return;

    if (!factorId) {
      setErrorMessages(['설정된 2단계 인증 정보를 찾지 못했습니다.']);
      return;
    }

    if (!/^\d{6}$/.test(verifyCode)) {
      const message = '인증 코드는 숫자 6자리로 입력해 주세요.';
      setFieldError(message);
      setErrorMessages([message]);
      return;
    }

    setErrorMessages([]);
    setFieldError('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/mfa/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ factorId, code: verifyCode }),
      });
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean;
        errors?: string[];
        fieldError?: string;
      } | null;

      if (!response.ok || !result?.ok) {
        setErrorMessages(
          result?.errors?.length ? result.errors : ['2단계 인증 확인에 실패했습니다.\n잠시 후 다시 시도해 주세요.'],
        );
        setFieldError(result?.fieldError ?? '');
        setVerifyCode('');
        return;
      }

      const returnPath = sessionStorage.getItem('auth:after-mfa') || sessionStorage.getItem('route:returnPath') || '/';
      sessionStorage.removeItem('auth:after-mfa');
      router.replace(returnPath);
      router.refresh();
    } catch {
      setErrorMessages(['2단계 인증 확인에 실패했습니다.\n인터넷 연결을 확인한 뒤 다시 시도해 주세요.']);
      setVerifyCode('');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    const result = await supabase.auth.signOut();

    if (result.error) {
      setErrorMessages(['로그아웃하지 못했습니다.\n잠시 후 다시 시도해 주세요.']);
      return;
    }

    router.replace('/');
  }

  const content = (
    <>
      <Typography variant="body1">보안을 위해 2단계 인증 코드를 입력해 주세요.</Typography>
      <Stack sx={{ pt: 2 }}>
        <Typography variant="subtitle2">인증 코드</Typography>
        <TextField
          inputRef={verifyCodeInputRef}
          placeholder="XXXXXX"
          type="text"
          value={verifyCode}
          onChange={handleVerifyCodeChange}
          onInvalid={(event) => {
            event.preventDefault();
            const message = '인증 코드는 숫자 6자리로 입력해 주세요.';
            setFieldError(message);
            setErrorMessages([message]);
          }}
          error={Boolean(fieldError)}
          helperText={fieldError || '인증 앱의 코드 또는 이메일로 받은 복구 코드를 입력해 주세요.'}
          disabled={isLoading || isSubmitting}
          fullWidth
          autoComplete="one-time-code"
          size="small"
          slotProps={{
            htmlInput: {
              inputMode: 'numeric',
              pattern: '[0-9]{6}',
              minLength: 6,
              maxLength: 6,
              required: true,
            },
          }}
        />
      </Stack>
      {errorMessages.length > 0 ? (
        <ul>
          {errorMessages.map((message, index) => (
            <li key={`${index}-${message}`} style={{ whiteSpace: 'pre-line' }}>
              {message}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );

  return (
    <>
      {isMobile ? (
        <Drawer anchor="bottom" open={true} className="VhiDrawer-bottom VhiDrawer-bottom-service">
          <h2>2단계 인증</h2>
          <button className="close-button" onClick={handleSignOut} aria-label="닫기" disabled={isSubmitting}>
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <Box id="verify-2fa-form" component="form" onSubmit={handleSubmit}>
              {content}
            </Box>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={handleSignOut} disabled={isSubmitting}>
              로그아웃
            </button>
            <button
              type="submit"
              form="verify-2fa-form"
              className="button medium submit"
              disabled={isLoading || isSubmitting || !factorId}
            >
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog open={true} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
          <DialogTitle>2단계 인증</DialogTitle>
          <button className="close-button" onClick={handleSignOut} aria-label="닫기" disabled={isSubmitting}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Box id="verify-2fa-dialog-form" component="form" onSubmit={handleSubmit}>
              {content}
            </Box>
          </DialogContent>
          <DialogActions>
            <button type="button" className="cancel-button" onClick={handleSignOut} disabled={isSubmitting}>
              로그아웃
            </button>
            <button type="submit" form="verify-2fa-dialog-form" disabled={isLoading || isSubmitting || !factorId}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
