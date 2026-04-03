'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase';

export default function LogoutActions() {
  const router = useRouter();
  const supabase = getSupabaseBrowser();

  const [errorMessage, setErrorMessage] = useState('');
  const [isLoggingOutCurrentDevice, setIsLoggingOutCurrentDevice] = useState(false);
  const [isLoggingOutAllDevices, setIsLoggingOutAllDevices] = useState(false);

  async function handleLogoutCurrentDevice() {
    if (isLoggingOutCurrentDevice || isLoggingOutAllDevices) {
      return;
    }

    setErrorMessage('');
    setIsLoggingOutCurrentDevice(true);

    try {
      const signOutResult = await supabase.auth.signOut({
        scope: 'local',
      });

      if (signOutResult.error) {
        throw new Error(signOutResult.error.message);
      }

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '이 디바이스 로그아웃 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('이 디바이스 로그아웃 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoggingOutCurrentDevice(false);
    }
  }

  async function handleLogoutAllDevices() {
    if (isLoggingOutCurrentDevice || isLoggingOutAllDevices) {
      return;
    }

    const isConfirmed = window.confirm('모든 디바이스에서 로그아웃하시겠어요?');

    if (!isConfirmed) {
      return;
    }

    setErrorMessage('');
    setIsLoggingOutAllDevices(true);

    try {
      const signOutResult = await supabase.auth.signOut({
        scope: 'global',
      });

      if (signOutResult.error) {
        throw new Error(signOutResult.error.message);
      }

      router.replace('/');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '모든 디바이스 로그아웃 중 오류가 발생했습니다.');
      } else {
        setErrorMessage('모든 디바이스 로그아웃 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoggingOutAllDevices(false);
    }
  }

  return (
    <section>
      <h2>로그아웃</h2>

      <button
        type="button"
        onClick={handleLogoutCurrentDevice}
        disabled={isLoggingOutCurrentDevice || isLoggingOutAllDevices}
      >
        이 디바이스에서 로그아웃
      </button>

      <button
        type="button"
        onClick={handleLogoutAllDevices}
        disabled={isLoggingOutCurrentDevice || isLoggingOutAllDevices}
      >
        모든 디바이스 로그아웃
      </button>

      {errorMessage ? <p>{errorMessage}</p> : null}
    </section>
  );
}
