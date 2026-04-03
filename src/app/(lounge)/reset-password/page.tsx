'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

export default function Page() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecoveryReady, setIsRecoveryReady] = useState(false);

  useEffect(() => {
    async function initializeRecoverySession() {
      const hash = window.location.hash;
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));

      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');

      if (type !== 'recovery' || !accessToken || !refreshToken) {
        setErrorMessage('유효하지 않은 비밀번호 재설정 링크입니다.');
        return;
      }

      const sessionResult = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionResult.error) {
        setErrorMessage('비밀번호 재설정 세션을 확인하지 못했습니다.');
        return;
      }

      setIsRecoveryReady(true);
      window.history.replaceState(null, '', window.location.pathname);
    }

    void initializeRecoverySession();
  }, [supabase]);

  function handlePasswordChange(event: InputChangeEvent) {
    setPassword(event.currentTarget.value);
  }

  function handlePasswordConfirmChange(event: InputChangeEvent) {
    setPasswordConfirm(event.currentTarget.value);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!isRecoveryReady) {
      setErrorMessage('비밀번호 재설정 세션이 준비되지 않았습니다.');
      return;
    }

    if (!password) {
      setErrorMessage('새 비밀번호를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!passwordConfirm) {
      setErrorMessage('새 비밀번호 확인을 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호가 일치하지 않습니다.');
      setSuccessMessage('');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const updateUserResult = await supabase.auth.updateUser({
        password,
      });

      if (updateUserResult.error) {
        throw new Error(updateUserResult.error.message);
      }

      setSuccessMessage('비밀번호가 재설정되었습니다. 로그인 페이지로 이동합니다.');

      window.setTimeout(() => {
        router.replace('/sign-in');
      }, 1000);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '비밀번호 재설정 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('비밀번호 재설정 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <h1>새 비밀번호 설정</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="password">새 비밀번호</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={handlePasswordChange}
          />
        </div>

        <div>
          <label htmlFor="passwordConfirm">새 비밀번호 확인</label>
          <input
            id="passwordConfirm"
            type="password"
            autoComplete="new-password"
            value={passwordConfirm}
            onChange={handlePasswordConfirmChange}
          />
        </div>

        <button type="submit" disabled={isSubmitting || !isRecoveryReady}>
          비밀번호 재설정
        </button>

        {errorMessage ? <p>{errorMessage}</p> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </form>
    </main>
  );
}
