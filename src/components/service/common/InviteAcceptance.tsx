'use client';

import { type JSX, useState } from 'react';
import { useRouter } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { maskEmail, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

export type InviteAcceptanceResponse = {
  ok?: boolean;
  invite?: { email: string };
  isLoggedIn?: boolean;
  isInvitedUser?: boolean;
  isAlreadyMember?: boolean;
  error?: string;
};

type ErrorPopup = {
  open: boolean;
  title: string;
  messages: string[];
  nicknameError: string;
};

function getKnownError(message: string) {
  if (
    message === '초대장을 불러오지 못했습니다.' ||
    message === '초대 처리에 실패했습니다.' ||
    message === '사용자 정보를 확인하지 못했습니다.' ||
    message === '닉네임을 확인하지 못했습니다.'
  ) {
    return { title: '', nicknameError: '' };
  }
  if (message.includes('닉네임')) {
    return { title: '닉네임 확인', nicknameError: message };
  }
  if (message.includes('이메일') || message.includes('계정')) {
    return { title: '계정 확인', nicknameError: '' };
  }
  if (message.includes('초대장') || message.includes('초대 정보') || message.includes('가입할 수 없습니다')) {
    return { title: '초대 정보 확인', nicknameError: '' };
  }
  if (message === '로그인이 필요합니다.') {
    return { title: '로그인 확인', nicknameError: '' };
  }
  return { title: '', nicknameError: '' };
}

export default function InviteAcceptance({
  siteName,
  token,
  inviteType,
  initialData,
  initialError,
}: {
  siteName: string;
  token: string;
  inviteType: 'blog' | 'community';
  initialData: InviteAcceptanceResponse | null;
  initialError: string;
}) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedToken = normalizeText(token);
  const inviteEmail = initialData?.invite?.email ?? '';
  const isLoggedIn = Boolean(initialData?.isLoggedIn);
  const isInvitedUser = Boolean(initialData?.isInvitedUser);
  const isAlreadyMember = Boolean(initialData?.isAlreadyMember);
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialMessage = initialError || initialData?.error || '';
  const initialKnownError = getKnownError(initialMessage);
  const [errorPopup, setErrorPopup] = useState<ErrorPopup>({
    open: Boolean(initialMessage),
    title: initialKnownError.title,
    messages: initialMessage ? [initialMessage] : [],
    nicknameError: initialKnownError.nicknameError,
  });

  function showError(message: string) {
    const knownError = getKnownError(message);
    setErrorPopup({
      open: true,
      title: knownError.title,
      messages: [knownError.title ? message : '초대 처리 중 오류가 발생했습니다.\n잠시 후 다시 시도해 주세요.'],
      nicknameError: knownError.nicknameError,
    });
  }

  function handleErrorClose() {
    setNicknameError(errorPopup.nicknameError);
    setErrorPopup((previousValue) => ({ ...previousValue, open: false }));
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedNickname = nickname.trim();

    if (trimmedNickname && (Array.from(trimmedNickname).length < 2 || Array.from(trimmedNickname).length > 10)) {
      const message = '별명은 2자 이상 10자 이하로 입력해주세요.';
      setNicknameError(message);
      showError(message);
      return;
    }

    setIsSubmitting(true);

    try {
      const endpoint =
        inviteType === 'community'
          ? `/api/manage/join/invite/${normalizedToken}?siteName=${normalizedSiteName}`
          : `/api/manage/team/members/invite/${normalizedToken}?siteName=${normalizedSiteName}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ nickname: trimmedNickname }),
      });
      const result = (await response.json().catch(() => null)) as { siteName?: string; error?: string } | null;

      if (!response.ok || !result?.siteName) {
        showError(result?.error || '초대 처리에 실패했습니다.');
        return;
      }

      router.replace(`/${result.siteName}`);
    } catch {
      showError('초대 처리에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const invitePath = inviteType === 'community' ? 'community' : 'blog';
  const siteLabel = inviteType === 'community' ? '커뮤니티' : '팀블로그';

  return (
    <div className="paper">
      {isAlreadyMember ? (
        <Stack gap={2}>
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>이미 {siteLabel}에 가입되어 있습니다.</span>
          </p>
          <Stack justifyContent="flex-end">
            <button type="button" className="button medium submit" onClick={() => router.replace(`/${siteName}`)}>
              {siteLabel}로 이동
            </button>
          </Stack>
        </Stack>
      ) : !isLoggedIn ? (
        <Stack gap={2.5}>
          <Typography variant="subtitle2">{maskEmail(inviteEmail)}</Typography>
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>초대받은 이메일 계정으로 로그인하거나 회원가입해 주세요.</span>
          </p>
          <Stack direction="row" gap={1.5}>
            <Anchor
              className="button medium action"
              href={`/auth/sign-in?inviteToken=${token}&siteName=${siteName}&inviteType=${invitePath}`}
            >
              로그인
            </Anchor>
            <Anchor
              className="button medium action"
              href={`/auth/sign-up?inviteToken=${token}&siteName=${siteName}&inviteType=${invitePath}`}
            >
              회원가입
            </Anchor>
          </Stack>
        </Stack>
      ) : !isInvitedUser ? (
        <p className="alert info">
          <InfoOutlineRoundedIcon />
          <span>초대받은 이메일 계정으로 로그인해 주세요.</span>
        </p>
      ) : (
        <Box component="form" onSubmit={handleSubmit}>
          <Stack gap={2.5}>
            <Typography variant="body2">닉네임은 선택입니다. 입력하지 않으면 기본 활동명이 사용됩니다.</Typography>
            <TextField
              name="nickname"
              placeholder="닉네임"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setNicknameError('');
              }}
              error={Boolean(nicknameError)}
              helperText={
                nicknameError || '입력하지 않으면 활동명이 사용됩니다. 입력하는 경우 2자 이상 10자 이하입니다.'
              }
              fullWidth
              size="small"
              slotProps={{ htmlInput: { minLength: 2, maxLength: 10 } }}
            />
            <Stack direction="row" justifyContent="flex-end">
              <button type="submit" className="button medium submit" disabled={isSubmitting}>
                가입하기
              </button>
            </Stack>
          </Stack>
        </Box>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={errorPopup.open}
          onClose={handleErrorClose}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          {errorPopup.title ? <h2>{errorPopup.title}</h2> : null}
          <button type="button" className="close-button" onClick={handleErrorClose} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <ul>
              {errorPopup.messages.map((message, index) => (
                <li key={`${index}-${message}`} style={{ whiteSpace: 'pre-line' }}>
                  {message}
                </li>
              ))}
            </ul>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button small cancel" onClick={handleErrorClose}>
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={errorPopup.open}
          onClose={handleErrorClose}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          {errorPopup.title ? <DialogTitle>{errorPopup.title}</DialogTitle> : null}
          <button type="button" className="close-button" onClick={handleErrorClose} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <ul>
              {errorPopup.messages.map((message, index) => (
                <li key={`${index}-${message}`} style={{ whiteSpace: 'pre-line' }}>
                  {message}
                </li>
              ))}
            </ul>
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={handleErrorClose}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
