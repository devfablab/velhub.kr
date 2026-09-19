'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FormControlLabel, FormLabel, Stack } from '@mui/material';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PopupMessage from '@/components/PopupMessage';
import styles from '@/app/settings.module.sass';

type AdvancedUserResponse = {
  profile?: {
    auto_login: boolean;
  };
  error?: string;
};

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: AdvancedUserResponse | null;
  initialError: string;
}) {
  const router = useRouter();

  const [isLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoLogin, setAutoLogin] = useState(initialData?.profile?.auto_login ?? true);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [successMessage, setSuccessMessage] = useState('');

  function handleAutoLoginChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAutoLogin(event.currentTarget.checked);
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setSuccessMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/info/advanced/user/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          auto_login: autoLogin,
        }),
      });

      const result = (await response.json()) as AdvancedUserResponse;

      if (response.status === 401) {
        router.replace('/');
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? '추가 설정 수정에 실패했습니다.');
      }

      setSuccessMessage('설정 수정에 성공했습니다');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '추가 설정 수정에 실패했습니다.');
      } else {
        setErrorMessage('추가 설정 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className={`paper ${styles.paper}`}>
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className={`paper ${styles.paper}`}>
      <Stack gap={1}>
        <FormLabel>자동 로그인</FormLabel>
        <FormControlLabel
          control={<IOSSwitch sx={{ m: 1 }} checked={autoLogin} onChange={handleAutoLoginChange} />}
          label={autoLogin ? '사용함 (7일 로그인유지)' : '사용 안함 (24시간 로그인유지)'}
        />
      </Stack>

      <button type="button" className="button medium submit" onClick={handleSubmit} disabled={isSubmitting}>
        수정 완료
      </button>

      <PopupMessage
        open={Boolean(errorMessage)}
        message={errorMessage}
        onClose={() => setErrorMessage('')}
        kind="error"
      />

      <PopupMessage open={Boolean(successMessage)} message={successMessage} onClose={() => setSuccessMessage('')} />
    </div>
  );
}
