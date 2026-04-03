'use client';

import { useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowser } from '@/lib/supabase';
import HCaptchaBox from './hCaptcha';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type SignInDecision = 'idle' | 'confirm-enable-email-login' | 'confirm-email-login';

export default function EmailSignIn() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [isCaptchaRequired, setIsCaptchaRequired] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [decisionMessage, setDecisionMessage] = useState('');
  const [decisionState, setDecisionState] = useState<SignInDecision>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleEmailChange(event: InputChangeEvent) {
    setEmail(event.currentTarget.value);
  }

  function handlePasswordChange(event: InputChangeEvent) {
    setPassword(event.currentTarget.value);
  }

  async function runSignIn(trimmedEmail: string) {
    const signInResponse = await fetch('/api/auth/email/sign-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        email: trimmedEmail,
        password,
        captchaToken: captchaToken || null,
      }),
    });

    const signInResult = await signInResponse.json();

    if (!signInResponse.ok) {
      setIsCaptchaRequired(Boolean(signInResult.captchaRequired));

      if (Boolean(signInResult.captchaRequired)) {
        setCaptchaResetKey((previousValue) => previousValue + 1);
      }

      throw new Error(signInResult.error ?? '로그인 중 오류가 발생했습니다.');
    }

    const setSessionResult = await supabase.auth.setSession({
      access_token: signInResult.accessToken,
      refresh_token: signInResult.refreshToken,
    });

    if (setSessionResult.error) {
      throw new Error(setSessionResult.error.message);
    }

    const assuranceLevelResult = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (assuranceLevelResult.error) {
      throw new Error(assuranceLevelResult.error.message);
    }

    const currentLevel = assuranceLevelResult.data.currentLevel;
    const nextLevel = assuranceLevelResult.data.nextLevel;

    if (currentLevel !== 'aal2' && nextLevel === 'aal2') {
      router.replace('/verify-2fa');
      return;
    }

    router.replace('/');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }

    if (!password) {
      setErrorMessage('비밀번호를 입력해주세요.');
      return;
    }

    if (isCaptchaRequired && !captchaToken) {
      setErrorMessage('hCaptcha 확인을 진행해주세요.');
      return;
    }

    setErrorMessage('');
    setDecisionMessage('');
    setDecisionState('idle');
    setIsSubmitting(true);

    try {
      const checkResponse = await fetch('/api/auth/email/sign-in/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: trimmedEmail,
        }),
      });

      const checkResult = await checkResponse.json();

      if (!checkResponse.ok) {
        throw new Error(checkResult.error ?? '계정 정보를 확인하지 못했습니다.');
      }

      if (checkResult.accountType === 'social' && checkResult.hasPassword === false) {
        setDecisionState('confirm-enable-email-login');
        setDecisionMessage(
          '이 계정은 소셜 로그인으로 가입되어 있습니다. 이메일 로그인도 사용할 수 있도록 비밀번호 설정 메일을 보내시겠습니까?',
        );
        setIsSubmitting(false);
        return;
      }

      if (checkResult.accountType === 'social' && checkResult.hasPassword === true) {
        setDecisionState('confirm-email-login');
        setDecisionMessage('이미 소셜 로그인으로 가입한 계정입니다. 그래도 이메일로 로그인하시겠습니까?');
        setIsSubmitting(false);
        return;
      }

      await runSignIn(trimmedEmail);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '로그인 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('로그인 중 오류가 발생했습니다.');
      }
      setIsSubmitting(false);
    }
  }

  async function handleConfirmEnableEmailLogin() {
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const resetPasswordResult = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetPasswordResult.error) {
        throw new Error(resetPasswordResult.error.message);
      }

      setDecisionState('idle');
      setDecisionMessage(
        '비밀번호 설정 메일을 보냈습니다. 메일에서 비밀번호를 설정한 뒤 이메일 로그인하실 수 있습니다.',
      );
      setIsSubmitting(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '처리 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('처리 중 오류가 발생했습니다.');
      }
      setIsSubmitting(false);
    }
  }

  async function handleConfirmEmailLogin() {
    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setErrorMessage('이메일을 입력해주세요.');
      return;
    }

    if (!password) {
      setErrorMessage('비밀번호를 입력해주세요.');
      return;
    }

    if (isCaptchaRequired && !captchaToken) {
      setErrorMessage('hCaptcha 확인을 진행해주세요.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      await runSignIn(trimmedEmail);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '로그인 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('로그인 중 오류가 발생했습니다.');
      }
      setIsSubmitting(false);
    }
  }

  function handleCancelDecision() {
    setDecisionState('idle');
    setDecisionMessage('');
  }

  return (
    <form onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email">이메일</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={handleEmailChange} />
      </div>

      <div>
        <label htmlFor="password">비밀번호</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={handlePasswordChange}
        />
      </div>

      {isCaptchaRequired ? (
        <div>
          <p>로그인 실패가 누적되어 hCaptcha 확인이 필요합니다.</p>
          <HCaptchaBox onTokenChange={setCaptchaToken} resetKey={captchaResetKey} />
        </div>
      ) : null}

      {decisionState === 'confirm-enable-email-login' ? (
        <div>
          <p>{decisionMessage}</p>
          <button type="button" onClick={handleConfirmEnableEmailLogin} disabled={isSubmitting}>
            비밀번호 설정 메일 보내기
          </button>
          <button type="button" onClick={handleCancelDecision} disabled={isSubmitting}>
            취소
          </button>
        </div>
      ) : null}

      {decisionState === 'confirm-email-login' ? (
        <div>
          <p>{decisionMessage}</p>
          <button type="button" onClick={handleConfirmEmailLogin} disabled={isSubmitting}>
            이메일 로그인
          </button>
          <button type="button" onClick={handleCancelDecision} disabled={isSubmitting}>
            취소
          </button>
        </div>
      ) : null}

      {decisionState === 'idle' ? (
        <button type="submit" disabled={isSubmitting}>
          로그인
        </button>
      ) : null}

      {errorMessage ? <p>{errorMessage}</p> : null}
      {decisionState === 'idle' && decisionMessage ? <p>{decisionMessage}</p> : null}
    </form>
  );
}
