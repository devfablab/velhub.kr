'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

export default function PasswordChange() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [isLoading, setIsLoading] = useState(true);
  const [hasPassword, setHasPassword] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
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

  function handleCurrentPasswordChange(event: InputChangeEvent) {
    setCurrentPassword(event.currentTarget.value);
  }

  function handleNextPasswordChange(event: InputChangeEvent) {
    setNextPassword(event.currentTarget.value);
  }

  function handleNextPasswordConfirmChange(event: InputChangeEvent) {
    setNextPasswordConfirm(event.currentTarget.value);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!currentPassword) {
      setErrorMessage('현재 비밀번호를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!nextPassword) {
      setErrorMessage('새 비밀번호를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!nextPasswordConfirm) {
      setErrorMessage('새 비밀번호 확인을 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (nextPassword !== nextPasswordConfirm) {
      setErrorMessage('새 비밀번호가 일치하지 않습니다.');
      setSuccessMessage('');
      return;
    }

    if (currentPassword === nextPassword) {
      setErrorMessage('현재 비밀번호와 다른 비밀번호를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const sessionResult = await supabase.auth.getSession();

      if (sessionResult.error) {
        throw new Error(sessionResult.error.message);
      }

      const authSession = sessionResult.data.session;

      if (!authSession?.user?.email) {
        throw new Error('로그인 정보를 확인하지 못했습니다.');
      }

      const signInResult = await supabase.auth.signInWithPassword({
        email: authSession.user.email,
        password: currentPassword,
      });

      if (signInResult.error) {
        throw new Error('현재 비밀번호가 올바르지 않습니다.');
      }

      const updateUserResult = await supabase.auth.updateUser({
        password: nextPassword,
      });

      if (updateUserResult.error) {
        throw new Error(updateUserResult.error.message);
      }

      const signOutResult = await supabase.auth.signOut({
        scope: 'local',
      });

      if (signOutResult.error) {
        throw new Error(signOutResult.error.message);
      }

      setCurrentPassword('');
      setNextPassword('');
      setNextPasswordConfirm('');
      setSuccessMessage('비밀번호가 변경되어 로그아웃되었습니다.');

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '비밀번호 변경 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('비밀번호 변경 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  if (!hasPassword) {
    return null;
  }

  return (
    <section>
      <h2>비밀번호 변경</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="currentPassword">현재 비밀번호</label>
          <input
            id="currentPassword"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={handleCurrentPasswordChange}
          />
        </div>

        <div>
          <label htmlFor="nextPassword">새 비밀번호</label>
          <input
            id="nextPassword"
            type="password"
            autoComplete="new-password"
            value={nextPassword}
            onChange={handleNextPasswordChange}
          />
        </div>

        <div>
          <label htmlFor="nextPasswordConfirm">새 비밀번호 확인</label>
          <input
            id="nextPasswordConfirm"
            type="password"
            autoComplete="new-password"
            value={nextPasswordConfirm}
            onChange={handleNextPasswordConfirmChange}
          />
        </div>

        <button type="submit" disabled={isSubmitting}>
          비밀번호 변경
        </button>

        <p>비밀번호 변경시 자동으로 로그아웃됩니다.</p>

        {errorMessage ? <p>{errorMessage}</p> : null}
        {successMessage ? <p>{successMessage}</p> : null}
      </form>
    </section>
  );
}
