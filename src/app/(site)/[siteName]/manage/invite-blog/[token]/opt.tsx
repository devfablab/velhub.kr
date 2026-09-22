'use client';

import { useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Box, Button, Paper, Stack, Typography } from '@mui/material';
import Link from '@mui/material/Link';

export type InviteResponse = {
  ok: boolean;
  invite: {
    id: string;
    email: string;
    role: string;
    status: string;
    expires_at: string | null;
  };
  site: {
    id: string;
    site_key: string;
    site_label: string;
    site_type: string;
  };
};

type AcceptResponse = {
  ok: boolean;
  siteName: string;
};

type Props = {
  siteName: string;
  token: string;
};

function getRoleLabel(role: string) {
  if (role === 'manager') {
    return '매니저';
  }

  if (role === 'member') {
    return '멤버';
  }

  return role;
}

function formatDate(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}.${month}.${day} ${hour}:${minute}`;
}

type OptProps = Props & {
  initialData: InviteResponse | null;
  initialError: string;
  currentUserEmail: string;
  isLoggedIn: boolean;
  isRegisteredEmail: boolean;
};

export default function Opt({
  siteName,
  token,
  initialData,
  initialError,
  currentUserEmail,
  isLoggedIn,
  isRegisteredEmail,
}: OptProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invite] = useState<InviteResponse | null>(initialData);
  const [errorMessage, setErrorMessage] = useState(initialError || '');

  async function handleJoin() {
    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch(`/api/manage/design/blog/team/invite/${token}?siteName=${siteName}`, {
        method: 'POST',
        credentials: 'include',
      });

      const result = (await response.json()) as AcceptResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in result ? result.error || '초대 처리에 실패했습니다.' : '초대 처리에 실패했습니다.');
      }

      if (!('siteName' in result) || !result.siteName) {
        throw new Error('초대 처리에 실패했습니다.');
      }

      window.location.href = `/${result.siteName}`;
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '초대 처리에 실패했습니다.');
      } else {
        setErrorMessage('초대 처리에 실패했습니다.');
      }
      setIsSubmitting(false);
    }
  }

  const inviteEmail = invite?.invite.email.trim().toLowerCase() ?? '';
  const isMatchedUser = isLoggedIn && currentUserEmail === inviteEmail;
  const isMismatchedUser = isLoggedIn && currentUserEmail !== inviteEmail;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack gap={3}>
        {errorMessage ? (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        ) : null}

        {invite ? (
          <>
            <Box>
              <Typography variant="subtitle2">사이트명</Typography>
              <Typography variant="body2">{invite.site.site_label}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2">초대 이메일</Typography>
              <Typography variant="body2">{invite.invite.email}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2">역할</Typography>
              <Typography variant="body2">{getRoleLabel(invite.invite.role)}</Typography>
            </Box>

            <Box>
              <Typography variant="subtitle2">유효일</Typography>
              <Typography variant="body2">{formatDate(invite.invite.expires_at)}</Typography>
            </Box>

            {isMatchedUser ? (
              <Stack gap={1.5}>
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>현재 로그인한 계정으로 초대를 수락할 수 있습니다.</span>
                </p>
                <Box>
                  <button type="button" className="button medium submit" onClick={handleJoin} disabled={isSubmitting}>
                    초대 수락하기
                  </button>
                </Box>
              </Stack>
            ) : null}

            {!isLoggedIn && isRegisteredEmail ? (
              <Stack gap={1.5}>
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>이미 데브허브에 가입된 이메일입니다. 로그인 후 초대를 수락해주세요.</span>
                </p>
                <Box>
                  <Button
                    component={Link}
                    href={`/auth/sign-in?inviteToken=${token}&siteName=${siteName}`}
                    className="button medium submit"
                  >
                    로그인
                  </Button>
                </Box>
              </Stack>
            ) : null}

            {!isLoggedIn && !isRegisteredEmail ? (
              <Stack gap={1.5}>
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>초대받은 이메일로 회원가입 후 초대를 수락해주세요</span>
                </p>
                <Box>
                  <Button
                    component={Link}
                    href={`/auth/sign-up?inviteToken=${token}&siteName=${siteName}`}
                    className="button medium submit"
                  >
                    회원가입
                  </Button>
                </Box>
              </Stack>
            ) : null}

            {isMismatchedUser ? (
              <Stack gap={1.5}>
                <p className="alert warning">
                  <WarningAmberRoundedIcon />
                  <span>현재 로그인한 계정 이메일과 초대받은 이메일이 일치하지 않습니다.</span>
                </p>
                <Box>
                  <Button
                    component={Link}
                    href={`/auth/sign-in?inviteToken=${token}&siteName=${siteName}`}
                    className="button medium submit"
                  >
                    다른 계정으로 로그인
                  </Button>
                </Box>
              </Stack>
            ) : null}
          </>
        ) : null}
      </Stack>
    </Paper>
  );
}
