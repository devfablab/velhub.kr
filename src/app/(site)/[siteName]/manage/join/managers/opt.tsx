'use client';

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  MenuItem,
  Radio,
  Snackbar,
  Stack,
  styled,
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
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

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

type ManagerIconRole =
  | 'owner'
  | 'community-manager'
  | 'board-manager'
  | 'board-general-manager'
  | 'board-assistant-manager';

type ManagerIconItem = {
  id: string;
  created_at: string;
  role: ManagerIconRole;
  icon: string;
  icon_url: string;
  site_id: string;
};

type ManagersResponse = {
  ok?: boolean;
  managers?: ManagerItem[];
  boards?: BoardItem[];
  managerIcons?: ManagerIconItem[];
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

type ManagerIconResponse = {
  ok?: boolean;
  iconId?: string;
  role?: ManagerIconRole;
  icon?: string;
  iconUrl?: string;
  managerIcons?: ManagerIconItem[];
  error?: string;
};

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const managerIconRoleOptions: Array<{ value: ManagerIconRole; label: string }> = [
  { value: 'owner', label: '운영자' },
  { value: 'community-manager', label: '커뮤니티 매니저' },
  { value: 'board-manager', label: '전체 게시판 매니저' },
  { value: 'board-general-manager', label: '개별 게시판 총괄 매니저' },
  { value: 'board-assistant-manager', label: '개별 게시판 부 매니저' },
];

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

function getRoleFullMessage(role: ManagerRole) {
  if (role === 'community-manager') {
    return {
      title: '역할 선택 불가',
      message: '커뮤니티 매니저 자리가 꽉찼습니다. 커뮤니티 매니저 자리 하나를 남겨두세요.',
    };
  }

  if (role === 'board-manager') {
    return {
      title: '역할 선택 불가',
      message: '전체 게시판 매니저 자리가 꽉찼습니다. 전체 게시판 매니저 자리 하나를 남겨두세요.',
    };
  }

  if (role === 'board-general-manager') {
    return {
      title: '역할 선택 불가',
      message: '개별 게시판 총괄 매니저 자리가 꽉찼습니다. 개별 게시판 총괄 매니저 자리 하나를 남겨두세요.',
    };
  }

  return {
    title: '역할 선택 불가',
    message: '개별 게시판 부 매니저 자리가 꽉찼습니다. 개별 게시판 부 매니저 자리 하나를 남겨두세요.',
  };
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [managers, setManagers] = useState<ManagerItem[]>([]);
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [managerIcons, setManagerIcons] = useState<ManagerIconItem[]>([]);
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
  const [errorMessage, setErrorMessage] = useState('');
  const [searchDialogErrorMessage, setSearchDialogErrorMessage] = useState('');
  const [managerEditErrorMessage, setManagerEditErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);
  const [isSubmittingDelete, setIsSubmittingDelete] = useState(false);
  const [isSubmittingMove, setIsSubmittingMove] = useState(false);
  const [isSearchDialogOpen, setIsSearchDialogOpen] = useState(false);
  const [isIconDialogOpen, setIsIconDialogOpen] = useState(false);
  const [isManagerEditOpen, setIsManagerEditOpen] = useState(false);
  const [targetIconId, setTargetIconId] = useState('');
  const [iconErrorMessage, setIconErrorMessage] = useState('');
  const [isLoadingIcons, setIsLoadingIcons] = useState(false);
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [deletingIconId, setDeletingIconId] = useState('');
  const [roleLimitDialog, setRoleLimitDialog] = useState<{
    title: string;
    message: string;
  } | null>(null);

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

  function isCommonRoleFull(role: 'community-manager' | 'board-manager') {
    if (!limits) {
      return false;
    }

    if (role === 'community-manager') {
      return currentCommunityManagerCount >= limits.community_manager;
    }

    return currentBoardManagerCount >= limits.board_manager;
  }

  function isAssignBoardRoleFull(role: 'board-general-manager' | 'board-assistant-manager') {
    if (!selectedAssignBoard) {
      return false;
    }

    if (role === 'board-general-manager') {
      return selectedAssignBoard.boardGeneralManagerFull;
    }

    return selectedAssignBoard.boardAssistantManagerFull;
  }

  function isMoveRoleFull(role: ManagerRole, boardId: string) {
    if (!limits || !selectedManager) {
      return false;
    }

    if (role === selectedManager.role && boardId === (selectedManager.boardId ?? '')) {
      return false;
    }

    if (role === 'community-manager') {
      return currentCommunityManagerCount >= limits.community_manager;
    }

    if (role === 'board-manager') {
      return currentBoardManagerCount >= limits.board_manager;
    }

    const targetBoard = boards.find((board) => board.boardId === boardId);

    if (!targetBoard) {
      return false;
    }

    if (role === 'board-general-manager') {
      return targetBoard.boardGeneralManagerFull;
    }

    return targetBoard.boardAssistantManagerFull;
  }

  function getBoardRoleLabel(role: 'board-general-manager' | 'board-assistant-manager', label: string) {
    if (!selectedAssignBoard) {
      return label;
    }

    if (role === 'board-general-manager' && selectedAssignBoard.boardGeneralManagerFull) {
      return `${label} (꽉참)`;
    }

    if (role === 'board-assistant-manager' && selectedAssignBoard.boardAssistantManagerFull) {
      return `${label} (꽉참)`;
    }

    return label;
  }

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
    setManagerIcons(Array.isArray(result.managerIcons) ? result.managerIcons : []);
    setLimits(result.limits ?? null);
  }

  async function ensureManagerIcons() {
    const response = await fetch('/api/manage/join/managers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        action: 'enable-icons',
        siteName,
      }),
    });

    const result = (await response.json()) as ManagerIconResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '매니저 아이콘 정보를 생성하지 못했습니다.');
    }

    setManagerIcons(Array.isArray(result.managerIcons) ? result.managerIcons : []);
  }

  async function openIconDialog() {
    if (isLoadingIcons) {
      return;
    }

    setIsIconDialogOpen(true);
    setIconErrorMessage('');

    try {
      setIsLoadingIcons(true);
      await ensureManagerIcons();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setIconErrorMessage(unknownError.message || '매니저 아이콘 정보를 생성하지 못했습니다.');
      } else {
        setIconErrorMessage('매니저 아이콘 정보를 생성하지 못했습니다.');
      }
    } finally {
      setIsLoadingIcons(false);
    }
  }

  function closeIconDialog() {
    if (isUploadingIcon || Boolean(deletingIconId)) {
      return;
    }

    setIsIconDialogOpen(false);
    setTargetIconId('');
    setIconErrorMessage('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleClickIconUpload(iconId: string) {
    if (isUploadingIcon) {
      return;
    }

    setIconErrorMessage('');
    setTargetIconId(iconId);
    fileInputRef.current?.click();
  }

  async function handleIconFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || !targetIconId || isUploadingIcon) {
      inputElement.value = '';
      return;
    }

    try {
      setIconErrorMessage('');
      setIsUploadingIcon(true);

      const formData = new FormData();
      formData.append('siteName', siteName);
      formData.append('iconId', targetIconId);
      formData.append('file', selectedFile);

      const response = await fetch('/api/manage/join/managers', {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });

      const result = (await response.json()) as ManagerIconResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '아이콘 업로드에 실패했습니다.');
      }

      setManagerIcons((previousIcons) =>
        previousIcons.map((icon) =>
          icon.id === result.iconId
            ? {
                ...icon,
                icon: result.icon ?? '',
                icon_url: result.iconUrl ?? '',
              }
            : icon,
        ),
      );

      setSnackbarMessage('아이콘이 저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setIconErrorMessage(unknownError.message || '아이콘 업로드에 실패했습니다.');
      } else {
        setIconErrorMessage('아이콘 업로드에 실패했습니다.');
      }
    } finally {
      setIsUploadingIcon(false);
      setTargetIconId('');
      inputElement.value = '';
    }
  }

  async function handleDeleteIcon(iconId: string) {
    if (deletingIconId) {
      return;
    }

    try {
      setIconErrorMessage('');
      setDeletingIconId(iconId);

      const response = await fetch('/api/manage/join/managers', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete-icon',
          siteName,
          iconId,
        }),
      });

      const result = (await response.json()) as ManagerIconResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '아이콘 삭제에 실패했습니다.');
      }

      setManagerIcons((previousIcons) =>
        previousIcons.map((icon) =>
          icon.id === iconId
            ? {
                ...icon,
                icon: '',
                icon_url: '',
              }
            : icon,
        ),
      );

      setSnackbarMessage('아이콘이 삭제되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setIconErrorMessage(unknownError.message || '아이콘 삭제에 실패했습니다.');
      } else {
        setIconErrorMessage('아이콘 삭제에 실패했습니다.');
      }
    } finally {
      setDeletingIconId('');
    }
  }

  function handleSearchKeywordChange(event: InputChangeEvent) {
    setSearchKeyword(event.currentTarget.value);
    setSearchDialogErrorMessage('');
  }

  function handleMoveRoleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const nextRole = event.target.value as ManagerRole;

    setManagerEditErrorMessage('');
    setMoveRole(nextRole);
    setMoveBoardId(isBoardRole(nextRole) ? moveBoardId : '');

    if (isMoveRoleFull(nextRole, isBoardRole(nextRole) ? moveBoardId : '')) {
      setRoleLimitDialog(getRoleFullMessage(nextRole));
    }
  }

  function handleMoveBoardChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const nextBoardId = event.target.value;

    setManagerEditErrorMessage('');
    setMoveBoardId(nextBoardId);

    if (isMoveRoleFull(moveRole, nextBoardId)) {
      setRoleLimitDialog(getRoleFullMessage(moveRole));
    }
  }

  function openSearchDialog() {
    setSearchDialogErrorMessage('');
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
    setSearchDialogErrorMessage('');
  }

  function closeManagerEdit() {
    setIsManagerEditOpen(false);
    setManagerEditErrorMessage('');
  }

  async function handleSearchMembers(event: FormSubmitEvent) {
    event.preventDefault();

    const trimmedKeyword = searchKeyword.trim();

    if (!trimmedKeyword || isSearching) {
      return;
    }

    try {
      setSearchDialogErrorMessage('');
      setIsSearching(true);

      const response = await fetch(`/api/manage/join/managers/search?siteName=${siteName}&keyword=${trimmedKeyword}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as SearchResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '멤버 검색에 실패했습니다.');
      }

      setSearchedKeyword(trimmedKeyword);
      setSearchResults(Array.isArray(result.members) ? result.members : []);
      setSelectedSearchMemberId('');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setSearchDialogErrorMessage(unknownError.message || '멤버 검색에 실패했습니다.');
      } else {
        setSearchDialogErrorMessage('멤버 검색에 실패했습니다.');
      }
    } finally {
      setIsSearching(false);
    }
  }

  async function handleCreateManager() {
    if (!selectedSearchMember) {
      setSearchDialogErrorMessage('위임할 멤버를 선택해주세요.');
      return;
    }

    if (assignManagerGroup === 'common' && isCommonRoleFull(assignCommonRole)) {
      setRoleLimitDialog(getRoleFullMessage(assignCommonRole));
      return;
    }

    if (assignManagerGroup === 'board' && isAssignBoardRoleFull(assignBoardRole)) {
      setRoleLimitDialog(getRoleFullMessage(assignBoardRole));
      return;
    }

    if (assignManagerGroup === 'common') {
      try {
        setSearchDialogErrorMessage('');
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
          setSearchDialogErrorMessage(unknownError.message || '위임에 실패했습니다.');
        } else {
          setSearchDialogErrorMessage('위임에 실패했습니다.');
        }
      } finally {
        setIsSubmittingNew(false);
      }

      return;
    }

    if (!assignBoardId) {
      setSearchDialogErrorMessage('게시판을 선택해주세요.');
      return;
    }

    try {
      setSearchDialogErrorMessage('');
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
        setSearchDialogErrorMessage(unknownError.message || '위임에 실패했습니다.');
      } else {
        setSearchDialogErrorMessage('위임에 실패했습니다.');
      }
    } finally {
      setIsSubmittingNew(false);
    }
  }

  async function handleDeleteManager() {
    if (!selectedManager) {
      setManagerEditErrorMessage('해임할 매니저를 선택해주세요.');
      return;
    }

    try {
      setManagerEditErrorMessage('');
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
      closeManagerEdit();
      setSnackbarMessage('해임되었습니다.');
      await loadManagers();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setManagerEditErrorMessage(unknownError.message || '해임에 실패했습니다.');
      } else {
        setManagerEditErrorMessage('해임에 실패했습니다.');
      }
    } finally {
      setIsSubmittingDelete(false);
    }
  }

  async function handleMoveManager() {
    if (!selectedManager) {
      setManagerEditErrorMessage('이동할 매니저를 선택해주세요.');
      return;
    }

    if (isBoardRole(moveRole) && !moveBoardId) {
      setManagerEditErrorMessage('게시판을 선택해주세요.');
      return;
    }

    if (isMoveRoleFull(moveRole, isBoardRole(moveRole) ? moveBoardId : '')) {
      setRoleLimitDialog(getRoleFullMessage(moveRole));
      return;
    }

    try {
      setManagerEditErrorMessage('');
      setIsSubmittingMove(true);

      const payload = {
        siteName,
        action: isBoardRole(moveRole)
          ? selectedManager.role === moveRole
            ? 'move-manager-board'
            : 'move-manager-role-board'
          : 'move-manager-role',
        sourceManageRoleId: selectedManager.manageRoleId,
        role: moveRole,
        boardId: isBoardRole(moveRole) ? moveBoardId : null,
      };

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
      setSelectedManagerRoleId('');
      closeManagerEdit();
      setSnackbarMessage('이동되었습니다.');
      await loadManagers();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setManagerEditErrorMessage(unknownError.message || '이동에 실패했습니다.');
      } else {
        setManagerEditErrorMessage('이동에 실패했습니다.');
      }
    } finally {
      setIsSubmittingMove(false);
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

  const managerEditContent = selectedManager ? (
    <Stack gap={3}>
      {managerEditErrorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{managerEditErrorMessage}</span>
        </p>
      ) : null}

      <Stack direction="column" gap={1}>
        <Stack sx={{ flexWrap: 'nowrap' }} direction="row" gap={3} alignItems="center">
          <Stack gap={1} direction="row">
            <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
              활동명
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
              {selectedManager.userName}
            </Typography>
          </Stack>
          <Stack gap={1} direction="row">
            <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
              별명
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
              {selectedManager.nickname}
            </Typography>
          </Stack>
        </Stack>

        <Stack sx={{ flexWrap: 'nowrap' }} direction="row" gap={3} alignItems="center">
          <Stack gap={1} direction="row">
            <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
              역할
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
              {getRoleLabel(selectedManager.role)}
            </Typography>
          </Stack>
          {selectedManager.boardLabel ? (
            <Stack gap={1} direction="row">
              <Typography variant="subtitle2" sx={{ whiteSpace: 'nowrap' }}>
                담당 게시판
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                {selectedManager.boardLabel}
              </Typography>
            </Stack>
          ) : null}
        </Stack>

        <Stack direction="row" gap={1} alignItems="center">
          <TextField
            select
            placeholder="이동 역할"
            value={moveRole}
            onChange={handleMoveRoleChange}
            size="small"
            fullWidth
          >
            {roleOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {isMoveRoleFull(option.value, isBoardRole(option.value) ? moveBoardId : '')
                  ? `${getRoleLabel(option.value)} (꽉참)`
                  : getRoleLabel(option.value)}
              </MenuItem>
            ))}
          </TextField>

          {isBoardRole(moveRole) ? (
            <TextField
              select
              placeholder="게시판"
              value={moveBoardId}
              onChange={handleMoveBoardChange}
              size="small"
              fullWidth
            >
              {boardOptionsForMove.map((board) => (
                <MenuItem key={board.value} value={board.value}>
                  {board.label}
                </MenuItem>
              ))}
            </TextField>
          ) : null}
        </Stack>
      </Stack>

      <Stack direction={isMobile ? 'column' : 'row'} gap={1} justifyContent={isMobile ? undefined : 'space-between'}>
        {selectedManager.role !== 'board-general-manager' ? (
          <button
            type="button"
            className="button medium warning"
            onClick={handleDeleteManager}
            disabled={isSubmittingDelete}
          >
            해임
          </button>
        ) : (
          <i />
        )}
        <button
          type="button"
          className="button medium submit"
          onClick={handleMoveManager}
          disabled={isSubmittingMove || isMoveRoleFull(moveRole, isBoardRole(moveRole) ? moveBoardId : '')}
        >
          이동
        </button>
      </Stack>
    </Stack>
  ) : null;

  return (
    <Container pageTitle="멤버 관리" pageBack={`/${siteName}/manage`} menu="join">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          <Stack direction="row" gap={1} alignItems="center" justifyContent="flex-end" sx={{ p: 1 }}>
            <button
              type="button"
              className="button small action"
              onClick={() => void openIconDialog()}
              disabled={isLoadingIcons}
            >
              아이콘 변경
            </button>
            <button type="button" className="button small action" onClick={openSearchDialog}>
              위임
            </button>
          </Stack>

          <div className={`paper paper-p0 ${styles.paper}`}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>별명</TableCell>
                  <TableCell>역할</TableCell>
                  <TableCell>게시판</TableCell>
                  <TableCell>선정일</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {managers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4}>등록된 매니저가 없습니다.</TableCell>
                  </TableRow>
                ) : (
                  managers.map((manager) => {
                    const isSelected = selectedManagerRoleId === manager.manageRoleId;

                    return (
                      <TableRow
                        key={manager.manageRoleId}
                        hover
                        selected={isSelected}
                        onClick={() => {
                          setManagerEditErrorMessage('');
                          setSelectedManagerRoleId(manager.manageRoleId);
                          setMoveRole(manager.role);
                          setMoveBoardId(manager.boardId ?? '');
                          setIsManagerEditOpen(true);
                        }}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {manager.nickname || manager.userName || manager.email}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{getRoleLabel(manager.role)}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{manager.boardLabel ?? ''}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {formatDateTime(manager.selectedAt || manager.createdAt)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {isMobile ? (
            <Drawer anchor="bottom" open={isIconDialogOpen} onClose={closeIconDialog} className="VhiDrawer-bottom">
              <h2>아이콘 변경</h2>
              <button
                type="button"
                className="close-button"
                onClick={closeIconDialog}
                aria-label="아이콘 변경 닫기"
                disabled={isUploadingIcon || Boolean(deletingIconId)}
              >
                <CloseRoundedIcon />
              </button>

              <Stack gap={2} sx={{ pt: 1 }}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  {iconErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{iconErrorMessage}</span>
                    </p>
                  ) : null}

                  <div className={styles['popup-level-rows']}>
                    {managerIconRoleOptions.map((roleOption) => {
                      const icon = managerIcons.find((managerIcon) => managerIcon.role === roleOption.value);

                      if (!icon) {
                        return null;
                      }

                      return (
                        <div key={icon.id} className={styles['popup-level-row']}>
                          <Stack direction="row" gap={2} alignItems="center">
                            <Typography variant="subtitle2" sx={{ minWidth: 170 }}>
                              {roleOption.label}
                            </Typography>

                            <Box
                              sx={{
                                height: 25,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {icon.icon_url ? (
                                <Box
                                  component="img"
                                  src={icon.icon_url}
                                  alt={roleOption.label}
                                  sx={{
                                    width: 25,
                                    height: 25,
                                    objectFit: 'contain',
                                    display: 'block',
                                  }}
                                />
                              ) : (
                                <Typography variant="body2">아이콘 없음</Typography>
                              )}
                            </Box>
                          </Stack>

                          <Stack direction="row" gap={1}>
                            <button
                              type="button"
                              className="button medium action"
                              onClick={() => handleClickIconUpload(icon.id)}
                              disabled={isUploadingIcon}
                              aria-label={`${roleOption.label} 아이콘 변경`}
                            >
                              <VisuallyHiddenInput
                                ref={fileInputRef}
                                type="file"
                                accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                                onChange={handleIconFileChange}
                              />
                              <CompareArrowsRoundedIcon />
                            </button>

                            {icon.icon ? (
                              <button
                                type="button"
                                className="button medium warning"
                                onClick={() => void handleDeleteIcon(icon.id)}
                                disabled={deletingIconId === icon.id}
                                aria-label={`${roleOption.label} 아이콘 삭제`}
                              >
                                <DeleteForeverRoundedIcon />
                              </button>
                            ) : null}
                          </Stack>
                        </div>
                      );
                    })}
                  </div>
                </Stack>

                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={closeIconDialog}
                    disabled={isUploadingIcon || Boolean(deletingIconId)}
                  >
                    닫기
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog open={isIconDialogOpen} onClose={closeIconDialog} fullWidth maxWidth="sm" className="VhiDialog">
              <DialogTitle>아이콘 변경</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={closeIconDialog}
                aria-label="아이콘 변경 닫기"
                disabled={isUploadingIcon || Boolean(deletingIconId)}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  {iconErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{iconErrorMessage}</span>
                    </p>
                  ) : null}

                  <div className={styles['popup-level-rows']}>
                    {managerIconRoleOptions.map((roleOption) => {
                      const icon = managerIcons.find((managerIcon) => managerIcon.role === roleOption.value);

                      if (!icon) {
                        return null;
                      }

                      return (
                        <div key={icon.id} className={styles['popup-level-row']}>
                          <Stack direction="row" gap={2} alignItems="center">
                            <Typography variant="subtitle2" sx={{ minWidth: 170 }}>
                              {roleOption.label}
                            </Typography>

                            <Box
                              sx={{
                                height: 25,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {icon.icon_url ? (
                                <Box
                                  component="img"
                                  src={icon.icon_url}
                                  alt={roleOption.label}
                                  sx={{
                                    width: 25,
                                    height: 25,
                                    objectFit: 'contain',
                                    display: 'block',
                                  }}
                                />
                              ) : (
                                <Typography variant="body2">아이콘 없음</Typography>
                              )}
                            </Box>
                          </Stack>

                          <Stack direction="row" gap={1}>
                            <button
                              type="button"
                              className="button medium action"
                              onClick={() => handleClickIconUpload(icon.id)}
                              disabled={isUploadingIcon}
                              aria-label={`${roleOption.label} 아이콘 변경`}
                            >
                              <CompareArrowsRoundedIcon />
                            </button>

                            {icon.icon ? (
                              <button
                                type="button"
                                className="button medium warning"
                                onClick={() => void handleDeleteIcon(icon.id)}
                                disabled={deletingIconId === icon.id}
                                aria-label=""
                              >
                                <DeleteForeverRoundedIcon />
                              </button>
                            ) : null}
                          </Stack>
                        </div>
                      );
                    })}
                  </div>

                  <VisuallyHiddenInput
                    ref={fileInputRef}
                    type="file"
                    accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                    onChange={handleIconFileChange}
                  />
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={closeIconDialog}
                  disabled={isUploadingIcon || Boolean(deletingIconId)}
                >
                  닫기
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer anchor="bottom" open={isSearchDialogOpen} onClose={closeSearchDialog} className="VhiDrawer-bottom">
              <h2>멤버 검색</h2>
              <button
                type="button"
                className="close-button"
                onClick={closeSearchDialog}
                aria-label="멤버 검색 닫기"
                disabled={isSubmittingNew}
              >
                <CloseRoundedIcon />
              </button>

              <Stack gap={3}>
                {searchDialogErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{searchDialogErrorMessage}</span>
                  </p>
                ) : null}

                <Stack component="form" gap={3} sx={{ pt: 1 }} onSubmit={handleSearchMembers}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <TextField
                      placeholder="별명 검색"
                      value={searchKeyword}
                      onChange={handleSearchKeywordChange}
                      fullWidth
                      size="small"
                    />
                    <button type="submit" className="button medium action" disabled={isSearching}>
                      검색
                    </button>
                  </Stack>

                  <div className={`paper paper-p0 ${styles.paper}`}>
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
                                <Radio
                                  checked={selectedSearchMemberId === member.rhizomeStigmaId}
                                  onChange={() => {
                                    setSelectedSearchMemberId(member.rhizomeStigmaId);
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
                  </div>

                  {selectedSearchMemberId ? (
                    <>
                      <Stack direction="row" gap={1.5}>
                        <Stack direction="column" gap={1} sx={{ flex: '1 0 0%' }}>
                          <Typography variant="subtitle2">매니저 구분</Typography>
                          <TextField
                            select
                            value={assignManagerGroup}
                            onChange={(event) => {
                              const nextGroup = event.target.value as AssignManagerGroup;
                              setAssignManagerGroup(nextGroup);
                              setAssignCommonRole('community-manager');
                              setAssignBoardId('');
                              setAssignBoardRole('board-general-manager');
                            }}
                            size="small"
                            fullWidth
                          >
                            <MenuItem value="common">기타 매니저</MenuItem>
                            <MenuItem value="board">개별 게시판 매니저</MenuItem>
                          </TextField>
                        </Stack>

                        {assignManagerGroup === 'common' ? (
                          <Stack direction="column" gap={1} sx={{ flex: '1 0 0%' }}>
                            <Typography variant="subtitle2">위임 역할</Typography>
                            <TextField
                              select
                              value={assignCommonRole}
                              onChange={(event) => {
                                const nextRole = event.target.value as 'community-manager' | 'board-manager';

                                setAssignCommonRole(nextRole);

                                if (isCommonRoleFull(nextRole)) {
                                  setRoleLimitDialog(getRoleFullMessage(nextRole));
                                }
                              }}
                              size="small"
                              fullWidth
                            >
                              <MenuItem value="community-manager">
                                {isCommonRoleFull('community-manager') ? '커뮤니티 매니저 (꽉참)' : '커뮤니티 매니저'}
                              </MenuItem>
                              <MenuItem value="board-manager">
                                {isCommonRoleFull('board-manager') ? '전체 게시판 매니저 (꽉참)' : '전체 게시판 매니저'}
                              </MenuItem>
                            </TextField>
                          </Stack>
                        ) : (
                          <Stack direction="column" gap={1} sx={{ flex: '1 0 0%' }}>
                            <Stack direction="column" gap={1}>
                              <Typography variant="subtitle2">게시판</Typography>

                              <TextField
                                select
                                value={assignBoardId}
                                onChange={(event) => {
                                  setAssignBoardId(event.target.value);
                                  setAssignBoardRole('board-general-manager');
                                }}
                                size="small"
                              >
                                {boards.map((board) => (
                                  <MenuItem key={board.boardId} value={board.boardId}>
                                    {board.boardLabel}
                                  </MenuItem>
                                ))}
                              </TextField>
                            </Stack>

                            {assignBoardId && selectedAssignBoard ? (
                              <Stack direction="column" gap={1}>
                                <Typography variant="subtitle2">위임 역할</Typography>

                                <TextField
                                  select
                                  value={assignBoardRole}
                                  onChange={(event) => {
                                    const nextRole = event.target.value as
                                      | 'board-general-manager'
                                      | 'board-assistant-manager';

                                    setAssignBoardRole(nextRole);

                                    if (isAssignBoardRoleFull(nextRole)) {
                                      setRoleLimitDialog(getRoleFullMessage(nextRole));
                                    }
                                  }}
                                  size="small"
                                  fullWidth
                                >
                                  <MenuItem value="board-general-manager">
                                    {getBoardRoleLabel('board-general-manager', '개별 게시판 총괄 매니저')}
                                  </MenuItem>
                                  <MenuItem value="board-assistant-manager">
                                    {getBoardRoleLabel('board-assistant-manager', '개별 게시판 부 매니저')}
                                  </MenuItem>
                                </TextField>
                              </Stack>
                            ) : null}
                          </Stack>
                        )}
                      </Stack>

                      <Stack direction="column">
                        <button
                          type="button"
                          className="button medium submit"
                          onClick={handleCreateManager}
                          disabled={
                            isSubmittingNew ||
                            (assignManagerGroup === 'common' && isCommonRoleFull(assignCommonRole)) ||
                            (assignManagerGroup === 'board' && isAssignBoardRoleFull(assignBoardRole))
                          }
                        >
                          위임
                        </button>
                      </Stack>
                    </>
                  ) : null}
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog open={isSearchDialogOpen} onClose={closeSearchDialog} fullWidth maxWidth="md" className="VhiDialog">
              <DialogTitle>멤버 검색</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={closeSearchDialog}
                aria-label="멤버 검색 닫기"
                disabled={isSubmittingNew}
              >
                <CloseRoundedIcon />
              </button>

              <DialogContent>
                <Stack component="form" gap={2} sx={{ pt: 1 }} onSubmit={handleSearchMembers}>
                  {searchDialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{searchDialogErrorMessage}</span>
                    </p>
                  ) : null}
                  <Stack direction="row" gap={1} alignItems="center" sx={{ paddingRight: '3px' }}>
                    <TextField
                      placeholder="별명 검색"
                      value={searchKeyword}
                      onChange={handleSearchKeywordChange}
                      fullWidth
                      size="small"
                    />
                    <button type="submit" className="button medium action" disabled={isSearching}>
                      검색
                    </button>
                  </Stack>

                  <div className={`paper paper-p0 ${styles.paper}`}>
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
                                <Radio
                                  checked={selectedSearchMemberId === member.rhizomeStigmaId}
                                  onChange={() => {
                                    setSelectedSearchMemberId(member.rhizomeStigmaId);
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
                  </div>

                  {selectedSearchMemberId ? (
                    <Stack direction="row" gap={1.5}>
                      <Stack direction="column" gap={1} sx={{ flex: '1 0 0%' }}>
                        <Typography variant="subtitle2">매니저 구분</Typography>
                        <TextField
                          select
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
                      </Stack>

                      {assignManagerGroup === 'common' ? (
                        <Stack direction="column" gap={1} sx={{ flex: '1 0 0%' }}>
                          <Typography variant="subtitle2">위임 역할</Typography>

                          <TextField
                            select
                            value={assignCommonRole}
                            onChange={(event) => {
                              const nextRole = event.target.value as 'community-manager' | 'board-manager';

                              setAssignCommonRole(nextRole);

                              if (isCommonRoleFull(nextRole)) {
                                setRoleLimitDialog(getRoleFullMessage(nextRole));
                              }
                            }}
                            size="small"
                            sx={{ minWidth: 240 }}
                          >
                            <MenuItem value="community-manager">
                              {isCommonRoleFull('community-manager') ? '커뮤니티 매니저 (꽉참)' : '커뮤니티 매니저'}
                            </MenuItem>
                            <MenuItem value="board-manager">
                              {isCommonRoleFull('board-manager') ? '전체 게시판 매니저 (꽉참)' : '전체 게시판 매니저'}
                            </MenuItem>
                          </TextField>
                        </Stack>
                      ) : (
                        <>
                          <Stack direction="column" gap={1} sx={{ flex: '1 0 0%' }}>
                            <Typography variant="subtitle2">게시판</Typography>

                            <TextField
                              select
                              value={assignBoardId}
                              onChange={(event) => {
                                setAssignBoardId(event.target.value);
                                setAssignBoardRole('board-general-manager');
                              }}
                              size="small"
                              fullWidth
                            >
                              {boards.map((board) => (
                                <MenuItem key={board.boardId} value={board.boardId}>
                                  {board.boardLabel}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Stack>

                          {assignBoardId && selectedAssignBoard ? (
                            <Stack direction="column" gap={1} sx={{ flex: '1 0 0%' }}>
                              <Typography variant="subtitle2">위임 역할</Typography>

                              <TextField
                                select
                                value={assignBoardRole}
                                onChange={(event) => {
                                  const nextRole = event.target.value as
                                    | 'board-general-manager'
                                    | 'board-assistant-manager';

                                  setAssignBoardRole(nextRole);

                                  if (isAssignBoardRoleFull(nextRole)) {
                                    setRoleLimitDialog(getRoleFullMessage(nextRole));
                                  }
                                }}
                                size="small"
                                sx={{ minWidth: 240 }}
                              >
                                <MenuItem value="board-general-manager">
                                  {getBoardRoleLabel('board-general-manager', '개별 게시판 총괄 매니저')}
                                </MenuItem>
                                <MenuItem value="board-assistant-manager">
                                  {getBoardRoleLabel('board-assistant-manager', '개별 게시판 부 매니저')}
                                </MenuItem>
                              </TextField>
                            </Stack>
                          ) : null}
                        </>
                      )}
                    </Stack>
                  ) : null}

                  <Stack direction="row" gap={1} justifyContent="flex-end">
                    <button
                      type="button"
                      className="button medium submit"
                      onClick={handleCreateManager}
                      disabled={
                        isSubmittingNew ||
                        (assignManagerGroup === 'common' && isCommonRoleFull(assignCommonRole)) ||
                        (assignManagerGroup === 'board' && isAssignBoardRoleFull(assignBoardRole))
                      }
                    >
                      위임
                    </button>
                  </Stack>
                </Stack>
              </DialogContent>
            </Dialog>
          )}

          {selectedManager ? (
            <>
              {isMobile ? (
                <Drawer
                  anchor="bottom"
                  open={isManagerEditOpen}
                  onClose={closeManagerEdit}
                  className="VhiDrawer-bottom"
                >
                  <h2>매니저 변경</h2>
                  <button
                    type="button"
                    className="close-button"
                    onClick={closeManagerEdit}
                    aria-label="매니저 변경 닫기"
                  >
                    <CloseRoundedIcon />
                  </button>
                  {managerEditContent}
                </Drawer>
              ) : (
                <Dialog
                  open={isManagerEditOpen}
                  onClose={closeManagerEdit}
                  fullWidth
                  maxWidth="sm"
                  className="VhiDialog"
                >
                  <DialogTitle>매니저 변경</DialogTitle>
                  <button
                    type="button"
                    className="close-button"
                    onClick={closeManagerEdit}
                    aria-label="매니저 변경 닫기"
                  >
                    <CloseRoundedIcon />
                  </button>
                  <DialogContent>{managerEditContent}</DialogContent>
                </Dialog>
              )}
            </>
          ) : null}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(roleLimitDialog)}
              onClose={() => setRoleLimitDialog(null)}
              className="VhiDrawer-bottom"
            >
              <h2>{roleLimitDialog?.title}</h2>
              <p>{roleLimitDialog?.message}</p>
              <button type="button" className="button medium submit" onClick={() => setRoleLimitDialog(null)}>
                확인
              </button>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(roleLimitDialog)}
              onClose={() => setRoleLimitDialog(null)}
              fullWidth
              maxWidth="xs"
              className="VhiDialog"
            >
              <DialogTitle>{roleLimitDialog?.title}</DialogTitle>
              <DialogContent>
                <Typography variant="body2">{roleLimitDialog?.message}</Typography>
              </DialogContent>
              <DialogActions>
                <button type="button" className="button medium submit" onClick={() => setRoleLimitDialog(null)}>
                  확인
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
