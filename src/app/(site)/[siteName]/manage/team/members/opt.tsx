/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  MenuItem,
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
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { formatDateTimeFull, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type TeamRole = 'owner' | 'manager' | 'member';

type TeamRow = {
  id: string;
  email: string;
  name: string;
  approval_at: string | null;
  role: TeamRole;
  is_block: boolean;
  blocked_at: string | null;
  block_count: number;
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

type TeamResponse = {
  teams: TeamRow[];
};

type InviteResponse = {
  invites: InviteRow[];
};

type PatchResponse = {
  ok: boolean;
  team: {
    id: string;
    role: TeamRole;
    is_block: boolean;
    blocked_at: string | null;
    block_count: number;
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

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null);
  const [targetTeam, setTargetTeam] = useState<TeamRow | null>(null);
  const [nextBlockState, setNextBlockState] = useState<boolean | null>(null);
  const [targetRoleTeam, setTargetRoleTeam] = useState<TeamRow | null>(null);
  const [nextRole, setNextRole] = useState<'manager' | 'member' | null>(null);
  const [targetInvite, setTargetInvite] = useState<InviteRow | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('manager');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isInviteListDialogOpen, setIsInviteListDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  async function loadTeams() {
    const response = await fetch(`/api/manage/team/members?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as TeamResponse | { error?: string };

    if (!response.ok) {
      throw new Error(
        'error' in result
          ? result.error || '팀블로그 목록을 불러오지 못했습니다.'
          : '팀블로그 목록을 불러오지 못했습니다.',
      );
    }

    setTeams('teams' in result && Array.isArray(result.teams) ? result.teams : []);
  }

  async function loadInvites() {
    const response = await fetch(`/api/manage/team/members/invite?siteName=${siteName}`, {
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
      await Promise.all([loadTeams(), loadInvites()]);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '팀원 설정 정보를 불러오지 못했습니다.');
      } else {
        setErrorMessage('팀원 설정 정보를 불러오지 못했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, [siteName]);

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

  function handleCloseDetail() {
    setSelectedTeam(null);
  }

  function handleOpenBlockDialog(team: TeamRow, isBlock: boolean) {
    setTargetTeam(team);
    setNextBlockState(isBlock);
  }

  function handleCloseBlockDialog() {
    if (isSubmitting) {
      return;
    }

    setTargetTeam(null);
    setNextBlockState(null);
  }

  function handleOpenRoleDialog(team: TeamRow) {
    const role = getNextRole(team.role);

    if (!role) {
      return;
    }

    setTargetRoleTeam(team);
    setNextRole(role);
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
  }

  function handleOpenInviteListDialog() {
    setIsInviteListDialogOpen(true);
  }

  function handleCloseInviteListDialog() {
    setIsInviteListDialogOpen(false);
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
        throw new Error('error' in result ? result.error || '역할 변경에 실패했습니다.' : '역할 변경에 실패했습니다.');
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
                is_block: result.team.is_block,
                blocked_at: result.team.blocked_at,
                block_count: Number(result.team.block_count ?? 0),
              }
            : team,
        ),
      );

      setSelectedTeam((previousSelectedTeam) =>
        previousSelectedTeam && previousSelectedTeam.id === result.team.id
          ? {
              ...previousSelectedTeam,
              role: result.team.role,
              is_block: result.team.is_block,
              blocked_at: result.team.blocked_at,
              block_count: Number(result.team.block_count ?? 0),
            }
          : previousSelectedTeam,
      );

      setTargetRoleTeam(null);
      setNextRole(null);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '역할 변경에 실패했습니다.');
      } else {
        setErrorMessage('역할 변경에 실패했습니다.');
      }
    } finally {
      setIsRoleSubmitting(false);
    }
  }

  async function handleSubmitBlock() {
    if (!targetTeam || typeof nextBlockState !== 'boolean') {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch('/api/manage/team/members', {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          siteName,
          teamId: targetTeam.id,
          isBlock: nextBlockState,
        }),
      });

      const result = (await response.json()) as PatchResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          'error' in result ? result.error || '차단 상태 변경에 실패했습니다.' : '차단 상태 변경에 실패했습니다.',
        );
      }

      if (!('team' in result) || !result.team) {
        throw new Error('차단 상태 변경에 실패했습니다.');
      }

      setTeams((previousTeams) =>
        previousTeams.map((team) =>
          team.id === result.team.id
            ? {
                ...team,
                role: result.team.role,
                is_block: result.team.is_block,
                blocked_at: result.team.blocked_at,
                block_count: Number(result.team.block_count ?? 0),
              }
            : team,
        ),
      );

      setSelectedTeam((previousSelectedTeam) =>
        previousSelectedTeam && previousSelectedTeam.id === result.team.id
          ? {
              ...previousSelectedTeam,
              role: result.team.role,
              is_block: result.team.is_block,
              blocked_at: result.team.blocked_at,
              block_count: Number(result.team.block_count ?? 0),
            }
          : previousSelectedTeam,
      );

      setTargetTeam(null);
      setNextBlockState(null);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '차단 상태 변경에 실패했습니다.');
      } else {
        setErrorMessage('차단 상태 변경에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmitInvite() {
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
          email: inviteEmail,
          role: inviteRole,
        }),
      });

      const result = (await response.json()) as CreateInviteResponse | { error?: string };

      if (!response.ok) {
        throw new Error('error' in result ? result.error || '초대를 실패했습니다.' : '초대를 실패했습니다.');
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
        setErrorMessage(unknownError.message || '초대를 실패했습니다.');
      } else {
        setErrorMessage('초대를 실패했습니다.');
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
        throw new Error('error' in result ? result.error || '초대 취소에 실패했습니다.' : '초대 취소에 실패했습니다.');
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
      <Container pageTitle="팀원 관리" pageBack={`/${siteName}/manage`} menu="team">
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
    <Container pageTitle="팀원 관리" pageBack={`/${siteName}/manage`} menu="team">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          <Stack direction="row" justifyContent="flex-end" gap={1} sx={{ p: 2, pb: 0 }}>
            <button
              type="button"
              className="button small cancel"
              disabled={!isLoading && sortedInvites.length === 0}
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
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>차단 여부</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedTeams.map((team) => (
                  <TableRow key={team.id} hover onClick={() => handleOpenDetail(team)} sx={{ cursor: 'pointer' }}>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{team.email}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{team.name}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeFull(team.approval_at)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{getRoleLabel(team.role)}</TableCell>
                    <TableCell>
                      {team.is_block ? (
                        <Chip color="error" label="차단됨" size="small" />
                      ) : (
                        <Chip label="정상" size="small" />
                      )}
                    </TableCell>
                    <TableCell onClick={(event) => event.stopPropagation()}>
                      {!team.is_self ? (
                        <Stack direction="row" gap={1}>
                          {team.role !== 'owner' ? (
                            <button
                              type="button"
                              className="button small action"
                              onClick={() => handleOpenRoleDialog(team)}
                            >
                              역할 변경
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className={`button small ${team.is_block ? 'action' : 'warning'}`}
                            onClick={() => handleOpenBlockDialog(team, !team.is_block)}
                          >
                            {team.is_block ? '차단풀기' : '차단하기'}
                          </button>
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
              open={Boolean(selectedTeam)}
              onClose={handleCloseDetail}
              className="VhiDrawer-bottom"
            >
              <h2>팀블로그 정보</h2>
              <button className="close-button" onClick={handleCloseDetail} aria-label="팀블로그 정보 창 닫기">
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                {selectedTeam ? (
                  <Stack gap={2} sx={{ pt: 1 }}>
                    <Box>
                      <Typography variant="subtitle2">이메일</Typography>
                      <Typography variant="body2">{selectedTeam.email}</Typography>
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

                    <Box>
                      <Typography variant="subtitle2">차단 여부</Typography>
                      <Typography variant="body2">{selectedTeam.is_block ? '차단됨' : '정상'}</Typography>
                    </Box>

                    {selectedTeam.is_block ? (
                      <Box>
                        <Typography variant="subtitle2">차단일</Typography>
                        <Typography variant="body2">{formatDateTimeFull(selectedTeam.blocked_at)}</Typography>
                      </Box>
                    ) : null}
                    {selectedTeam.block_count >= 1 ? (
                      <Box>
                        <Typography variant="subtitle2">차단 횟수</Typography>
                        <Typography variant="body2">{selectedTeam.block_count}회 차단</Typography>
                      </Box>
                    ) : null}
                  </Stack>
                ) : null}
                <Stack direction="column" gap={1.5}>
                  <button type="button" className="button medium cancel" onClick={handleCloseDetail}>
                    닫기
                  </button>
                </Stack>
              </Stack>
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
              <button className="close-button" onClick={handleCloseDetail} aria-label="팀블로그 정보 창 닫기">
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                {selectedTeam ? (
                  <Stack gap={2} sx={{ pt: 1 }}>
                    <Box>
                      <Typography variant="subtitle2">이메일</Typography>
                      <Typography variant="body2">{selectedTeam.email}</Typography>
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

                    <Box>
                      <Typography variant="subtitle2">차단 여부</Typography>
                      <Typography variant="body2">{selectedTeam.is_block ? '차단됨' : '정상'}</Typography>
                    </Box>

                    {selectedTeam.is_block ? (
                      <Box>
                        <Typography variant="subtitle2">차단일</Typography>
                        <Typography variant="body2">{formatDateTimeFull(selectedTeam.blocked_at)}</Typography>
                      </Box>
                    ) : null}
                    {selectedTeam.block_count >= 1 ? (
                      <Box>
                        <Typography variant="subtitle2">차단 횟수</Typography>
                        <Typography variant="body2">{selectedTeam.block_count}회 차단</Typography>
                      </Box>
                    ) : null}
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
              className="VhiDrawer-bottom"
            >
              <h2>역할 변경</h2>
              <button
                className="close-button"
                onClick={handleCloseRoleDialog}
                airia-label="역할 변경 창 닫기"
                disabled={isRoleSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                <Typography>해당 유저를 {nextRole ? getRoleLabel(nextRole) : ''}로 변경하시겠어요?</Typography>

                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseRoleDialog}
                    disabled={isRoleSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={handleSubmitRole}
                    disabled={isRoleSubmitting}
                  >
                    역할 변경
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(targetRoleTeam)}
              onClose={handleCloseRoleDialog}
              fullWidth
              maxWidth="xs"
              className="VhiDialog"
            >
              <DialogTitle>역할 변경</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseRoleDialog}
                disabled={isRoleSubmitting}
                aria-label="역할 변경 창 닫기"
              >
                <CloseRoundedIcon />
              </button>

              <DialogContent>
                <Typography>해당 유저를 {nextRole ? getRoleLabel(nextRole) : ''}로 변경하시겠어요?</Typography>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseRoleDialog}
                  disabled={isRoleSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={handleSubmitRole}
                  disabled={isRoleSubmitting}
                >
                  역할 변경
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(targetTeam)}
              onClose={handleCloseBlockDialog}
              className="VhiDrawer-bottom"
            >
              <h2>{nextBlockState ? '팀원 차단' : '팀원 차단 해제'}</h2>
              <button
                className="close-button"
                onClick={handleCloseBlockDialog}
                disabled={isSubmitting}
                aria-label={nextBlockState ? '팀원 차단 창 닫기' : '팀원 차단 해제 창 닫기'}
              >
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                <Typography>
                  {nextBlockState ? (
                    <>
                      정말로{' '}
                      <strong style={{ fontWeight: 700, fontVariationSettings: '"wght" 700' }}>
                        {targetTeam?.name} 님
                      </strong>
                      을 차단하시겠습니까?
                      <br />
                      차단된 팀원은 더 이상 글을 쓰실 수 없습니다.
                    </>
                  ) : (
                    <>
                      정말로{' '}
                      <strong style={{ fontWeight: 700, fontVariationSettings: '"wght" 700' }}>
                        {targetTeam?.name} 님
                      </strong>
                      의 차단을 해제하시겠습니까?
                      <br />
                      차단이 해제되면 다시 글을 쓰실 수 있습니다.
                    </>
                  )}
                </Typography>
                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseBlockDialog}
                    disabled={isSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium warning"
                    onClick={handleSubmitBlock}
                    disabled={isSubmitting}
                  >
                    {nextBlockState ? '차단' : '차단 해제'}
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(targetTeam)}
              onClose={handleCloseBlockDialog}
              fullWidth
              maxWidth="xs"
              className="VhiDialog"
            >
              <DialogTitle>{nextBlockState ? '팀원 차단' : '팀원 차단 해제'}</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseBlockDialog}
                disabled={isSubmitting}
                aria-label={nextBlockState ? '팀원 차단 창 닫기' : '팀원 차단 해제 창 닫기'}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Typography>
                  {nextBlockState ? (
                    <>
                      정말로{' '}
                      <strong style={{ fontWeight: 700, fontVariationSettings: '"wght" 700' }}>
                        {targetTeam?.name} 님
                      </strong>
                      을 차단하시겠습니까?
                      <br />
                      차단된 팀원은 더 이상 글을 쓰실 수 없습니다.
                    </>
                  ) : (
                    <>
                      정말로{' '}
                      <strong style={{ fontWeight: 700, fontVariationSettings: '"wght" 700' }}>
                        {targetTeam?.name} 님
                      </strong>
                      의 차단을 해제하시겠습니까?
                      <br />
                      차단이 해제되면 다시 글을 쓰실 수 있습니다.
                    </>
                  )}
                </Typography>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseBlockDialog}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button medium warning"
                  onClick={handleSubmitBlock}
                  disabled={isSubmitting}
                >
                  {nextBlockState ? '차단' : '차단 해제'}
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isInviteDialogOpen}
              onClose={handleCloseInviteDialog}
              className="VhiDrawer-bottom"
            >
              <h2>팀원 초대</h2>
              <button
                className="close-button"
                onClick={handleCloseInviteDialog}
                aria-label="초대 창 닫기"
                disabled={isInviteSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                <Stack gap={1}>
                  <Stack>
                    <Typography variant="subtitle2">이메일</Typography>
                    <TextField
                      placeholder="초대할 팀원의 이메일을 입력해주세요."
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
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
                    >
                      <MenuItem value="manager">매니저</MenuItem>
                      <MenuItem value="member">멤버</MenuItem>
                    </TextField>
                  </Stack>
                </Stack>
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
                    onClick={handleSubmitInvite}
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
              <DialogTitle>팀원 초대</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseInviteDialog}
                aria-label="초대 창 닫기"
                disabled={isInviteSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={1}>
                  <Stack>
                    <Typography variant="subtitle2">이메일</Typography>
                    <TextField
                      placeholder="초대할 팀원의 이메일을 입력해주세요."
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
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
                    >
                      <MenuItem value="manager">매니저</MenuItem>
                      <MenuItem value="member">멤버</MenuItem>
                    </TextField>
                  </Stack>
                </Stack>
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
                  onClick={handleSubmitInvite}
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
              open={isInviteListDialogOpen}
              onClose={handleCloseInviteListDialog}
              className="VhiDrawer-bottom"
            >
              <h2>초대 현황</h2>
              <button className="close-button" onClick={handleCloseInviteListDialog} aria-label="초대 현황 창 닫기">
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
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
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{invite.email}</TableCell>
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
                <Stack direction="column" gap={1.5}>
                  <button type="button" className="button medium cancel" onClick={handleCloseInviteListDialog}>
                    닫기
                  </button>
                </Stack>
              </Stack>
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
              <button className="close-button" onClick={handleCloseInviteListDialog} aria-label="초대 현황 창 닫기">
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
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>{invite.email}</TableCell>
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
              className="VhiDrawer-bottom"
            >
              <h2>초대 취소</h2>
              <button
                className="close-button"
                onClick={handleCloseCancelDialog}
                aria-label="초대 취소 창 닫기"
                disabled={isCancelSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                <Typography>
                  정말로 초대를 취소하시겠습니까?
                  <br />
                  취소된 초대장은 상대방이 더이상 이용이 불가합니다.
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
                    className="button medium warning"
                    onClick={handleSubmitCancelInvite}
                    disabled={isCancelSubmitting}
                  >
                    초대 취소
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(targetInvite)}
              onClose={handleCloseCancelDialog}
              fullWidth
              maxWidth="xs"
              className="VhiDialog"
            >
              <DialogTitle>초대 취소</DialogTitle>
              <button className="close-button" onClick={handleCloseCancelDialog} aria-label="초대 취소 창 닫기">
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
                  className="button medium close"
                  onClick={handleCloseCancelDialog}
                  disabled={isCancelSubmitting}
                >
                  초대 유지
                </button>
                <button
                  type="button"
                  className="button medium warning"
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
    </Container>
  );
}
