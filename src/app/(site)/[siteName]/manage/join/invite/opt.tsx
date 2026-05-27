/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { formatDateTimeFull, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expires_at: string | null;
  accepted_user_id: string | null;
  joined_at: string | null;
  cancelled_at: string | null;
};

type InviteResponse = {
  invites: InviteRow[];
};

type CreateInviteResponse = {
  ok: boolean;
  invite: InviteRow;
};

type CancelInviteResponse = {
  ok: boolean;
  invite: InviteRow;
};

function getInviteStatusLabel(status: string) {
  if (status === 'pending') {
    return '대기중';
  }

  if (status === 'joined') {
    return '가입완료';
  }

  if (status === 'expired') {
    return '만료';
  }

  if (status === 'cancelled') {
    return '취소';
  }

  return status;
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [targetInvite, setTargetInvite] = useState<InviteRow | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  async function loadInvites() {
    const response = await fetch(`/api/manage/join/invite?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as InviteResponse | { error?: string };

    if (!response.ok) {
      throw new Error(
        'error' in result ? result.error || '초대 목록을 불러오지 못했습니다.' : '초대 목록을 불러오지 못했습니다.',
      );
    }

    setInvites('invites' in result && Array.isArray(result.invites) ? result.invites : []);
  }

  async function loadAll() {
    try {
      setErrorMessage('');
      await loadInvites();
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

  useEffect(() => {
    void loadAll();
  }, [siteName]);

  const sortedInvites = useMemo(() => {
    return [...invites].sort((a, b) => {
      const aTime = a.expires_at ? new Date(a.expires_at).getTime() : 0;
      const bTime = b.expires_at ? new Date(b.expires_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [invites]);

  function handleInviteEmailChange(event: InputChangeEvent) {
    setInviteEmail(event.currentTarget.value);
  }

  function handleOpenInviteDialog() {
    setIsInviteDialogOpen(true);
  }

  function handleCloseInviteDialog() {
    if (isInviteSubmitting) {
      return;
    }

    setIsInviteDialogOpen(false);
    setInviteEmail('');
  }

  function handleOpenCancelDialog(invite: InviteRow) {
    setTargetInvite(invite);
  }

  function handleCloseCancelDialog() {
    if (isCancelSubmitting) {
      return;
    }

    setTargetInvite(null);
  }

  async function handleSubmitInvite(event: FormSubmitEvent) {
    event.preventDefault();

    if (isInviteSubmitting) {
      return;
    }

    try {
      setIsInviteSubmitting(true);
      setErrorMessage('');

      const response = await fetch('/api/manage/join/invite', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          email: inviteEmail,
        }),
      });

      const result = (await response.json()) as CreateInviteResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in result ? result.error || '초대에 실패했습니다.' : '초대에 실패했습니다.');
      }

      if (!('invite' in result) || !result.invite) {
        throw new Error('초대에 실패했습니다.');
      }

      setInvites((previousInvites) => [result.invite, ...previousInvites]);
      setInviteEmail('');
      setIsInviteDialogOpen(false);
      setSnackbarMessage('초대 메일을 발송했습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '초대에 실패했습니다.');
      } else {
        setErrorMessage('초대에 실패했습니다.');
      }
    } finally {
      setIsInviteSubmitting(false);
    }
  }

  async function handleSubmitCancelInvite() {
    if (!targetInvite) {
      return;
    }

    try {
      setIsCancelSubmitting(true);
      setErrorMessage('');

      const response = await fetch('/api/manage/join/invite', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          inviteId: targetInvite.id,
        }),
      });

      const result = (await response.json()) as CancelInviteResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in result ? result.error || '초대 취소에 실패했습니다.' : '초대 취소에 실패했습니다.');
      }

      if (!('invite' in result) || !result.invite) {
        throw new Error('초대 취소에 실패했습니다.');
      }

      setInvites((previousInvites) =>
        previousInvites.map((invite) => (invite.id === result.invite.id ? result.invite : invite)),
      );

      setTargetInvite(null);
      setSnackbarMessage('초대를 취소했습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '초대 취소에 실패했습니다.');
      } else {
        setErrorMessage('초대 취소에 실패했습니다.');
      }
    } finally {
      setIsCancelSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="멤버 관리" pageBack={`/${siteName}/manage`} menu="join">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="멤버 관리" pageBack={`/${siteName}/manage`} menu="join">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>
            <button type="button" className="button small action" onClick={handleOpenInviteDialog}>
              멤버 초대
            </button>
          </Stack>

          <div className={`paper paper-p0 ${styles.paper}`}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>초대 이메일</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>상태</TableCell>
                  <TableCell>유효일</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedInvites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{invite.email}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{getInviteStatusLabel(invite.status)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeFull(invite.expires_at)}</TableCell>
                    <TableCell align="right">
                      {invite.status === 'pending' ? (
                        <button
                          type="button"
                          className="button medium cancel"
                          onClick={() => handleOpenCancelDialog(invite)}
                        >
                          취소
                        </button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}

                {sortedInvites.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      생성된 초대가 없습니다.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isInviteDialogOpen}
              onClose={handleCloseInviteDialog}
              className="VhiDrawer-bottom"
            >
              <h2>멤버 초대</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseInviteDialog}
                aria-label="멤버 초대 닫기"
                disabled={isInviteSubmitting}
              >
                <CloseRoundedIcon />
              </button>

              <Stack gap={3}>
                <Box component="form" onSubmit={handleSubmitInvite}>
                  <Stack gap={2} sx={{ pt: 1 }}>
                    <TextField
                      placeholder="이메일"
                      value={inviteEmail}
                      onChange={handleInviteEmailChange}
                      fullWidth
                      size="small"
                    />
                  </Stack>
                </Box>

                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseInviteDialog}
                    disabled={isInviteSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={(event) => void handleSubmitInvite(event as unknown as FormSubmitEvent)}
                    disabled={isInviteSubmitting}
                  >
                    초대하기
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={isInviteDialogOpen}
              onClose={handleCloseInviteDialog}
              fullWidth
              maxWidth="sm"
              className="VhiDialog"
            >
              <DialogTitle>멤버 초대</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseInviteDialog}
                aria-label="멤버 초대 닫기"
                disabled={isInviteSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Box component="form" onSubmit={handleSubmitInvite}>
                  <Stack gap={2} sx={{ pt: 1 }}>
                    <TextField
                      placeholder="이메일"
                      value={inviteEmail}
                      onChange={handleInviteEmailChange}
                      fullWidth
                      size="small"
                    />
                  </Stack>
                </Box>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseInviteDialog}
                  disabled={isInviteSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={(event) => void handleSubmitInvite(event as unknown as FormSubmitEvent)}
                  disabled={isInviteSubmitting}
                >
                  초대하기
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(targetInvite)}
              onClose={handleCloseCancelDialog}
              className="VhiDrawer-bottom"
            >
              <h2>초대 취소 답변</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseCancelDialog}
                aria-label="멤버 초대 닫기"
                disabled={isCancelSubmitting}
              >
                <CloseRoundedIcon />
              </button>

              <Stack gap={3}>
                <Typography>
                  정말로 초대를 취소하시겠습니까?
                  <br />
                  취소된 초대장은 더이상 사용할 수 없습니다.
                </Typography>

                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseCancelDialog}
                    disabled={isCancelSubmitting}
                  >
                    초대 유지
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={handleSubmitCancelInvite}
                    disabled={isCancelSubmitting}
                  >
                    초대 취소
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog open={Boolean(targetInvite)} onClose={handleCloseCancelDialog} fullWidth maxWidth="xs">
              <DialogTitle>초대 취소</DialogTitle>
              <DialogContent>
                <Typography>
                  정말로 초대를 취소하시겠습니까?
                  <br />
                  취소된 초대장은 더이상 사용할 수 없습니다.
                </Typography>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseCancelDialog}
                  disabled={isCancelSubmitting}
                >
                  초대 유지
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={handleSubmitCancelInvite}
                  disabled={isCancelSubmitting}
                >
                  초대 취소
                </button>
              </DialogActions>
            </Dialog>
          )}

          <Snackbar
            open={Boolean(snackbarMessage)}
            autoHideDuration={2700}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            onClose={() => setSnackbarMessage('')}
            message={snackbarMessage}
          />
        </div>
      </div>
    </Container>
  );
}
