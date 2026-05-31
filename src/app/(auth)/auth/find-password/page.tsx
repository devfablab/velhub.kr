'use client';

import { useState, type JSX } from 'react';
import { Box, Stack, TextField } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import Anchor from '@/components/Anchor';
import { getSupabaseBrowser } from '@/lib/supabase';
import Container from '../container';
import styles from '@/app/auth.module.sass';

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
    <Container>
      <Box component="form" onSubmit={handleSubmit}>
        <Stack gap={1}>
          <TextField
            placeholder="이메일"
            type="email"
            autoComplete="email"
            value={email}
            onChange={handleEmailChange}
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

          {errorMessage ? (
            <p className={`alert error ${styles.alert}`}>
              <ErrorOutlineRoundedIcon />
              <span>{errorMessage}</span>
            </p>
          ) : null}
        </Stack>
      </Box>
    </Container>
  );
}
