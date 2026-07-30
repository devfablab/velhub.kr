'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Box, Stack, TextField } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { getSupabaseBrowser } from '@/lib/supabase';
import { SignupAgreementFields, useSignupAgreements } from '@/components/auth/SignupAgreements';
import styles from '@/app/auth.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type SocialProfile = {
  authUserId: string;
  email: string;
  provider: string;
  providerAccountId: string | null;
  userName: string;
  avatar: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
};

function getDefaultUserName(value: unknown, email: string) {
  const name = typeof value === 'string' ? value.trim() : '';

  return name || email.split('@')[0]?.trim() || '';
}

export default function Opt() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();
  const { canSubmit, isAgreeTerm, isAgreeChild, isAgreePrivacy } = useSignupAgreements();
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [userName, setUserName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasLoadedProfile = useRef(false);

  useEffect(() => {
    if (hasLoadedProfile.current) {
      return;
    }

    hasLoadedProfile.current = true;

    async function loadProfile() {
      try {
        const sessionResult = await supabase.auth.getSession();

        if (sessionResult.error || !sessionResult.data.session) {
          router.replace('/auth/sign-in');
          return;
        }

        const userResult = await supabase.auth.getUser();

        if (userResult.error || !userResult.data.user) {
          router.replace('/auth/sign-in');
          return;
        }

        const authUser = userResult.data.user;
        const metadata = authUser.user_metadata ?? {};
        const metadataProvider = typeof metadata.provider === 'string' ? metadata.provider.trim() : '';
        const provider =
          metadataProvider === 'naver'
            ? metadataProvider
            : String(authUser.identities?.[0]?.provider ?? authUser.app_metadata?.provider ?? metadataProvider).trim();

        if (!provider || !authUser.email) {
          throw new Error('소셜 로그인 정보를 확인하지 못했습니다.');
        }

        const providerAccountId =
          provider === 'naver'
            ? (typeof metadata.naver_id === 'string' ? metadata.naver_id : null)
            : (authUser.identities?.[0]?.id ?? (typeof metadata.sub === 'string' ? metadata.sub : null));
        const initialUserName = getDefaultUserName(
          metadata.name ?? metadata.full_name ?? metadata.user_name ?? metadata.preferred_username,
          authUser.email,
        );

        setUserName(initialUserName);
        setProfile({
          authUserId: authUser.id,
          email: authUser.email,
          provider,
          providerAccountId,
          userName: initialUserName,
          avatar:
            (typeof metadata.avatar_url === 'string' ? metadata.avatar_url : null) ??
            (typeof metadata.picture === 'string' ? metadata.picture : null) ??
            (typeof metadata.avatar === 'string' ? metadata.avatar : null),
          accessToken: sessionResult.data.session.provider_token ?? null,
          refreshToken: sessionResult.data.session.provider_refresh_token ?? null,
          tokenExpiresAt: sessionResult.data.session.expires_at ?? null,
        });
      } catch (unknownError) {
        setErrorMessage(unknownError instanceof Error ? unknownError.message : '소셜 로그인 정보를 확인하지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadProfile();
  }, [router, supabase]);

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    const normalizedUserName = userName.trim();

    if (!normalizedUserName) {
      setErrorMessage('활동명을 입력해주세요.');
      return;
    }

    if (!canSubmit) {
      setErrorMessage('필수 동의 항목에 모두 동의해 주세요.');
      return;
    }

    if (!profile || isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/auth/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...profile,
          userName: normalizedUserName,
          isAgreeTerm,
          isAgreeChild,
          isAgreePrivacy,
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? '회원가입을 완료하지 못했습니다.');
      }

      router.replace('/');
    } catch (unknownError) {
      setErrorMessage(unknownError instanceof Error ? unknownError.message : '회원가입을 완료하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <Stack gap={1}>
        {isLoading ? <p>소셜 로그인 정보를 확인하고 있습니다.</p> : null}
        <TextField
          placeholder="활동명"
          autoComplete="nickname"
          value={userName}
          onChange={(event) => setUserName(event.currentTarget.value)}
          fullWidth
          size="small"
          disabled={isLoading || isSubmitting}
        />
        {isLoading ? null : <SignupAgreementFields />}
        <div className={styles.actions}>
          <button
            type="submit"
            className={`button medium submit ${styles.submit}`}
            disabled={isLoading || isSubmitting || !profile}
          >
            회원가입 완료
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
  );
}
