'use client';

import { useEffect, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, Stack, TextField, Typography } from '@mui/material';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import SiteProfile from '@/components/service/blog/SiteProfile';
import styles from '@/app/board.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type InviteResponse = {
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

export default function Opt() {
  const params = useParams();
  const router = useRouter();

  const siteName = normalizeText(params.siteName).toLowerCase();
  const token = normalizeText(params.token);

  const [inviteEmail, setInviteEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isInvitedUser, setIsInvitedUser] = useState(false);
  const [isAlreadyMember, setIsAlreadyMember] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadInvite() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/manage/team/members/invite/${token}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as InviteResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '초대 정보를 불러오지 못했습니다.');
        }

        setInviteEmail(result.invite?.email ?? '');
        setIsLoggedIn(Boolean(result.isLoggedIn));
        setIsInvitedUser(Boolean(result.isInvitedUser));
        setIsAlreadyMember(Boolean(result.isAlreadyMember));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '초대 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('초대 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadInvite();
  }, [siteName, token]);

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

      const response = await fetch(`/api/manage/team/members/invite/${token}?siteName=${siteName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          nickname,
        }),
      });

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
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  if (isAlreadyMember) {
    return (
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']} `}>
          <SiteProfile />
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
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']} `}>
          <SiteProfile />
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
        </div>
      </div>
    );
  }

  if (!isInvitedUser) {
    return (
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']} `}>
          <SiteProfile />
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
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className={`content ${styles.content} ${styles['blog-content']} `}>
        <SiteProfile />
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
      </div>
    </div>
  );
}
