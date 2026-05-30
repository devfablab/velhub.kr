'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
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
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
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
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function initialize() {
      try {
        const sessionResult = await supabase.auth.getSession();

        if (sessionResult.error || !sessionResult.data.session) {
          router.replace('/auth/sign-in');
          return;
        }

        const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (assuranceLevelResult.error) {
          throw new Error(assuranceLevelResult.error.message);
        }

        if (assuranceLevelResult.data.currentLevel === 'aal2') {
          router.refresh();
          return;
        }

        const factorsResult = await supabase.auth.mfa.listFactors();

        if (factorsResult.error) {
          throw new Error(factorsResult.error.message);
        }

        const verifiedTotpFactor = ((factorsResult.data.totp ?? []) as TotpFactor[]).find(
          (factor) => factor.status === 'verified',
        );

        if (!verifiedTotpFactor) {
          throw new Error('설정된 앱 기반 2단계 인증 정보를 찾지 못했습니다.');
        }

        setFactorId(verifiedTotpFactor.id);
      } catch (error) {
        if (error instanceof Error) {
          setErrorMessage(error.message);
        } else {
          setErrorMessage('2단계 인증 정보를 확인하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void initialize();
  }, [router, supabase]);

  function handleVerifyCodeChange(event: InputChangeEvent) {
    setVerifyCode(event.target.value.trim());
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting || !factorId || !verifyCode) {
      if (!verifyCode) setErrorMessage('인증 코드를 입력해주세요.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const challengeAndVerifyResult = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: verifyCode,
      });

      if (challengeAndVerifyResult.error) {
        throw new Error('인증 코드가 올바르지 않습니다.');
      }

      router.refresh();
    } catch (error) {
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('2단계 인증 확인에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  const content = (mq: string) => (
    <Box component="form" onSubmit={handleSubmit}>
      {mq === 'mobile' ? (
        <Stack gap={2} sx={{ pt: 1 }}>
          <Typography variant="body1">보안을 위해 2단계 인증 코드를 입력해 주세요.</Typography>

          <Stack gap={1}>
            <Typography variant="subtitle2">인증 코드</Typography>
            <TextField
              placeholder="XXXXXX"
              type="text"
              value={verifyCode}
              onChange={handleVerifyCodeChange}
              disabled={isLoading || isSubmitting}
              fullWidth
              autoComplete="off"
            />
          </Stack>
          {errorMessage ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{errorMessage}</span>
            </p>
          ) : null}

          <Stack direction="column" gap={1.5}>
            <button type="button" className="button medium cancel" onClick={handleSignOut} disabled={isSubmitting}>
              로그아웃
            </button>
            <button type="submit" className="button medium submit" disabled={isLoading || isSubmitting || !factorId}>
              확인
            </button>
          </Stack>
        </Stack>
      ) : (
        <>
          <DialogContent>
            <Typography variant="body1">보안을 위해 2단계 인증 코드를 입력해 주세요.</Typography>
            <Stack gap={1}>
              <Typography variant="subtitle2">인증 코드</Typography>
              <TextField
                placeholder="XXXXXX"
                type="text"
                value={verifyCode}
                onChange={handleVerifyCodeChange}
                disabled={isLoading || isSubmitting}
                fullWidth
                autoComplete="off"
              />
            </Stack>
            {errorMessage ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{errorMessage}</span>
              </p>
            ) : null}
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={handleSignOut} disabled={isSubmitting}>
              로그아웃
            </button>
            <button type="submit" className="button medium submit" disabled={isLoading || isSubmitting || !factorId}>
              확인
            </button>
          </DialogActions>
        </>
      )}
    </Box>
  );

  return (
    <>
      {isMobile ? (
        <Drawer anchor="bottom" open={true} className="VhiDrawer-bottom">
          <h2>2단계 인증</h2>
          {content('mobile')}
        </Drawer>
      ) : (
        <Dialog open={true} fullWidth maxWidth="xs" className="VhiDialog">
          <DialogTitle>2단계 인증</DialogTitle>
          {content('desktop')}
        </Dialog>
      )}
    </>
  );
}
