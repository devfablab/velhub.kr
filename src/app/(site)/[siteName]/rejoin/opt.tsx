'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Stack } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

type Props = {
  siteName: string;
};

type RejoinMode = 'restore' | 'reset';

type RejoinResponse = {
  ok?: boolean;
  error?: string;
};

export default function Opt({ siteName }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleRejoin(mode: RejoinMode) {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(`/api/users/${siteName}/[userId]/rejoin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          mode,
        }),
      });

      const result = (await response.json()) as RejoinResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '재가입에 실패했습니다.');
      }

      router.replace(`/${siteName}`);
      router.refresh();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '재가입에 실패했습니다.');
      } else {
        setErrorMessage('재가입에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Stack gap={2.5}>
      <p className="alert info">
        <InfoOutlineRoundedIcon />
        <span>재가입할 때 탈퇴 전에 작성한 글과 댓글을 복구할 수 있습니다.</span>
      </p>
      <p className="alert warning">
        <WarningAmberRoundedIcon />
        <span>
          초기화 후 재가입하면 기존 글과 댓글, 해당 글에 첨부한 이미지 파일이 모두 영구 삭제되며 복구할 수 없습니다.
        </span>
      </p>

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      <Stack direction="row" gap={2} justifyContent="flex-end">
        <button
          type="button"
          className="button medium action"
          onClick={() => void handleRejoin('restore')}
          disabled={isSubmitting}
        >
          복구 후 재가입하기
        </button>
        <button
          type="button"
          className="button medium action"
          onClick={() => void handleRejoin('reset')}
          disabled={isSubmitting}
        >
          초기화 후 재가입하기
        </button>
      </Stack>
    </Stack>
  );
}
