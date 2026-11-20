'use client';

import { useState } from 'react';
import { getActivityNameErrorMessage } from '@/lib/auth/emailSignUp';
import { getDisplayNameLookupKey, normalizeDisplayName } from '@/lib/users/displayName';

type ActivityNameCheckResponse = {
  isAvailable?: boolean;
  error?: string;
};

export const ACTIVITY_NAME_CHECK_REQUIRED_MESSAGE = '활동명 중복 확인을 해 주세요.';

export function useActivityNameCheck(initialCheckedName = '') {
  const [checkedName, setCheckedName] = useState(getDisplayNameLookupKey(initialCheckedName));
  const [isChecking, setIsChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  function reset(nextCheckedName = '') {
    setCheckedName(getDisplayNameLookupKey(nextCheckedName));
    setErrorMessage('');
    setSuccessMessage('');
  }

  function isChecked(value: string) {
    return Boolean(checkedName) && getDisplayNameLookupKey(value) === checkedName;
  }

  async function check(value: string) {
    const userName = normalizeDisplayName(value);
    const validationMessage = getActivityNameErrorMessage(userName);

    setCheckedName('');
    setSuccessMessage('');

    if (validationMessage) {
      setErrorMessage(validationMessage);
      return false;
    }

    setIsChecking(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/auth/activity-name?userName=${encodeURIComponent(userName)}`, {
        method: 'GET',
        credentials: 'include',
      });
      const result = (await response.json().catch(() => null)) as ActivityNameCheckResponse | null;

      if (!response.ok) {
        throw new Error(result?.error ?? '');
      }

      if (result?.isAvailable === false) {
        setErrorMessage('이미 사용 중인 활동명입니다.');
        return false;
      }

      setCheckedName(getDisplayNameLookupKey(userName));
      setSuccessMessage('사용 가능한 활동명입니다.');
      return true;
    } catch (unknownError) {
      setErrorMessage(
        unknownError instanceof Error && unknownError.message ? unknownError.message : '활동명을 확인하지 못했습니다.',
      );
      return false;
    } finally {
      setIsChecking(false);
    }
  }

  return {
    isChecking,
    errorMessage,
    successMessage,
    setErrorMessage,
    reset,
    isChecked,
    check,
  };
}
