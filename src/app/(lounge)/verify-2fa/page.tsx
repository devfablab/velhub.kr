'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
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
          router.replace('/sign-in');
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
      <main>
        <h1>2단계 인증 확인</h1>
        <p>인증 정보를 확인하고 있습니다.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>2단계 인증 확인</h1>

      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="verifyCode">인증 코드</label>
          <input id="verifyCode" type="text" value={verifyCode} onChange={handleVerifyCodeChange} />
        </div>

        <button type="submit" disabled={isSubmitting}>
          확인
        </button>

        {errorMessage ? <p>{errorMessage}</p> : null}
      </form>
    </main>
  );
}
