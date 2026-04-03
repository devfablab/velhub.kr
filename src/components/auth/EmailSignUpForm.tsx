'use client';

import { useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

export default function EmailSignUpForm() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [userName, setUserName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleUserNameChange(event: InputChangeEvent) {
    setUserName(event.currentTarget.value);
  }

  function handleEmailChange(event: InputChangeEvent) {
    setEmail(event.currentTarget.value);
  }

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

    const trimmedUserName = userName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUserName) {
      setErrorMessage('이름을 입력해주세요.');
      return;
    }

    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }

    if (!password) {
      setErrorMessage('비밀번호를 입력해주세요.');
      return;
    }

    if (!passwordConfirm) {
      setErrorMessage('비밀번호 확인을 입력해주세요.');
      return;
    }

    if (password !== passwordConfirm) {
      setErrorMessage('비밀번호가 일치하지 않습니다.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const signUpResult = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpResult.error) {
        throw new Error(signUpResult.error.message);
      }

      const authUser = signUpResult.data.user;

      if (!authUser) {
        throw new Error('회원 정보를 가져오지 못했습니다.');
      }

      const saveResponse = await fetch('/api/auth/email/sign-up', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          authUserId: authUser.id,
          email: authUser.email ?? trimmedEmail,
          userName: trimmedUserName,
        }),
      });

      const saveResult = await saveResponse.json();

      if (!saveResponse.ok) {
        throw new Error(saveResult.error ?? '회원가입 저장 처리에 실패했습니다.');
      }

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '회원가입 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('회원가입 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">이메일</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={handleEmailChange} />
      </div>

      <div>
        <label htmlFor="userName">활동명</label>
        <input id="userName" type="text" autoComplete="nickname" value={userName} onChange={handleUserNameChange} />
      </div>

      <div>
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={handlePasswordChange}
        />
      </div>

      <div>
        <label htmlFor="passwordConfirm">비밀번호 확인</label>
        <input
          id="passwordConfirm"
          type="password"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={handlePasswordConfirmChange}
        />
      </div>

      <button type="submit" disabled={isSubmitting}>
        시작하기
      </button>

      {errorMessage ? <p>{errorMessage}</p> : null}
    </form>
  );
}
