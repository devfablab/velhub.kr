/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDateTimeFull, normalizeText } from '@/lib/utils';

type TeamRow = {
  id: string;
  email: string;
  name: string;
  approval_at: string | null;
  role: string;
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

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamRow | null>(null);
  const [targetTeam, setTargetTeam] = useState<TeamRow | null>(null);
  const [nextBlockState, setNextBlockState] = useState<boolean | null>(null);
  const [targetInvite, setTargetInvite] = useState<InviteRow | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'manager' | 'member'>('manager');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [isCancelSubmitting, setIsCancelSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  async function loadTeams() {
    const response = await fetch(`/api/team/members?siteName=${encodeURIComponent(siteName)}`, {
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
    const response = await fetch(`/api/team/members/invite?siteName=${encodeURIComponent(siteName)}`, {
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

  function handleOpenCancelDialog(invite: InviteRow) {
    setTargetInvite(invite);
  }

  function handleCloseCancelDialog() {
    if (isCancelSubmitting) {
      return;
    }

    setTargetInvite(null);
  }

  async function handleSubmitBlock() {
    if (!targetTeam || typeof nextBlockState !== 'boolean') {
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      const response = await fetch('/api/team/members', {
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

      const response = await fetch('/api/team/members/invite', {
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

      const response = await fetch('/api/team/members/invite', {
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

  return (
    <Stack spacing={3}>
      {isNotMobile && (
        <Typography variant="h5" component="h1">
          팀원 목록
        </Typography>
      )}

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">팀원 초대</Typography>

          <Stack spacing={2}>
            <TextField
              label="이메일"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              fullWidth
              size="small"
            />

            <TextField
              select
              label="역할"
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value as 'manager' | 'member')}
              fullWidth
              size="small"
            >
              <MenuItem value="manager">매니저</MenuItem>
              <MenuItem value="member">멤버</MenuItem>
            </TextField>

            <Box>
              <Button type="button" variant="contained" onClick={handleSubmitInvite} disabled={isInviteSubmitting}>
                초대하기
              </Button>
            </Box>
          </Stack>
        </Stack>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>이메일</TableCell>
              <TableCell>이름</TableCell>
              <TableCell>가입일</TableCell>
              <TableCell>역할</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>차단 여부</TableCell>
              <TableCell colSpan={2}>관리</TableCell>
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
                    <Stack direction="row" spacing={1}>
                      <Button
                        type="button"
                        size="small"
                        variant="outlined"
                        sx={{ whiteSpace: 'nowrap' }}
                        color="secondary"
                      >
                        역할 변경
                      </Button>
                      <Button
                        type="button"
                        variant="outlined"
                        size="small"
                        sx={{ whiteSpace: 'nowrap' }}
                        color={team.is_block ? 'inherit' : 'error'}
                        onClick={() => handleOpenBlockDialog(team, !team.is_block)}
                      >
                        {team.is_block ? '차단풀기' : '차단하기'}
                      </Button>
                    </Stack>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!isLoading && sortedInvites.length === 0 ? (
        <Alert variant="filled" severity="info">
          등록된 초대가 없습니다.
        </Alert>
      ) : null}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>초대 이메일</TableCell>
              <TableCell>역할</TableCell>
              <TableCell>상태</TableCell>
              <TableCell>유효일</TableCell>
              <TableCell>취소</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedInvites.map((invite) => (
              <TableRow key={invite.id}>
                <TableCell>{invite.email}</TableCell>
                <TableCell>{getRoleLabel(invite.role)}</TableCell>
                <TableCell>{getInviteStatusLabel(invite.status)}</TableCell>
                <TableCell>{formatDateTimeFull(invite.expires_at)}</TableCell>
                <TableCell>
                  {invite.status === 'pending' ? (
                    <Button
                      type="button"
                      variant="outlined"
                      color="inherit"
                      onClick={() => handleOpenCancelDialog(invite)}
                    >
                      취소
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={Boolean(selectedTeam)} onClose={handleCloseDetail} fullWidth maxWidth="sm">
        <DialogTitle>팀블로그 정보</DialogTitle>
        <DialogContent>
          {selectedTeam ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box>
                <Typography variant="body2">이메일</Typography>
                <Typography>{selectedTeam.email}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">이름</Typography>
                <Typography>{selectedTeam.name}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">가입일</Typography>
                <Typography>{formatDateTimeFull(selectedTeam.approval_at)}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">역할</Typography>
                <Typography>{getRoleLabel(selectedTeam.role)}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">차단 여부</Typography>
                <Typography>{selectedTeam.is_block ? '차단됨' : '차단안됨'}</Typography>
              </Box>

              {selectedTeam.is_block ? (
                <>
                  <Box>
                    <Typography variant="body2">차단일</Typography>
                    <Typography>{formatDateTimeFull(selectedTeam.blocked_at)}</Typography>
                  </Box>

                  {selectedTeam.block_count >= 1 ? (
                    <Box>
                      <Typography variant="body2">차단 횟수</Typography>
                      <Typography>{selectedTeam.block_count}회 차단됨</Typography>
                    </Box>
                  ) : null}
                </>
              ) : null}
            </Stack>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseDetail}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(targetTeam)} onClose={handleCloseBlockDialog} fullWidth maxWidth="xs">
        <DialogTitle>{nextBlockState ? '차단하기' : '차단풀기'}</DialogTitle>
        <DialogContent>
          <Typography>정말로 차단 상태를 변경할거냐고 물어봐야 함.</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCloseBlockDialog} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="button" variant="contained" color="error" onClick={handleSubmitBlock} disabled={isSubmitting}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(targetInvite)} onClose={handleCloseCancelDialog} fullWidth maxWidth="xs">
        <DialogTitle>초대 취소</DialogTitle>
        <DialogContent>
          <Typography>정말로 초대를 취소하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCloseCancelDialog} disabled={isCancelSubmitting}>
            취소
          </Button>
          <Button
            type="button"
            variant="contained"
            color="error"
            onClick={handleSubmitCancelInvite}
            disabled={isCancelSubmitting}
          >
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
