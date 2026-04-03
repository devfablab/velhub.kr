'use client';

import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';

export default function PasswordSetup() {
  const supabase = getSupabaseBrowser();

  const [isLoading, setIsLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(true);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadPasswordStatus() {
      try {
        const response = await fetch('/api/auth/password/status', {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '비밀번호 상태를 확인하지 못했습니다.');
        }

        setHasPassword(Boolean(result.hasPassword));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '비밀번호 상태를 확인하지 못했습니다.');
        } else {
          setErrorMessage('비밀번호 상태를 확인하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPasswordStatus();
  }, []);

  async function handleSendPasswordSetupEmail() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const userResult = await supabase.auth.getUser();

      if (userResult.error) {
        throw new Error(userResult.error.message);
      }

      const authUser = userResult.data.user;

      if (!authUser?.email) {
        throw new Error('이메일 정보를 확인하지 못했습니다.');
      }

      const resetPasswordResult = await supabase.auth.resetPasswordForEmail(authUser.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetPasswordResult.error) {
        throw new Error(resetPasswordResult.error.message);
      }

      setSuccessMessage('비밀번호 설정 메일을 보냈습니다. 메일함을 확인해주세요.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '비밀번호 설정 메일 전송 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('비밀번호 설정 메일 전송 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  if (hasPassword) {
    return null;
  }

  return (
    <section>
      <h2>비밀번호 설정</h2>

      <p>비밀번호를 설정하시면 이메일 방식으로도 로그인 가능합니다.</p>
      <p>주의: 설정 이후에는 이메일 로그인 기능을 끌 수 없습니다.</p>

      <button type="button" onClick={handleSendPasswordSetupEmail} disabled={isSubmitting}>
        비밀번호 설정 메일 보내기
      </button>

      {errorMessage ? <p>{errorMessage}</p> : null}
      {successMessage ? <p>{successMessage}</p> : null}
    </section>
  );
}
