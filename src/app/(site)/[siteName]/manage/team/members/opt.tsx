'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
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
import { formatDateTimeFull, maskEmail, normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import MenuItem from '@/components/SelectMenuItem';
import { SelectCheckAdornment } from '@/components/SelectWithCheck';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type TeamRole = 'owner' | 'manager' | 'member' | 'observer';

type TeamRow = {
  id: string;
  email: string;
  name: string;
  approval_at: string | null;
  role: TeamRole;
  is_self: boolean;
};

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

export type TeamResponse = {
  teams: TeamRow[];
  ownerTransfer: {
    canRequest: boolean;
    hasPendingRequest: boolean;
    availableAt: string | null;
  };
};

export type InviteResponse = {
  invites: InviteRow[];
};

type PatchResponse = {
  ok: boolean;
  team: {
    id: string;
    role: TeamRole;
  };
};

type CreateInviteResponse = {
  ok: boolean;
  invite: InviteRow;
};

type CancelInviteResponse = {
  ok: boolean;
  invite: InviteRow;
};

function getRoleLabel(role: string) {
  if (role === 'owner') {
    return '운영자';
  }

  if (role === 'manager') {
    return '매니저';
  }

  if (role === 'member') {
    return '멤버';
  }

  if (role === 'observer') {
    return '옵저버';
  }

  return role;
}

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

function getNextRole(role: TeamRole) {
  if (role === 'manager') {
    return 'member';
  }

  if (role === 'member') {
    return 'manager';
  }

  return null;
}

type OptProps = { initialTeams: TeamResponse | null; initialInvites: InviteResponse | null; initialError: string };

export default function Opt({ initialTeams, initialInvites, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const [teams, setTeams] = useState<TeamRow[]>(initialTeams?.teams ?? []);
  const [invites, setInvites] = useState<InviteRow[]>(initialInvites?.invites ?? []);
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null);
  const [targetRoleTeam, setTargetRoleTeam] = useState<TeamRow | null>(null);
  const [nextRole, setNextRole] = useState<'manager' | 'member' | 'observer' | null>(null);
  const [targetInvite, setTargetInvite] = useState<InviteRow | null>(null);
  const [ownerTransferTargetId, setOwnerTransferTargetId] = useState('');
  const [canRequestOwnerTransfer, setCanRequestOwnerTransfer] = useState(
    initialTeams?.ownerTransfer?.canRequest ?? false,
  );
  const [hasPendingOwnerTransfer, setHasPendingOwnerTransfer] = useState(
    initialTeams?.ownerTransfer?.hasPendingRequest ?? false,
  );
  const [isOwnerTransferOpen, setIsOwnerTransferOpen] = useState(false);
  const [isOwnerTransferSubmitting, setIsOwnerTransferSubmitting] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('manager');
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isInviteListDialogOpen, setIsInviteListDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));
  const [errorDialogTitle, setErrorDialogTitle] = useState<string | null>(initialError ? '팀원 관리' : null);
  const [inviteErrorMessage, setInviteErrorMessage] = useState('');
  const [inviteEmailError, setInviteEmailError] = useState('');
  const [pendingInviteEmailError, setPendingInviteEmailError] = useState('');
  const inviteErrorTitle =
    pendingInviteEmailError === '이미 초대된 멤버입니다.' || pendingInviteEmailError === '이미 가입한 팀원입니다.'
      ? '멤버 확인'
      : pendingInviteEmailError
        ? '초대 정보 확인'
        : null;

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  function showError(message: string, title: string | null) {
    setErrorMessage(message);
    setErrorDialogTitle(title);
    setIsErrorDialogOpen(true);
  }

  const sortedTeams = useMemo(() => {
    return [...teams].sort((a, b) => {
      const aTime = a.approval_at ? new Date(a.approval_at).getTime() : 0;
      const bTime = b.approval_at ? new Date(b.approval_at).getTime() : 0;
      return aTime - bTime;
    });
  }, [teams]);

  const sortedInvites = useMemo(() => {
    return [...invites].sort((a, b) => {
      const aTime = a.expires_at ? new Date(a.expires_at).getTime() : 0;
      const bTime = b.expires_at ? new Date(b.expires_at).getTime() : 0;
      return bTime - aTime;
    });
  }, [invites]);

  function handleOpenDetail(team: TeamRow) {
    setSelectedTeam(team);
  }

  if (!initialTeams || !initialInvites) {
    return (
      <Container pageTitle="팀원 관리" pageBack={`/${siteName}/manage`} menu="team">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <ScreenState kind="error">{initialError || '팀원 관리 정보를 불러오지 못했습니다.'}</ScreenState>
            <FormErrorDialog
              open={isErrorDialogOpen}
              onClose={() => setIsErrorDialogOpen(false)}
              title={errorDialogTitle}
              messages={[initialError || '팀원 관리 정보를 불러오지 못했습니다.']}
            />
          </div>
        </div>
      </Container>
    );
  }

  function handleCloseDetail() {
    setSelectedTeam(null);
  }

  function handleOpenRoleDialog(team: TeamRow) {
    const role = getNextRole(team.role);

    if (!role) {
      return;
    }

    setTargetRoleTeam(team);
    setNextRole(role);
  }

  function handleOpenObserverDialog(team: TeamRow) {
    if (team.role !== 'member' && team.role !== 'observer') {
      return;
    }

    setTargetRoleTeam(team);
    setNextRole(team.role === 'observer' ? 'member' : 'observer');
  }

  function handleCloseRoleDialog() {
    if (isRoleSubmitting) {
      return;
    }

    setTargetRoleTeam(null);
    setNextRole(null);
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

  function handleOpenInviteDialog() {
    setIsInviteDialogOpen(true);
  }

  function handleCloseInviteDialog() {
    if (isInviteSubmitting) {
      return;
    }

    setIsInviteDialogOpen(false);
    setInviteEmail('');
    setInviteRole('manager');
    setInviteEmailError('');
    setPendingInviteEmailError('');
    setInviteErrorMessage('');
  }

  function handleOpenInviteListDialog() {
    setIsInviteListDialogOpen(true);
  }

  function handleCloseInviteListDialog() {
    setIsInviteListDialogOpen(false);
  }

  function handleOpenOwnerTransfer() {
    setOwnerTransferTargetId('');
    setIsOwnerTransferOpen(true);
  }

  function handleCloseOwnerTransfer() {
    if (isOwnerTransferSubmitting) {
      return;
    }

    setIsOwnerTransferOpen(false);
    setOwnerTransferTargetId('');
  }

  async function handleSubmitOwnerTransfer() {
    if (!ownerTransferTargetId || isOwnerTransferSubmitting) {
      return;
    }

    try {
      setIsOwnerTransferSubmitting(true);
      setErrorMessage('');

      const response = await fetch('/api/manage/team/members/owner-transfer', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          targetMemberId: ownerTransferTargetId,
        }),
      });
      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        showError(result.error || '운영자 교체 요청에 실패했습니다.', response.status >= 500 ? null : '운영자 교체');
        return;
      }

      setCanRequestOwnerTransfer(false);
      setHasPendingOwnerTransfer(true);
      setIsOwnerTransferOpen(false);
      setOwnerTransferTargetId('');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '운영자 교체 요청에 실패했습니다.', null);
      } else {
        showError('운영자 교체 요청에 실패했습니다.', null);
      }
    } finally {
      setIsOwnerTransferSubmitting(false);
    }
  }

  async function handleSubmitRole() {
    if (!targetRoleTeam || !nextRole) {
      return;
    }

    try {
      setIsRoleSubmitting(true);
      setErrorMessage('');

      const response = await fetch('/api/manage/team/members', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          teamId: targetRoleTeam.id,
          role: nextRole,
        }),
      });

      const result = (await response.json()) as PatchResponse | { error?: string };

      if (!response.ok) {
        showError(
          'error' in result ? result.error || '역할 변경에 실패했습니다.' : '역할 변경에 실패했습니다.',
          response.status >= 500 ? null : nextRole === 'observer' ? '팀원 차단' : '역할 변경',
        );
        return;
      }

      if (!('team' in result) || !result.team) {
        throw new Error('역할 변경에 실패했습니다.');
      }

      setTeams((previousTeams) =>
        previousTeams.map((team) =>
          team.id === result.team.id
            ? {
                ...team,
                role: result.team.role,
              }
            : team,
        ),
      );

      setSelectedTeam((previousSelectedTeam) =>
        previousSelectedTeam && previousSelectedTeam.id === result.team.id
          ? {
              ...previousSelectedTeam,
              role: result.team.role,
            }
          : previousSelectedTeam,
      );

      setTargetRoleTeam(null);
      setNextRole(null);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '역할 변경에 실패했습니다.', null);
      } else {
        showError('역할 변경에 실패했습니다.', null);
      }
    } finally {
      setIsRoleSubmitting(false);
    }
  }

  async function handleSubmitInvite() {
    const normalizedEmail = inviteEmail.trim().toLowerCase();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      const message = normalizedEmail ? '올바른 이메일 형식으로 입력해 주세요.' : '이메일을 입력해 주세요.';
      setPendingInviteEmailError(message);
      setInviteErrorMessage(message);
      return;
    }

    try {
      setIsInviteSubmitting(true);
      setErrorMessage('');

      const response = await fetch('/api/manage/team/members/invite', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          email: normalizedEmail,
          role: inviteRole,
        }),
      });

      const result = (await response.json()) as CreateInviteResponse | { error?: string };

      if (!response.ok) {
        const responseError = 'error' in result ? result.error || '초대를 실패했습니다.' : '초대를 실패했습니다.';
        if (response.status < 500) setPendingInviteEmailError(responseError);
        throw new Error(responseError);
      }

      if (!('invite' in result) || !result.invite) {
        throw new Error('초대를 실패했습니다.');
      }

      setInvites((previousInvites) => [result.invite, ...previousInvites]);
      setInviteEmail('');
      setInviteRole('manager');
      setIsInviteDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        const message = unknownError.message || '초대를 실패했습니다.';
        setInviteErrorMessage(message);
      } else {
        setInviteErrorMessage('초대를 실패했습니다.');
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

      const response = await fetch('/api/manage/team/members/invite', {
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
        showError(
          'error' in result ? result.error || '초대 취소에 실패했습니다.' : '초대 취소에 실패했습니다.',
          response.status >= 500 ? null : '초대 취소',
        );
        return;
      }

      if (!('invite' in result) || !result.invite) {
        throw new Error('초대 취소에 실패했습니다.');
      }

      setInvites((previousInvites) =>
        previousInvites.map((invite) => (invite.id === result.invite.id ? result.invite : invite)),
      );

      setTargetInvite(null);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '초대 취소에 실패했습니다.', null);
      } else {
        showError('초대 취소에 실패했습니다.', null);
      }
    } finally {
      setIsCancelSubmitting(false);
    }
  }

  return (
    <Container pageTitle="팀원 관리" pageBack={`/${siteName}/manage`} menu="team">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
          {hasPendingOwnerTransfer ? (
            <div className={`paper paper-error ${styles.paper}`}>운영자 교체 응답 전</div>
          ) : null}

          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ p: 2, pb: 0 }}>
            {canRequestOwnerTransfer ? (
              <button type="button" className="button small action" onClick={handleOpenOwnerTransfer}>
                운영자 교체
              </button>
            ) : null}
            <button
              type="button"
              className="button small cancel"
              disabled={sortedInvites.length === 0}
              onClick={handleOpenInviteListDialog}
            >
              초대 목록
            </button>
            <button type="button" className="button small action" onClick={handleOpenInviteDialog}>
              팀원초대
            </button>
          </Stack>

          <div className={`paper paper-p0 ${styles.paper}`}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>이메일</TableCell>
                  <TableCell>별명</TableCell>
                  <TableCell>가입일</TableCell>
                  <TableCell>역할</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedTeams.map((team) => (
                  <TableRow key={team.id} hover onClick={() => handleOpenDetail(team)} sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{maskEmail(team.email)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{team.name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeFull(team.approval_at)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{getRoleLabel(team.role)}</TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {!team.is_self ? (
                        <Stack direction="row" gap={1}>
                          {getNextRole(team.role) ? (
                            <button
                              type="button"
                              className="button small action"
                              onClick={() => handleOpenRoleDialog(team)}
                            >
                              역할 변경
                            </button>
                          ) : null}
                          {team.role === 'member' || team.role === 'observer' ? (
                            <button
                              type="button"
                              className="button small action"
                              onClick={() => handleOpenObserverDialog(team)}
                            >
                              {team.role === 'observer' ? '팀원으로 변경' : '차단'}
                            </button>
                          ) : null}
                        </Stack>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isOwnerTransferOpen}
              onClose={handleCloseOwnerTransfer}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              <h2>운영자 교체</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseOwnerTransfer}
                aria-label="운영자 교체 창 닫기"
                disabled={isOwnerTransferSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <Typography variant="body2">
                  선택한 팀원이 수락하면 운영자 권한이 이전되고 현재 운영자는 일반 팀원이 됩니다.
                </Typography>
                <Stack gap={1}>
                  <Typography variant="subtitle2">새 운영자</Typography>
                  <TextField
                    select
                    value={ownerTransferTargetId}
                    onChange={(event) => setOwnerTransferTargetId(event.target.value)}
                    size="small"
                    fullWidth
                    InputProps={{ startAdornment: <SelectCheckAdornment /> }}
                  >
                    <MenuItem value="" disabled>
                      새 운영자 선택
                    </MenuItem>
                    {sortedTeams
                      .filter(
                        (team) => !team.is_self && team.role !== 'owner' && team.role !== 'observer',
                      )
                      .map((team) => (
                        <MenuItem key={team.id} value={team.id}>
                          {team.name}
                        </MenuItem>
                      ))}
                  </TextField>
                </Stack>
              </div>
              <div className="drawer-dialog-actions">
                <button
                  type="button"
                  className="button small cancel"
                  onClick={handleCloseOwnerTransfer}
                  disabled={isOwnerTransferSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button small submit"
                  onClick={handleSubmitOwnerTransfer}
                  disabled={!ownerTransferTargetId || isOwnerTransferSubmitting}
                >
                  요청하기
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={isOwnerTransferOpen}
              onClose={handleCloseOwnerTransfer}
              fullWidth
              maxWidth="xs"
              className="vh-dialog vh-alert-dialog"
            >
              <DialogTitle>운영자 교체</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseOwnerTransfer}
                aria-label="운영자 교체 창 닫기"
                disabled={isOwnerTransferSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2}>
                  <Typography variant="body2">
                    선택한 팀원이 수락하면 운영자 권한이 이전되고 현재 운영자는 일반 팀원이 됩니다.
                  </Typography>
                  <Stack gap={1}>
                    <Typography variant="subtitle2">새 운영자</Typography>
                    <TextField
                      select
                      name="role"
                      required
                      value={ownerTransferTargetId}
                      onChange={(event) => setOwnerTransferTargetId(event.target.value)}
                      size="small"
                      fullWidth
                      InputProps={{ startAdornment: <SelectCheckAdornment /> }}
                    >
                      <MenuItem value="" disabled>
                        새 운영자 선택
                      </MenuItem>
                      {sortedTeams
                        .filter(
                          (team) =>
                            !team.is_self && team.role !== 'owner' && team.role !== 'observer',
                        )
                        .map((team) => (
                          <MenuItem key={team.id} value={team.id}>
                            {team.name}
                          </MenuItem>
                        ))}
                    </TextField>
                  </Stack>
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCloseOwnerTransfer}
                  disabled={isOwnerTransferSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleSubmitOwnerTransfer}
                  disabled={!ownerTransferTargetId || isOwnerTransferSubmitting}
                >
                  요청하기
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(inviteErrorMessage)}
              onClose={() => {
                setInviteEmailError(pendingInviteEmailError);
                setInviteErrorMessage('');
              }}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              {inviteErrorTitle ? <h2>{inviteErrorTitle}</h2> : null}
              <button
                type="button"
                className="close-button"
                onClick={() => {
                  setInviteEmailError(pendingInviteEmailError);
                  setInviteErrorMessage('');
                }}
                aria-label="닫기"
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <ul>
                  <li>{inviteErrorMessage}</li>
                </ul>
              </div>
              <div className="drawer-dialog-actions">
                <button
                  type="button"
                  className="button small cancel"
                  onClick={() => {
                    setInviteEmailError(pendingInviteEmailError);
                    setInviteErrorMessage('');
                  }}
                >
                  확인
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(inviteErrorMessage)}
              onClose={() => {
                setInviteEmailError(pendingInviteEmailError);
                setInviteErrorMessage('');
              }}
              fullWidth
              maxWidth="xs"
              className="vh-dialog vh-alert-dialog"
            >
              {inviteErrorTitle ? <DialogTitle>{inviteErrorTitle}</DialogTitle> : null}
              <button
                type="button"
                className="close-button"
                onClick={() => {
                  setInviteEmailError(pendingInviteEmailError);
                  setInviteErrorMessage('');
                }}
                aria-label="닫기"
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <ul>
                  <li>{inviteErrorMessage}</li>
                </ul>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  onClick={() => {
                    setInviteEmailError(pendingInviteEmailError);
                    setInviteErrorMessage('');
                  }}
                >
                  확인
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(selectedTeam)}
              onClose={handleCloseDetail}
              className="VhiDrawer-bottom"
            >
              <h2>팀블로그 정보</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseDetail}
                aria-label="팀블로그 정보 창 닫기"
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                {selectedTeam ? (
                  <Stack gap={2} sx={{ pt: 1 }}>
                    <Box>
                      <Typography variant="subtitle2">이메일</Typography>
                      <Typography variant="body2">{maskEmail(selectedTeam.email)}</Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2">별명</Typography>
                      <Typography variant="body2">{selectedTeam.name}</Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2">가입일</Typography>
                      <Typography variant="body2">{formatDateTimeFull(selectedTeam.approval_at)}</Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2">역할</Typography>
                      <Typography variant="body2">{getRoleLabel(selectedTeam.role)}</Typography>
                    </Box>

                  </Stack>
                ) : null}
              </div>
              <div className="drawer-dialog-actions">
                <button type="button" className="button medium cancel" onClick={handleCloseDetail}>
                  닫기
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(selectedTeam)}
              onClose={handleCloseDetail}
              fullWidth
              maxWidth="sm"
              className="VhiDialog"
            >
              <DialogTitle>팀블로그 정보</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseDetail}
                aria-label="팀블로그 정보 창 닫기"
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                {selectedTeam ? (
                  <Stack gap={2} sx={{ pt: 1 }}>
                    <Box>
                      <Typography variant="subtitle2">이메일</Typography>
                      <Typography variant="body2">{maskEmail(selectedTeam.email)}</Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2">별명</Typography>
                      <Typography variant="body2">{selectedTeam.name}</Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2">가입일</Typography>
                      <Typography variant="body2">{formatDateTimeFull(selectedTeam.approval_at)}</Typography>
                    </Box>

                    <Box>
                      <Typography variant="subtitle2">역할</Typography>
                      <Typography variant="body2">{getRoleLabel(selectedTeam.role)}</Typography>
                    </Box>

                  </Stack>
                ) : null}
              </DialogContent>
              <DialogActions>
                <button type="button" className="button medium close" onClick={handleCloseDetail}>
                  닫기
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(targetRoleTeam)}
              onClose={handleCloseRoleDialog}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              <h2>
                {nextRole === 'observer'
                  ? '팀원 차단'
                  : targetRoleTeam?.role === 'observer'
                    ? '팀원으로 변경'
                    : '역할 변경'}
              </h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseRoleDialog}
                aria-label="역할 변경 창 닫기"
                disabled={isRoleSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <Typography>
                  {nextRole === 'observer' ? (
                    <>
                      차단 시 보기만 가능한 옵저버 등급이 됩니다.
                      <br />
                      차단하시겠습니까?
                    </>
                  ) : targetRoleTeam?.role === 'observer' ? (
                    <>
                      이 옵저버를 다시 팀원으로 변경합니다.
                      <br />
                      팀원으로 변경시 글 쓰기, 본인 글 수정이 가능합니다.
                    </>
                  ) : (
                    <>해당 유저를 {nextRole ? getRoleLabel(nextRole) : ''}로 변경하시겠어요?</>
                  )}
                </Typography>
              </div>
              <div className="drawer-dialog-actions">
                <button
                  type="button"
                  className="button small cancel"
                  onClick={handleCloseRoleDialog}
                  disabled={isRoleSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button small submit"
                  onClick={handleSubmitRole}
                  disabled={isRoleSubmitting}
                >
                  {nextRole === 'observer' ? '차단' : targetRoleTeam?.role === 'observer' ? '변경' : '역할 변경'}
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(targetRoleTeam)}
              onClose={handleCloseRoleDialog}
              fullWidth
              maxWidth="xs"
              className="vh-dialog vh-alert-dialog"
            >
              <DialogTitle>
                {nextRole === 'observer'
                  ? '팀원 차단'
                  : targetRoleTeam?.role === 'observer'
                    ? '팀원으로 변경'
                    : '역할 변경'}
              </DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseRoleDialog}
                disabled={isRoleSubmitting}
                aria-label="역할 변경 창 닫기"
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Typography>
                  {nextRole === 'observer' ? (
                    <>
                      차단 시 보기만 가능한 옵저버 등급이 됩니다.
                      <br />
                      차단하시겠습니까?
                    </>
                  ) : targetRoleTeam?.role === 'observer' ? (
                    <>
                      이 옵저버를 다시 팀원으로 변경합니다.
                      <br />
                      팀원으로 변경시 글 쓰기, 본인 글 수정이 가능합니다.
                    </>
                  ) : (
                    <>해당 유저를 {nextRole ? getRoleLabel(nextRole) : ''}로 변경하시겠어요?</>
                  )}
                </Typography>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCloseRoleDialog}
                  disabled={isRoleSubmitting}
                >
                  취소
                </button>
                <button type="button" onClick={handleSubmitRole} disabled={isRoleSubmitting}>
                  {nextRole === 'observer' ? '차단' : targetRoleTeam?.role === 'observer' ? '변경' : '역할 변경'}
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isInviteDialogOpen}
              onClose={handleCloseInviteDialog}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              <h2>팀원 초대</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseInviteDialog}
                aria-label="초대 창 닫기"
                disabled={isInviteSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <Box
                  id="team-invite-form"
                  component="form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmitInvite();
                  }}
                >
                  <Stack gap={1}>
                    <Stack>
                      <Typography variant="subtitle2">이메일</Typography>
                      <TextField
                        placeholder="초대할 팀원의 이메일을 입력해주세요."
                        name="email"
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(event) => {
                          setInviteEmail(event.target.value);
                          setInviteEmailError('');
                          setPendingInviteEmailError('');
                        }}
                        onInvalid={(event) => {
                          event.preventDefault();
                          const input = event.currentTarget as HTMLInputElement;
                          const message = input.validity.valueMissing
                            ? '이메일을 입력해 주세요.'
                            : '올바른 이메일 형식으로 입력해 주세요.';
                          setPendingInviteEmailError(message);
                          setInviteErrorMessage(message);
                        }}
                        error={Boolean(inviteEmailError)}
                        helperText={inviteEmailError}
                        fullWidth
                        size="small"
                      />
                    </Stack>

                    <Stack>
                      <Typography variant="subtitle2">역할</Typography>
                      <TextField
                        select
                        name="role"
                        required
                        value={inviteRole}
                        onChange={(event) => setInviteRole(event.target.value as 'manager' | 'member')}
                        fullWidth
                        size="small"
                        InputProps={{ startAdornment: <SelectCheckAdornment /> }}
                      >
                        <MenuItem value="manager">매니저</MenuItem>
                        <MenuItem value="member">멤버</MenuItem>
                      </TextField>
                    </Stack>
                  </Stack>
                </Box>
              </div>
              <div className="drawer-dialog-actions">
                <button
                  type="submit"
                  form="team-invite-form"
                  className="button small cancel"
                  onClick={handleCloseInviteDialog}
                  disabled={isInviteSubmitting}
                >
                  취소
                </button>
                <button
                  type="submit"
                  form="team-invite-form"
                  className="button small submit"
                  disabled={isInviteSubmitting}
                >
                  초대하기
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={isInviteDialogOpen}
              onClose={handleCloseInviteDialog}
              fullWidth
              maxWidth="sm"
              className="vh-dialog vh-alert-dialog"
            >
              <DialogTitle>팀원 초대</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseInviteDialog}
                aria-label="초대 창 닫기"
                disabled={isInviteSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Box
                  id="team-invite-form-desktop"
                  component="form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSubmitInvite();
                  }}
                >
                  <Stack gap={1}>
                    <Stack>
                      <Typography variant="subtitle2">이메일</Typography>
                      <TextField
                        placeholder="초대할 팀원의 이메일을 입력해주세요."
                        name="email"
                        type="email"
                        required
                        value={inviteEmail}
                        onChange={(event) => {
                          setInviteEmail(event.target.value);
                          setInviteEmailError('');
                          setPendingInviteEmailError('');
                        }}
                        onInvalid={(event) => {
                          event.preventDefault();
                          const input = event.currentTarget as HTMLInputElement;
                          const message = input.validity.valueMissing
                            ? '이메일을 입력해 주세요.'
                            : '올바른 이메일 형식으로 입력해 주세요.';
                          setPendingInviteEmailError(message);
                          setInviteErrorMessage(message);
                        }}
                        error={Boolean(inviteEmailError)}
                        helperText={inviteEmailError}
                        fullWidth
                        size="small"
                      />
                    </Stack>

                    <Stack>
                      <Typography variant="subtitle2">역할</Typography>
                      <TextField
                        select
                        value={inviteRole}
                        onChange={(event) => setInviteRole(event.target.value as 'manager' | 'member')}
                        fullWidth
                        size="small"
                        InputProps={{ startAdornment: <SelectCheckAdornment /> }}
                      >
                        <MenuItem value="manager">매니저</MenuItem>
                        <MenuItem value="member">멤버</MenuItem>
                      </TextField>
                    </Stack>
                  </Stack>
                </Box>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCloseInviteDialog}
                  disabled={isInviteSubmitting}
                >
                  취소
                </button>
                <button type="submit" form="team-invite-form-desktop" disabled={isInviteSubmitting}>
                  초대하기
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isInviteListDialogOpen}
              onClose={handleCloseInviteListDialog}
              className="VhiDrawer-bottom"
            >
              <h2>초대 현황</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseInviteListDialog}
                aria-label="초대 현황 창 닫기"
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <div className={`paper ${styles.paper}`}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>초대 이메일</TableCell>
                        <TableCell>역할</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>상태</TableCell>
                        <TableCell>유효일</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedInvites.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{maskEmail(invite.email)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{getRoleLabel(invite.role)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{getInviteStatusLabel(invite.status)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeFull(invite.expires_at)}</TableCell>
                          <TableCell>
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
                    </TableBody>
                  </Table>
                </div>
              </div>
              <div className="drawer-dialog-actions">
                <button type="button" className="button medium cancel" onClick={handleCloseInviteListDialog}>
                  닫기
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={isInviteListDialogOpen}
              onClose={handleCloseInviteListDialog}
              fullWidth
              maxWidth="md"
              className="VhiDialog"
            >
              <DialogTitle>초대 현황</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseInviteListDialog}
                aria-label="초대 현황 창 닫기"
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <div className={`paper ${styles.paper}`}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>초대 이메일</TableCell>
                        <TableCell>역할</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>상태</TableCell>
                        <TableCell>유효일</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedInvites.map((invite) => (
                        <TableRow key={invite.id}>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{maskEmail(invite.email)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{getRoleLabel(invite.role)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{getInviteStatusLabel(invite.status)}</TableCell>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeFull(invite.expires_at)}</TableCell>
                          <TableCell>
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
                    </TableBody>
                  </Table>
                </div>
              </DialogContent>
              <DialogActions>
                <button type="button" className="button medium close" onClick={handleCloseInviteListDialog}>
                  닫기
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(targetInvite)}
              onClose={handleCloseCancelDialog}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              <h2>초대 취소</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseCancelDialog}
                aria-label="초대 취소 창 닫기"
                disabled={isCancelSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <Typography>
                  정말로 초대를 취소하시겠습니까?
                  <br />
                  취소된 초대장은 상대방이 더이상 이용이 불가합니다.
                </Typography>
              </div>
              <div className="drawer-dialog-actions">
                <button
                  type="button"
                  className="button small cancel"
                  onClick={handleCloseCancelDialog}
                  disabled={isCancelSubmitting}
                >
                  초대 유지
                </button>
                <button
                  type="button"
                  className="button small warning"
                  onClick={handleSubmitCancelInvite}
                  disabled={isCancelSubmitting}
                >
                  초대 취소
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(targetInvite)}
              onClose={handleCloseCancelDialog}
              fullWidth
              maxWidth="xs"
              className="vh-dialog vh-alert-dialog"
            >
              <DialogTitle>초대 취소</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseCancelDialog}
                aria-label="초대 취소 창 닫기"
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Typography>
                  정말로 초대를 취소하시겠습니까?
                  <br />
                  취소된 초대장은 상대방이 더이상 이용이 불가합니다.
                </Typography>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="cancel-button"
                  onClick={handleCloseCancelDialog}
                  disabled={isCancelSubmitting}
                >
                  초대 유지
                </button>
                <button
                  type="button"
                  className="warning-button"
                  onClick={handleSubmitCancelInvite}
                  disabled={isCancelSubmitting}
                >
                  초대 취소
                </button>
              </DialogActions>
            </Dialog>
          )}
        </div>
      </div>
      <FormErrorDialog
        open={isErrorDialogOpen}
        onClose={() => setIsErrorDialogOpen(false)}
        title={errorDialogTitle}
        messages={errorMessage ? errorMessage.split('\n') : []}
      />
    </Container>
  );
}
