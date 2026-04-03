'use client';

import { useEffect, useState, type JSX } from 'react';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type DefaultLoginMethod = 'email' | 'social';

export default function LoginMethod() {
  const [email, setEmail] = useState('');
  const [selectedLoginMethod, setSelectedLoginMethod] = useState<DefaultLoginMethod>('email');
  const [savedLoginMethod, setSavedLoginMethod] = useState<DefaultLoginMethod>('email');
  const [canChangeDefaultLoginMethod, setCanChangeDefaultLoginMethod] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    async function loadLoginMethod() {
      try {
        const response = await fetch('/api/auth/default-login-method', {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '기본 로그인 방식을 확인하지 못했습니다.');
        }

        setEmail(result.email ?? '');
        setSelectedLoginMethod(result.defaultLoginMethod);
        setSavedLoginMethod(result.defaultLoginMethod);
        setCanChangeDefaultLoginMethod(Boolean(result.canChangeDefaultLoginMethod));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '기본 로그인 방식을 확인하지 못했습니다.');
        } else {
          setErrorMessage('기본 로그인 방식을 확인하지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadLoginMethod();
  }, []);

  function handleLoginMethodChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value as DefaultLoginMethod;

    if (nextValue !== 'email' && nextValue !== 'social') {
      return;
    }

    setSelectedLoginMethod(nextValue);
    setSuccessMessage('');
  }

  async function handleSave() {
    if (isSubmitting || !canChangeDefaultLoginMethod) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/auth/default-login-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          defaultLoginMethod: selectedLoginMethod,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '기본 로그인 방식 변경에 실패했습니다.');
      }

      setSavedLoginMethod(result.defaultLoginMethod);
      setSuccessMessage('기본 로그인 방식이 변경되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '기본 로그인 방식 변경에 실패했습니다.');
      } else {
        setErrorMessage('기본 로그인 방식 변경에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  if (!canChangeDefaultLoginMethod) {
    return null;
  }

  return (
    <section>
      <h2>기본 로그인 방식</h2>

      {email ? <p>계정 이메일: {email}</p> : null}

      <div>
        <input
          id="defaultLoginMethodEmail"
          name="defaultLoginMethod"
          type="radio"
          value="email"
          checked={selectedLoginMethod === 'email'}
          onChange={handleLoginMethodChange}
        />
        <label htmlFor="defaultLoginMethodEmail">이메일 로그인 우선</label>
      </div>

      <div>
        <input
          id="defaultLoginMethodSocial"
          name="defaultLoginMethod"
          type="radio"
          value="social"
          checked={selectedLoginMethod === 'social'}
          onChange={handleLoginMethodChange}
        />
        <label htmlFor="defaultLoginMethodSocial">소셜 로그인 우선</label>
      </div>

      <button type="button" onClick={handleSave} disabled={isSubmitting || selectedLoginMethod === savedLoginMethod}>
        기본 로그인 방식 변경
      </button>

      {errorMessage ? <p>{errorMessage}</p> : null}
      {successMessage ? <p>{successMessage}</p> : null}
    </section>
  );
}
