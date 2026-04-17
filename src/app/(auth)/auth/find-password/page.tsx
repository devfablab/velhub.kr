'use client';

import { useState, type JSX } from 'react';
import { Alert, Box, Button, Container, Link, Paper, Stack, TextField, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import { getSupabaseBrowser } from '@/lib/supabase';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

export default function Page() {
  const supabase = getSupabaseBrowser();

  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleEmailChange(event: InputChangeEvent) {
    setEmail(event.currentTarget.value);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const currentOrigin = window.location.origin;

      const resetPasswordResult = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${currentOrigin}/reset-password`,
      });

      if (resetPasswordResult.error) {
        throw new Error(resetPasswordResult.error.message);
      }

      setSuccessMessage('비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.');
      setEmail('');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '비밀번호 재설정 메일 요청 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('비밀번호 재설정 메일 요청 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Stack spacing={4}>
          <Typography variant="h4" component="h1">
            비밀번호 재설정
          </Typography>

          <Paper elevation={0} sx={{ p: 3 }}>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <TextField
                  label="이메일"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={handleEmailChange}
                  fullWidth
                />

                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Anchor href="/auth/sign-in">로그인으로 돌아가기</Anchor>
                </Box>

                <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                  <Button type="submit" variant="contained" disabled={isSubmitting} size="large">
                    재설정 메일 보내기
                  </Button>
                  <Link href="/" sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)' }}>
                    라운지로 이동
                  </Link>
                </Box>

                {errorMessage ? (
                  <Alert severity="error" variant="filled">
                    {errorMessage}
                  </Alert>
                ) : null}
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Box>
    </Container>
  );
}
