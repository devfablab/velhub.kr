'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Container, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type TotpFactor = {
  id: string;
  status?: string;
};

export default function Page() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function initializePage() {
      try {
        const sessionResult = await supabase.auth.getSession();

        if (sessionResult.error) {
          throw new Error(sessionResult.error.message);
        }

        if (!sessionResult.data.session) {
          router.replace('/auth/sign-in');
          return;
        }

        const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (assuranceLevelResult.error) {
          throw new Error(assuranceLevelResult.error.message);
        }

        const currentLevel = assuranceLevelResult.data.currentLevel;
        const nextLevel = assuranceLevelResult.data.nextLevel;

        if (currentLevel === 'aal2') {
          router.replace('/');
          return;
        }

        if (nextLevel !== 'aal2') {
          router.replace('/');
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
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '2단계 인증 정보를 확인하지 못했습니다.');
        } else {
          setErrorMessage('2단계 인증 정보를 확인하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void initializePage();
  }, [router, supabase]);

  function handleVerifyCodeChange(event: InputChangeEvent) {
    setVerifyCode(event.currentTarget.value.trim());
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!factorId) {
      setErrorMessage('2단계 인증 정보를 찾지 못했습니다.');
      return;
    }

    if (!verifyCode) {
      setErrorMessage('인증 코드를 입력해주세요.');
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

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '2단계 인증 확인에 실패했습니다.');
      } else {
        setErrorMessage('2단계 인증 확인에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ py: 8 }}>
          <Stack spacing={4}>
            <Typography variant="h4" component="h1">
              2단계 인증 확인
            </Typography>

            <Paper elevation={0} sx={{ p: 3 }}>
              <Typography>인증 정보를 확인하고 있습니다.</Typography>
            </Paper>
          </Stack>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack spacing={4}>
          <Typography variant="h4" component="h1">
            2단계 인증 확인
          </Typography>

          <Paper elevation={0} sx={{ p: 3 }}>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  label="인증 코드"
                  type="text"
                  value={verifyCode}
                  onChange={handleVerifyCodeChange}
                  fullWidth
                />

                <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <Button type="submit" variant="contained" disabled={isSubmitting} size="large">
                    확인
                  </Button>

                  <Link href="/" sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
                    라운지로 이동
                  </Link>
                </Box>

                {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Box>
    </Container>
  );
}
