'use client';

import { useState, type JSX } from 'react';
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
    <main>
      <h1>비밀번호 재설정</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email">이메일</label>
          <input id="email" type="email" autoComplete="email" value={email} onChange={handleEmailChange} />
        </div>

        <button type="submit" disabled={isSubmitting}>
          재설정 메일 보내기
        </button>

        {errorMessage ? <p>{errorMessage}</p> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </form>
    </main>
  );
}
