'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { formatTimeAgo } from '@/lib/utils';
import {
  getRestrictionInitialMessageCreatedAt,
  type MemberRestrictionMessageSenderType,
  type MemberRestrictionMessagesResponse,
} from '@/lib/users/memberRestrictionMessages';

type Props = {
  open: boolean;
  endpoint: string;
  ownSenderType: MemberRestrictionMessageSenderType;
  inputPlaceholder: string;
  successMessage: string;
  postBody?: Record<string, unknown>;
  onClose: () => void;
  onSent?: () => void;
};

function MessageBubble({
  senderName,
  createdAt,
  message,
  isOwn,
}: {
  senderName: string | undefined;
  createdAt: string;
  message: string | undefined;
  isOwn: boolean;
}) {
  return (
    <Stack alignItems={isOwn ? 'flex-end' : 'flex-start'}>
      <Stack
        gap={0.5}
        sx={{
          width: 'fit-content',
          maxWidth: { xs: '90%', md: '75%' },
          px: 2,
          py: 1.5,
          borderRadius: 2,
          backgroundColor: isOwn ? 'action.selected' : 'action.hover',
          textAlign: isOwn ? 'right' : 'left',
        }}
      >
        <Typography variant="subtitle2">{senderName}</Typography>
        <Typography variant="body2">{formatTimeAgo(createdAt)}</Typography>
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {message}
        </Typography>
      </Stack>
    </Stack>
  );
}

export default function MemberRestrictionMessageDialog({
  open,
  endpoint,
  ownSenderType,
  inputPlaceholder,
  successMessage,
  postBody,
  onClose,
  onSent,
}: Props) {
  const theme = useTheme();
  const isDialog = useMediaQuery(theme.breakpoints.up('lg'));
  const [response, setResponse] = useState<MemberRestrictionMessagesResponse | null>(null);
  const [messageText, setMessageText] = useState('');
  const [openedAt, setOpenedAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    if (!open || !endpoint) {
      return;
    }

    let isActive = true;

    async function loadMessages() {
      setLoading(true);
      setResponse(null);
      setMessageText('');
      setErrorMessage('');
      setOpenedAt(new Date().toISOString());

      const fetchResponse = await fetch(endpoint, { credentials: 'include' });
      const result = (await fetchResponse.json().catch(() => ({
        error: '소명 메시지 응답을 확인하지 못했습니다.',
      }))) as MemberRestrictionMessagesResponse;

      if (!isActive) {
        return;
      }

      setLoading(false);

      if (!fetchResponse.ok || result.error) {
        setErrorMessage(result.error ?? '소명 메시지를 불러오지 못했습니다.');
        return;
      }

      setResponse(result);
    }

    void loadMessages();

    return () => {
      isActive = false;
    };
  }, [endpoint, open]);

  function closeDialog() {
    if (saving) {
      return;
    }

    onClose();
  }

  async function sendMessage() {
    const message = messageText.trim();

    if (!message) {
      setErrorMessage(ownSenderType === 'appellant' ? '소명 내용을 입력해 주세요.' : '답변 내용을 입력해 주세요.');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const fetchResponse = await fetch(endpoint, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...postBody,
        message,
      }),
    });
    const result = (await fetchResponse.json().catch(() => ({
      error: '메시지 전송 응답을 확인하지 못했습니다.',
    }))) as MemberRestrictionMessagesResponse;

    setSaving(false);

    if (!fetchResponse.ok || result.error) {
      setErrorMessage(result.error ?? '메시지를 보내지 못했습니다.');
      return;
    }

    setResponse(result);
    setMessageText('');
    setSnackbarMessage(successMessage);
    onSent?.();
  }

  const content = (
    <Stack gap={2}>
      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 220 }}>
          <LoadingIndicator />
        </Stack>
      ) : response ? (
        <>
          <MessageBubble
            senderName={response.siteName}
            createdAt={getRestrictionInitialMessageCreatedAt(response.messages ?? [], openedAt)}
            message={response.restrictionReason}
            isOwn={ownSenderType === 'staff'}
          />

          {(response.messages ?? []).map((message) => (
            <MessageBubble
              key={message.id}
              senderName={message.senderName}
              createdAt={message.createdAt}
              message={message.message}
              isOwn={message.senderType === ownSenderType}
            />
          ))}

          <TextField
            aria-label={inputPlaceholder}
            placeholder={inputPlaceholder}
            value={messageText}
            onChange={(event) => setMessageText(event.currentTarget.value)}
            multiline
            minRows={4}
            fullWidth
            size="small"
          />
        </>
      ) : null}
    </Stack>
  );

  return (
    <>
      {isDialog ? (
        <Dialog open={open} onClose={closeDialog} maxWidth="lg" fullWidth className="VhiDialog">
          <DialogTitle>소명 메시지</DialogTitle>
          <button type="button" className="close-button" onClick={closeDialog} disabled={saving}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>{content}</DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={closeDialog} disabled={saving}>
              닫기
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void sendMessage()}
              disabled={saving || loading || !messageText.trim()}
            >
              보내기
            </button>
          </DialogActions>
        </Dialog>
      ) : (
        <Drawer anchor="bottom" open={open} onClose={closeDialog} className="VhiDrawer-bottom">
          <h2>소명 메시지</h2>
          <button type="button" className="close-button" onClick={closeDialog} disabled={saving}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            {content}
            <Stack gap={1.5}>
              <button type="button" className="button medium cancel" onClick={closeDialog} disabled={saving}>
                닫기
              </button>
              <button
                type="button"
                className="button medium submit"
                onClick={() => void sendMessage()}
                disabled={saving || loading || !messageText.trim()}
              >
                보내기
              </button>
            </Stack>
          </Stack>
        </Drawer>
      )}

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2700}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message={snackbarMessage}
        onClose={() => setSnackbarMessage('')}
      />
    </>
  );
}

