'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Snackbar,
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
import { normalizeText } from '@/lib/utils';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type ManagerRole = 'community-manager' | 'board-manager' | 'board-general-manager' | 'board-assistant-manager';
type AssignManagerGroup = 'common' | 'board';

type ManagerItem = {
  manageRoleId: string;
  rhizomeStigmaId: string;
  userId: string;
  nickname: string;
  email: string;
  userName: string;
  role: ManagerRole;
  selectedAt: string | null;
  createdAt: string;
  boardId: string | null;
  boardKey: string | null;
  boardLabel: string | null;
};

type BoardItem = {
  boardId: string;
  boardKey: string;
  boardLabel: string;
  boardGeneralManagerCount: number;
  boardAssistantManagerCount: number;
  boardGeneralManagerLimit: number;
  boardAssistantManagerLimit: number;
  boardGeneralManagerFull: boolean;
  boardAssistantManagerFull: boolean;
};

type MemberSearchItem = {
  rhizomeStigmaId: string;
  userId: string;
  nickname: string;
  email: string;
  userName: string;
  manageRoles: ManagerItem[];
};

type ManagersResponse = {
  ok?: boolean;
  managers?: ManagerItem[];
  boards?: BoardItem[];
  limits?: {
    community_manager: number;
    board_manager: number;
    board_general_manager: number;
    board_assistant_manager: number;
  };
  error?: string;
};

type SearchResponse = {
  ok?: boolean;
  boards?: BoardItem[];
  members?: MemberSearchItem[];
  error?: string;
};

type MutationResponse = {
  ok?: boolean;
  managers?: ManagerItem[];
  error?: string;
};

const roleOptions: Array<{ value: ManagerRole; label: string }> = [
  { value: 'community-manager', label: '커뮤니티 매니저' },
  { value: 'board-manager', label: '전체 게시판 매니저' },
  { value: 'board-general-manager', label: '개별 게시판 총괄 매니저' },
  { value: 'board-assistant-manager', label: '개별 게시판 부 매니저' },
];

function getRoleLabel(role: ManagerRole) {
  return roleOptions.find((option) => option.value === role)?.label ?? role;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(
    2,
    '0',
  )} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isBoardRole(role: ManagerRole) {
  return role === 'board-general-manager' || role === 'board-assistant-manager';
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [limits, setLimits] = useState<ManagersResponse['limits'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchedKeyword, setSearchedKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<MemberSearchItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedSearchMemberId, setSelectedSearchMemberId] = useState('');
  const [selectedManagerRoleId, setSelectedManagerRoleId] = useState('');
  const [assignManagerGroup, setAssignManagerGroup] = useState<AssignManagerGroup>('common');
  const [assignCommonRole, setAssignCommonRole] = useState<'community-manager' | 'board-manager'>('community-manager');
  const [assignBoardId, setAssignBoardId] = useState('');
  const [assignBoardRole, setAssignBoardRole] = useState<'board-general-manager' | 'board-assistant-manager'>(
    'board-general-manager',
  );
  const [moveRole, setMoveRole] = useState<ManagerRole>('community-manager');
  const [moveBoardId, setMoveBoardId] = useState('');
  const [moveTargetManageRoleId, setMoveTargetManageRoleId] = useState('');
  const [moveTargetMemberId, setMoveTargetMemberId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);

  const selectedManager = useMemo(
    () => managers.find((manager) => manager.manageRoleId === selectedManagerRoleId) ?? null,
    [managers, selectedManagerRoleId],
  );

  const selectedSearchMember = useMemo(
    () => searchResults.find((member) => member.rhizomeStigmaId === selectedSearchMemberId) ?? null,
    [searchResults, selectedSearchMemberId],
  );

  const selectedAssignBoard = useMemo(
    () => boards.find((board) => board.boardId === assignBoardId) ?? null,
    [boards, assignBoardId],
  );

  const currentCommunityManagerCount = useMemo(
    () => managers.filter((manager) => manager.role === 'community-manager').length,
    [managers],
  );

  const currentBoardManagerCount = useMemo(
    () => managers.filter((manager) => manager.role === 'board-manager').length,
    [managers],
  );

  const boardGeneralManagerCandidates = useMemo(
    () =>
      managers.filter(
        (manager) =>
          manager.role === 'board-general-manager' &&
          manager.manageRoleId !== selectedManagerRoleId &&
          manager.boardId !== selectedManager?.boardId,
      ),
    [managers, selectedManagerRoleId, selectedManager],
  );

  const boardOptionsForMove = useMemo(() => {
    if (moveRole === 'board-general-manager') {
      return boards.map((board) => ({
        value: board.boardId,
        label:
          selectedManager?.boardId === board.boardId
            ? board.boardLabel
            : board.boardGeneralManagerFull
              ? `${board.boardLabel} (꽉참)`
              : board.boardLabel,
        disabled: selectedManager?.boardId === board.boardId ? false : board.boardGeneralManagerFull,
      }));
    }

    if (moveRole === 'board-assistant-manager') {
      return boards.map((board) => ({
        value: board.boardId,
        label:
          selectedManager?.boardId === board.boardId
            ? board.boardLabel
            : board.boardAssistantManagerFull
              ? `${board.boardLabel} (꽉참)`
              : board.boardLabel,
        disabled: selectedManager?.boardId === board.boardId ? false : board.boardAssistantManagerFull,
      }));
    }

    return [];
  }, [boards, moveRole, selectedManager]);

  useEffect(() => {
    void (async () => {
      try {
        setErrorMessage('');
        await loadManagers();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '매니저 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('매니저 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function loadManagers() {
    const response = await fetch(`/api/manage/join/managers?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as ManagersResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '매니저 정보를 불러오지 못했습니다.');
    }

    setManagers(Array.isArray(result.managers) ? result.managers : []);
    setBoards(Array.isArray(result.boards) ? result.boards : []);
    setLimits(result.limits ?? null);
  }

  function handleSearchKeywordChange(event: InputChangeEvent) {
    setSearchKeyword(event.currentTarget.value);
    setErrorMessage('');
  }

  function handleMoveRoleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const nextRole = event.target.value as ManagerRole;

    setMoveRole(nextRole);
    setMoveBoardId('');
    setMoveTargetManageRoleId('');
    setMoveTargetMemberId('');
  }

  function handleMoveBoardChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setMoveBoardId(event.target.value);
  }

  function openSearchDialog() {
    setIsSearchDialogOpen(true);
  }

  function closeSearchDialog() {
    if (isSearching || isSubmittingNew || isSubmittingMove) {
      return;
    }

    setIsSearchDialogOpen(false);
    setSearchKeyword('');
    setSearchedKeyword('');
    setSearchResults([]);
    setSelectedSearchMemberId('');
    setAssignManagerGroup('common');
    setAssignCommonRole('community-manager');
    setAssignBoardId('');
    setAssignBoardRole('board-general-manager');
  }

  async function handleSearchMembers(event: FormSubmitEvent) {
    event.preventDefault();

    const trimmedKeyword = searchKeyword.trim();

    if (!trimmedKeyword || isSearching) {
      return;
    }

    try {
      setErrorMessage('');
      setIsSearching(true);

      const response = await fetch(
        `/api/manage/join/managers/search?siteName=${siteName}&keyword=${encodeURIComponent(trimmedKeyword)}`,
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as SearchResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '멤버 검색에 실패했습니다.');
      }

      setSearchedKeyword(trimmedKeyword);
      setSearchResults(Array.isArray(result.members) ? result.members : []);
      setSelectedSearchMemberId('');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '멤버 검색에 실패했습니다.');
      } else {
        setErrorMessage('멤버 검색에 실패했습니다.');
      }
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCreateManager() {
    if (!selectedSearchMember) {
      setErrorMessage('위임할 멤버를 선택해주세요.');
      return;
    }

    if (assignManagerGroup === 'common') {
      try {
        setErrorMessage('');
        setIsSubmittingNew(true);

        const response = await fetch('/api/manage/join/managers/new', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            siteName,
            managerId: selectedSearchMember.rhizomeStigmaId,
            role: assignCommonRole,
            boardId: null,
          }),
        });

        const result = (await response.json()) as MutationResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '위임에 실패했습니다.');
        }

        setManagers(Array.isArray(result.managers) ? result.managers : []);
        setSnackbarMessage('위임되었습니다.');
        closeSearchDialog();
        await loadManagers();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '위임에 실패했습니다.');
        } else {
          setErrorMessage('위임에 실패했습니다.');
        }
      } finally {
        setIsSubmittingNew(false);
      }

      return;
    }

    if (!assignBoardId) {
      setErrorMessage('게시판을 선택해주세요.');
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmittingNew(true);

      const response = await fetch('/api/manage/join/managers/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          managerId: selectedSearchMember.rhizomeStigmaId,
          role: assignBoardRole,
          boardId: assignBoardId,
        }),
      });

      const result = (await response.json()) as MutationResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '위임에 실패했습니다.');
      }

      setManagers(Array.isArray(result.managers) ? result.managers : []);
      setSnackbarMessage('위임되었습니다.');
      closeSearchDialog();
      await loadManagers();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '위임에 실패했습니다.');
      } else {
        setErrorMessage('위임에 실패했습니다.');
      }
    } finally {
      setIsSubmittingNew(false);
    }
  }

  async function handleDeleteManager() {
    if (!selectedManager) {
      setErrorMessage('해임할 매니저를 선택해주세요.');
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmittingDelete(true);

      const response = await fetch('/api/manage/join/managers/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          manageRoleId: selectedManager.manageRoleId,
        }),
      });

      const result = (await response.json()) as MutationResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '해임에 실패했습니다.');
      }

      setManagers(Array.isArray(result.managers) ? result.managers : []);
      setSelectedManagerRoleId('');
      setSnackbarMessage('해임되었습니다.');
      await loadManagers();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '해임에 실패했습니다.');
      } else {
        setErrorMessage('해임에 실패했습니다.');
      }
    } finally {
      setIsSubmittingDelete(false);
    }
  }

  async function handleMoveManager() {
    if (!selectedManager) {
      setErrorMessage('이동할 매니저를 선택해주세요.');
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmittingMove(true);

      let payload: {
        siteName: string;
        action:
          | 'move-board-general-manager'
          | 'move-board-general-manager-to-member'
          | 'move-manager-role'
          | 'move-manager-board'
          | 'move-manager-role-board';
        sourceManageRoleId: string;
        targetManageRoleId?: string | null;
        managerId?: string | null;
        role?: string | null;
        boardId?: string | null;
      } | null = null;

      if (selectedManager.role === 'board-general-manager' && moveRole === 'board-general-manager') {
        if (!moveTargetManageRoleId) {
          setErrorMessage('이동할 총괄 매니저를 선택해주세요.');
          return;
        }

        payload = {
          siteName,
          action: 'move-board-general-manager',
          sourceManageRoleId: selectedManager.manageRoleId,
          targetManageRoleId: moveTargetManageRoleId,
        };
      } else if (selectedManager.role === 'board-general-manager' && moveRole !== 'board-general-manager') {
        if (!moveTargetMemberId) {
          setErrorMessage('이동 후 총괄 자리를 맡을 멤버를 선택해주세요.');
          return;
        }

        payload = {
          siteName,
          action: 'move-board-general-manager-to-member',
          sourceManageRoleId: selectedManager.manageRoleId,
          managerId: moveTargetMemberId,
        };
      } else if (!selectedManager.boardId && !isBoardRole(moveRole) && selectedManager.role !== moveRole) {
        payload = {
          siteName,
          action: 'move-manager-role',
          sourceManageRoleId: selectedManager.manageRoleId,
          role: moveRole,
        };
      } else if (selectedManager.role === moveRole && isBoardRole(moveRole) && moveBoardId) {
        payload = {
          siteName,
          action: 'move-manager-board',
          sourceManageRoleId: selectedManager.manageRoleId,
          role: moveRole,
          boardId: moveBoardId,
        };
      } else {
        payload = {
          siteName,
          action: 'move-manager-role-board',
          sourceManageRoleId: selectedManager.manageRoleId,
          role: moveRole,
          boardId: isBoardRole(moveRole) ? moveBoardId : null,
        };
      }

      const response = await fetch('/api/manage/join/managers/move', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = (await response.json()) as MutationResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '이동에 실패했습니다.');
      }

      setManagers(Array.isArray(result.managers) ? result.managers : []);
      setMoveRole('community-manager');
      setMoveBoardId('');
      setMoveTargetManageRoleId('');
      setMoveTargetMemberId('');
      setSelectedManagerRoleId('');
      setSnackbarMessage('이동되었습니다.');
      await loadManagers();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '이동에 실패했습니다.');
      } else {
        setErrorMessage('이동에 실패했습니다.');
      }
    } finally {
      setIsSubmittingMove(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={2.5}>
      {isNotMobile ? (
        <Typography variant="h5" component="h1">
          매니저 관리
        </Typography>
      ) : null}

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
        <Button type="button" variant="outlined" onClick={openSearchDialog}>
          위임
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>선택</TableCell>
              <TableCell>별명</TableCell>
              <TableCell>역할</TableCell>
              <TableCell>게시판</TableCell>
              <TableCell>선정일</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {managers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5}>등록된 매니저가 없습니다.</TableCell>
              </TableRow>
            ) : (
              managers.map((manager) => (
                <TableRow key={manager.manageRoleId}>
                  <TableCell>
                    <input
                      type="radio"
                      checked={selectedManagerRoleId === manager.manageRoleId}
                      onChange={() => {
                        setSelectedManagerRoleId(manager.manageRoleId);
                        setMoveRole(manager.role);
                        setMoveBoardId(manager.boardId ?? '');
                        setMoveTargetManageRoleId('');
                        setMoveTargetMemberId('');
                      }}
                    />
                  </TableCell>
                  <TableCell>{manager.nickname || manager.userName || manager.email}</TableCell>
                  <TableCell>{getRoleLabel(manager.role)}</TableCell>
                  <TableCell>{manager.boardLabel ?? ''}</TableCell>
                  <TableCell>{formatDateTime(manager.selectedAt || manager.createdAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {selectedManager ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">선택된 매니저</Typography>

            <Typography variant="body2">
              {selectedManager.nickname || selectedManager.userName || selectedManager.email} /{' '}
              {getRoleLabel(selectedManager.role)}
              {selectedManager.boardLabel ? ` / ${selectedManager.boardLabel}` : ''}
            </Typography>

            <Stack direction="row" spacing={1.5}>
              <TextField
                select
                label="이동 역할"
                value={moveRole}
                onChange={handleMoveRoleChange}
                size="small"
                sx={{ minWidth: 240 }}
              >
                {roleOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {getRoleLabel(option.value)}
                  </MenuItem>
                ))}
              </TextField>

              {isBoardRole(moveRole) ? (
                <TextField
                  select
                  label="게시판"
                  value={moveBoardId}
                  onChange={handleMoveBoardChange}
                  size="small"
                  sx={{ minWidth: 240 }}
                >
                  {boardOptionsForMove.map((board) => (
                    <MenuItem key={board.value} value={board.value} disabled={board.disabled}>
                      {board.label}
                    </MenuItem>
                  ))}
                </TextField>
              ) : null}
            </Stack>

            {selectedManager.role === 'board-general-manager' && moveRole === 'board-general-manager' ? (
              <TextField
                select
                label="이동 대상 총괄 매니저"
                value={moveTargetManageRoleId}
                onChange={(event) => setMoveTargetManageRoleId(event.target.value)}
                size="small"
                sx={{ width: 320 }}
              >
                {boardGeneralManagerCandidates.map((manager) => (
                  <MenuItem key={manager.manageRoleId} value={manager.manageRoleId}>
                    {`${manager.nickname || manager.userName || manager.email} / ${manager.boardLabel ?? ''}`}
                  </MenuItem>
                ))}
              </TextField>
            ) : null}

            {selectedManager.role === 'board-general-manager' && moveRole !== 'board-general-manager' ? (
              <Stack spacing={1}>
                <Button type="button" variant="outlined" onClick={openSearchDialog}>
                  총괄 자리 맡을 멤버 선택
                </Button>
                {moveTargetMemberId ? (
                  <Typography variant="body2">
                    선택된 멤버:{' '}
                    {searchResults.find((member) => member.rhizomeStigmaId === moveTargetMemberId)?.nickname ?? ''}
                  </Typography>
                ) : null}
              </Stack>
            ) : null}

            <Stack direction="row" spacing={1}>
              <Button type="button" variant="contained" onClick={handleMoveManager} disabled={isSubmittingMove}>
                이동
              </Button>

              {selectedManager.role !== 'board-general-manager' ? (
                <Button
                  type="button"
                  variant="outlined"
                  color="error"
                  onClick={handleDeleteManager}
                  disabled={isSubmittingDelete}
                >
                  해임
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>
      ) : null}

      <Dialog open={isSearchDialogOpen} onClose={closeSearchDialog} fullWidth maxWidth="md">
        <DialogTitle>멤버 검색</DialogTitle>
        <DialogContent>
          <Stack component="form" spacing={2} sx={{ pt: 1 }} onSubmit={handleSearchMembers}>
            <Stack direction="row" spacing={1}>
              <TextField
                label="별명 검색"
                value={searchKeyword}
                onChange={handleSearchKeywordChange}
                fullWidth
                size="small"
              />
              <Button type="submit" variant="contained" disabled={isSearching}>
                검색
              </Button>
            </Stack>

            {searchedKeyword ? <Typography variant="body2">{`검색어: ${searchedKeyword}`}</Typography> : null}

            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>선택</TableCell>
                    <TableCell>별명</TableCell>
                    <TableCell>이메일</TableCell>
                    <TableCell>현재 매니저</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {searchResults.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>검색 결과가 없습니다.</TableCell>
                    </TableRow>
                  ) : (
                    searchResults.map((member) => (
                      <TableRow key={member.rhizomeStigmaId}>
                        <TableCell>
                          <input
                            type="radio"
                            checked={selectedSearchMemberId === member.rhizomeStigmaId}
                            onChange={() => {
                              setSelectedSearchMemberId(member.rhizomeStigmaId);
                              setMoveTargetMemberId(member.rhizomeStigmaId);
                            }}
                          />
                        </TableCell>
                        <TableCell>{member.nickname || member.userName || member.email}</TableCell>
                        <TableCell>{member.email}</TableCell>
                        <TableCell>
                          {member.manageRoles.length > 0
                            ? member.manageRoles
                                .map((role) =>
                                  role.boardLabel
                                    ? `${getRoleLabel(role.role)} / ${role.boardLabel}`
                                    : getRoleLabel(role.role),
                                )
                                .join(', ')
                            : ''}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <Stack direction="row" spacing={1.5}>
              <TextField
                select
                label="매니저 구분"
                value={assignManagerGroup}
                onChange={(event) => {
                  const nextGroup = event.target.value as AssignManagerGroup;
                  setAssignManagerGroup(nextGroup);
                  setAssignCommonRole('community-manager');
                  setAssignBoardId('');
                  setAssignBoardRole('board-general-manager');
                }}
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="common">기타 매니저</MenuItem>
                <MenuItem value="board">개별 게시판 매니저</MenuItem>
              </TextField>

              {assignManagerGroup === 'common' ? (
                <TextField
                  select
                  label="위임 역할"
                  value={assignCommonRole}
                  onChange={(event) => setAssignCommonRole(event.target.value as 'community-manager' | 'board-manager')}
                  size="small"
                  sx={{ minWidth: 240 }}
                >
                  <MenuItem
                    value="community-manager"
                    disabled={Boolean(limits) && currentCommunityManagerCount >= (limits?.community_manager ?? 0)}
                  >
                    커뮤니티 매니저
                  </MenuItem>
                  <MenuItem
                    value="board-manager"
                    disabled={Boolean(limits) && currentBoardManagerCount >= (limits?.board_manager ?? 0)}
                  >
                    전체 게시판 매니저
                  </MenuItem>
                </TextField>
              ) : (
                <>
                  <TextField
                    select
                    label="게시판"
                    value={assignBoardId}
                    onChange={(event) => {
                      setAssignBoardId(event.target.value);
                      setAssignBoardRole('board-general-manager');
                    }}
                    size="small"
                    sx={{ minWidth: 240 }}
                  >
                    {boards.map((board) => (
                      <MenuItem key={board.boardId} value={board.boardId}>
                        {board.boardLabel}
                      </MenuItem>
                    ))}
                  </TextField>

                  {assignBoardId && selectedAssignBoard ? (
                    <TextField
                      select
                      label="위임 역할"
                      value={assignBoardRole}
                      onChange={(event) =>
                        setAssignBoardRole(event.target.value as 'board-general-manager' | 'board-assistant-manager')
                      }
                      size="small"
                      sx={{ minWidth: 240 }}
                    >
                      <MenuItem value="board-general-manager" disabled={selectedAssignBoard.boardGeneralManagerFull}>
                        {selectedAssignBoard.boardGeneralManagerFull
                          ? '개별 게시판 총괄 매니저 (꽉참)'
                          : '개별 게시판 총괄 매니저'}
                      </MenuItem>
                      <MenuItem
                        value="board-assistant-manager"
                        disabled={selectedAssignBoard.boardAssistantManagerFull}
                      >
                        {selectedAssignBoard.boardAssistantManagerFull
                          ? '개별 게시판 부 매니저 (꽉참)'
                          : '개별 게시판 부 매니저'}
                      </MenuItem>
                    </TextField>
                  ) : null}
                </>
              )}
            </Stack>

            <Stack direction="row" spacing={1}>
              <Button type="button" variant="contained" onClick={handleCreateManager} disabled={isSubmittingNew}>
                위임
              </Button>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={closeSearchDialog}>
            닫기
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2500}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Stack>
  );
}
