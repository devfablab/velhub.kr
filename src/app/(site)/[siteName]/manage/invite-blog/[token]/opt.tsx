'use client';

import { useEffect, useState } from 'react';
import Link from '@mui/material/Link';
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type InviteResponse = {
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

type SignInCheckResponse = {
  accountType?: string;
  hasPassword?: boolean;
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

export default function Opt({ siteName, token }: Props) {
  const supabase = getSupabaseBrowser();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invite, setInvite] = useState<InviteResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isRegisteredEmail, setIsRegisteredEmail] = useState(false);

  useEffect(() => {
    async function loadPage() {
      try {
        setErrorMessage('');

        const inviteResponse = await fetch(`/api/manage/design/blog/team/invite/${token}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const inviteResult = (await inviteResponse.json()) as InviteResponse | { error?: string };

        if (!inviteResponse.ok) {
          throw new Error(
            'error' in inviteResult
              ? inviteResult.error || '초대장을 불러오지 못했습니다.'
              : '초대장을 불러오지 못했습니다.',
          );
        }

        if (!('invite' in inviteResult) || !('site' in inviteResult)) {
          throw new Error('초대장을 불러오지 못했습니다.');
        }

        const [session, signInCheckResponse] = await Promise.all([
          supabase.auth.getSession(),
          fetch('/api/auth/email/sign-in/check', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              email: inviteResult.invite.email,
            }),
          }),
        ]);

        const signInCheckResult = (await signInCheckResponse.json()) as SignInCheckResponse | { error?: string };

        if (session.error && session.error.message !== 'Auth session missing!') {
          throw new Error(session.error.message || '사용자 정보를 불러오지 못했습니다.');
        }

        const sessionUser = session.data.session?.user ?? null;

        setInvite(inviteResult);
        setCurrentUserEmail((sessionUser?.email ?? '').trim().toLowerCase());
        setIsLoggedIn(Boolean(sessionUser));
        setIsRegisteredEmail(signInCheckResponse.ok && 'accountType' in signInCheckResult);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '초대장을 불러오지 못했습니다.');
        } else {
          setErrorMessage('초대장을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPage();
  }, [siteName, token, supabase.auth]);

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
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ py: 8 }}>
        <Stack spacing={2} alignItems="center">
          <CircularProgress />
          <Typography>초대 정보를 확인하고 있습니다.</Typography>
        </Stack>
      </Box>
    );
  }

  const inviteEmail = invite?.invite.email.trim().toLowerCase() ?? '';
  const isMatchedUser = isLoggedIn && currentUserEmail === inviteEmail;
  const isMismatchedUser = isLoggedIn && currentUserEmail !== inviteEmail;

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={3}>
        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}

        {invite ? (
          <>
            <Box>
              <Typography variant="body2">사이트명</Typography>
              <Typography>{invite.site.site_label}</Typography>
            </Box>

            <Box>
              <Typography variant="body2">초대 이메일</Typography>
              <Typography>{invite.invite.email}</Typography>
            </Box>

            <Box>
              <Typography variant="body2">역할</Typography>
              <Typography>{getRoleLabel(invite.invite.role)}</Typography>
            </Box>

            <Box>
              <Typography variant="body2">유효일</Typography>
              <Typography>{formatDate(invite.invite.expires_at)}</Typography>
            </Box>

            {isMatchedUser ? (
              <Stack spacing={1.5}>
                <Alert severity="success" variant="outlined">
                  현재 로그인한 계정으로 초대를 수락할 수 있습니다.
                </Alert>
                <Box>
                  <Button type="button" variant="contained" onClick={handleJoin} disabled={isSubmitting}>
                    초대 수락하기
                  </Button>
                </Box>
              </Stack>
            ) : null}

            {!isLoggedIn && isRegisteredEmail ? (
              <Stack spacing={1.5}>
                <Alert severity="info">이미 데브허브에 가입된 이메일입니다. 로그인 후 초대를 수락해주세요.</Alert>
                <Box>
                  <Button
                    component={Link}
                    href={`/auth/sign-in?inviteToken=${token}&siteName=${siteName}`}
                    underline="none"
                    variant="outlined"
                  >
                    로그인
                  </Button>
                </Box>
              </Stack>
            ) : null}

            {!isLoggedIn && !isRegisteredEmail ? (
              <Stack spacing={1.5}>
                <Alert severity="info">초대받은 이메일로 회원가입 후 초대를 수락해주세요.</Alert>
                <Box>
                  <Button
                    component={Link}
                    href={`/auth/sign-up?inviteToken=${token}&siteName=${siteName}`}
                    underline="none"
                    variant="outlined"
                  >
                    회원가입
                  </Button>
                </Box>
              </Stack>
            ) : null}

            {isMismatchedUser ? (
              <Stack spacing={1.5}>
                <Alert severity="warning">현재 로그인한 계정 이메일과 초대받은 이메일이 일치하지 않습니다.</Alert>
                <Box>
                  <Button
                    component={Link}
                    href={`/auth/sign-in?inviteToken=${token}&siteName=${siteName}`}
                    underline="none"
                    variant="outlined"
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
