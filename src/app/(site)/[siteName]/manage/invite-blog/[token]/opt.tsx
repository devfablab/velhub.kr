'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Box, Paper, Stack, TextField, Typography } from '@mui/material';
import { formatDateTimeDetail, maskEmail } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';

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
  return formatDateTimeDetail(value);
}

type OptProps = Props & {
  initialData: InviteResponse | null;
  initialError: string;
  currentUserEmail: string;
  isLoggedIn: boolean;
  isRegisteredEmail: boolean;
};

function getErrorDetails(message: string) {
  if (message.includes('별명') || message.includes('닉네임')) {
    return { title: '별명 확인', nicknameError: message };
  }

  if (message === '이미 초대된 멤버입니다.' || message === '이미 가입한 팀원입니다.') {
    return { title: '멤버 확인', nicknameError: '' };
  }

  if (message.includes('이메일') || message.includes('로그인') || message.includes('계정')) {
    return { title: '계정 확인', nicknameError: '' };
  }

  if (
    message.includes('초대장') ||
    message.includes('초대 정보') ||
    message.includes('취소된 초대') ||
    message.includes('만료된 초대') ||
    message.includes('팀 블로그')
  ) {
    return { title: '초대 정보 확인', nicknameError: '' };
  }

  return { title: null, nicknameError: '' };
}

export default function Opt({
  siteName,
  token,
  initialData,
  initialError,
  currentUserEmail,
  isLoggedIn,
  isRegisteredEmail,
}: OptProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invite] = useState<InviteResponse | null>(initialData);
  const [errorMessage, setErrorMessage] = useState(initialError || '');
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const initialErrorDetails = getErrorDetails(initialError || '');
  const [popupMessage, setPopupMessage] = useState(initialError || '');
  const [popupTitle, setPopupTitle] = useState<string | null>(initialErrorDetails.title);

  function showError(message: string) {
    const errorDetails = getErrorDetails(message);

    setPopupTitle(errorDetails.title);
    setPopupMessage(errorDetails.title ? message : '초대 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.');
    setNicknameError(errorDetails.nicknameError);
  }

  async function handleJoin() {
    const trimmedNickname = nickname.trim();

    if (trimmedNickname && (Array.from(trimmedNickname).length < 2 || Array.from(trimmedNickname).length > 10)) {
      showError('별명은 2자 이상 10자 이하로 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');
      setNicknameError('');

      const response = await fetch(`/api/manage/team/members/invite/${token}?siteName=${siteName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ nickname: trimmedNickname }),
      });

      const result = (await response.json()) as AcceptResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in result ? result.error || '초대 처리에 실패했습니다.' : '초대 처리에 실패했습니다.');
      }

      if (!('siteName' in result) || !result.siteName) {
        throw new Error('초대 처리에 실패했습니다.');
      }

      router.replace(`/${result.siteName}`);
    } catch (unknownError) {
      showError(
        unknownError instanceof Error
          ? unknownError.message || '초대 처리에 실패했습니다.'
          : '초대 처리에 실패했습니다.',
      );
    } finally {
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
              <Typography variant="body2">{maskEmail(invite.invite.email)}</Typography>
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
                <TextField
                  name="nickname"
                  label="별명"
                  value={nickname}
                  onChange={(event) => {
                    setNickname(event.target.value);
                    setNicknameError('');
                  }}
                  error={Boolean(nicknameError)}
                  helperText={
                    nicknameError || '입력하지 않으면 활동명을 사용합니다. 입력하는 경우 2자 이상 10자 이하입니다.'
                  }
                  fullWidth
                  size="small"
                  slotProps={{ htmlInput: { minLength: 2, maxLength: 10 } }}
                />
                <Box>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={() => void handleJoin()}
                    disabled={isSubmitting}
                  >
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
                  <Anchor
                    href={`/auth/sign-in?inviteToken=${token}&siteName=${siteName}`}
                    className="button medium submit"
                  >
                    로그인
                  </Anchor>
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
                  <Anchor
                    href={`/auth/sign-up?inviteToken=${token}&siteName=${siteName}`}
                    className="button medium submit"
                  >
                    회원가입
                  </Anchor>
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
                  <Anchor
                    href={`/auth/sign-in?inviteToken=${token}&siteName=${siteName}`}
                    className="button medium submit"
                  >
                    다른 계정으로 로그인
                  </Anchor>
                </Box>
              </Stack>
            ) : null}
          </>
        ) : null}
        <FormErrorDialog
          open={Boolean(popupMessage)}
          title={popupTitle}
          messages={popupMessage ? [popupMessage] : []}
          onClose={() => setPopupMessage('')}
        />
      </Stack>
    </Paper>
  );
}
