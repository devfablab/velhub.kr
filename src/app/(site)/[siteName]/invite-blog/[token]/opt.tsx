'use client';

import { type JSX, useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import { Box, Stack, TextField, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

export type InviteResponse = {
  ok?: boolean;
  siteName?: string;
  joinNotice?: string;
  invite?: {
    email: string;
  };
  isLoggedIn?: boolean;
  isInvitedUser?: boolean;
  isAlreadyMember?: boolean;
  error?: string;
};

type AcceptInviteResponse = {
  ok?: boolean;
  siteName?: string;
  error?: string;
};

export default function Opt({
  siteName,
  token,
  initialData,
  initialError,
}: {
  siteName: string;
  token: string;
  initialData: InviteResponse | null;
  initialError: string;
}) {
  const router = useRouter();
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedToken = normalizeText(token);
  const [inviteEmail] = useState(initialData?.invite?.email ?? '');
  const [nickname, setNickname] = useState('');
  const [isLoggedIn] = useState(Boolean(initialData?.isLoggedIn));
  const [isInvitedUser] = useState(Boolean(initialData?.isInvitedUser));
  const [isAlreadyMember] = useState(Boolean(initialData?.isAlreadyMember));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError || initialData?.error || '');

  function handleNicknameChange(event: InputChangeEvent) {
    setNickname(event.currentTarget.value);
    setErrorMessage('');
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch(
        `/api/manage/team/members/invite/${normalizedToken}?siteName=${normalizedSiteName}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            nickname,
          }),
        },
      );

      const result = (await response.json()) as AcceptInviteResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '초대 처리에 실패했습니다.1');
      }

      if (!result.siteName) {
        throw new Error('초대 처리에 실패했습니다.1');
      }

      router.replace(`/${result.siteName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '초대 처리에 실패했습니다.3');
      } else {
        setErrorMessage('초대 처리에 실패했습니다.4');
      }
      setIsSubmitting(false);
    }
  }

  if (isAlreadyMember) {
    return (
      <div className="paper">
        <Stack gap={2}>
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>이미 팀블로그에 소속된 멤버입니다!</span>
          </p>

          <Stack justifyContent="flex-end">
            <button type="button" className="button medium submit" onClick={() => router.replace(`/${siteName}`)}>
              커뮤니티로 이동
            </button>
          </Stack>

          {errorMessage ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{errorMessage}</span>
            </p>
          ) : null}
        </Stack>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="paper">
        <Stack gap={2.5}>
          <Typography variant="subtitle2">{inviteEmail}</Typography>
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>초대받은 이메일 계정으로 로그인 또는 회원가입 후 가입을 완료해주세요.</span>
          </p>
          <Stack direction="row" gap={1.5}>
            <Anchor
              className="button medium action"
              href={`/auth/sign-in?inviteToken=${token}&siteName=${siteName}&inviteType=blog`}
            >
              로그인
            </Anchor>
            <Anchor
              className="button medium action"
              href={`/auth/sign-up?inviteToken=${token}&siteName=${siteName}&inviteType=blog`}
            >
              회원가입
            </Anchor>
          </Stack>
        </Stack>

        {errorMessage ? (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        ) : null}
      </div>
    );
  }

  if (!isInvitedUser) {
    return (
      <div className="paper">
        <Stack gap={2}>
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>초대받은 계정으로 로그인해주세요.</span>
          </p>

          {errorMessage ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{errorMessage}</span>
            </p>
          ) : null}
        </Stack>
      </div>
    );
  }

  return (
    <div className="paper">
      <Box component="form" onSubmit={handleSubmit}>
        <Stack gap={2.5}>
          <Typography variant="body2">
            닉네임은 선택입니다. 입력하지 않으면 기본 활동명이 자동으로 사용됩니다.
          </Typography>

          <TextField placeholder="닉네임" value={nickname} onChange={handleNicknameChange} fullWidth size="small" />

          <Stack direction="row" justifyContent="flex-end">
            <button type="submit" className="button medium submit" disabled={isSubmitting}>
              가입하기
            </button>
          </Stack>
        </Stack>
      </Box>

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}
    </div>
  );
}
