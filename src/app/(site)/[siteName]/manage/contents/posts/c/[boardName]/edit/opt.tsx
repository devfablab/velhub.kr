'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from '@mui/material/Link';
import {
  Alert,
  Button,
  FormControl,
  FormControlLabel,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Container from '../../../../../menu';
import styles from '@/app/manage.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type PostType = 'none' | 'prefix' | 'series';
type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed';
type MarkdownStatus = 'markdown_default' | 'markdown_on' | 'markdown_off';
type WritePermission = 'member' | 'manager' | 'community-manager' | 'owner';

type BoardResponse = {
  board?: {
    id: string;
    board_key: string;
    board_label: string;
    board_type: BoardType;
    is_active: boolean;
    sort_order: number;
    markdown_status?: MarkdownStatus | null;
    write_permission?: WritePermission | null;
    post_per_page: number | null;
    post_type: PostType | null;
  };
  error?: string;
};

type UpdateBoardResponse = {
  ok?: boolean;
  boardId?: string;
  boardName?: string;
  error?: string;
};

type BoardKeyCheckResponse = {
  ok?: boolean;
  boardKey?: string;
  error?: string;
};

type BoardLabelCheckResponse = {
  ok?: boolean;
  boardLabel?: string;
  error?: string;
};

const POST_PER_PAGE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

const MARKDOWN_STATUS_OPTIONS: { value: MarkdownStatus; label: string }[] = [
  { value: 'markdown_default', label: '마크다운 전용' },
  { value: 'markdown_on', label: '마크다운 사용가능' },
  { value: 'markdown_off', label: '마크다운 사용안함' },
];

const WRITE_PERMISSION_OPTIONS: { value: WritePermission; label: string }[] = [
  { value: 'member', label: '일반 멤버 가능' },
  { value: 'manager', label: '매니저 전용' },
  { value: 'community-manager', label: '커뮤니티 매니저 전용' },
  { value: 'owner', label: '운영자 전용' },
];

function normalizeBoardKey(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidBoardKeyCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));

  const [boardId, setBoardId] = useState('');
  const [boardLabel, setBoardLabel] = useState('');
  const [originBoardLabel, setOriginBoardLabel] = useState('');
  const [boardKey, setBoardKey] = useState('');
  const [originBoardKey, setOriginBoardKey] = useState('');
  const [boardType, setBoardType] = useState<BoardType>('basic');
  const [postPerPage, setPostPerPage] = useState(5);
  const [markdownStatus, setMarkdownStatus] = useState<MarkdownStatus>('markdown_default');
  const [writePermission, setWritePermission] = useState<WritePermission>('member');
  const [postType, setPostType] = useState<PostType>('none');
  const [isActive, setIsActive] = useState(true);

  const [isChecking, setIsChecking] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [checkedBoardKey, setCheckedBoardKey] = useState('');

  const [isCheckingBoardLabel, setIsCheckingBoardLabel] = useState(false);
  const [checkedBoardLabel, setCheckedBoardLabel] = useState('');
  const [isBoardLabelAvailable, setIsBoardLabelAvailable] = useState(false);
  const [boardLabelCheckMessage, setBoardLabelCheckMessage] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  const canUsePostType = useMemo(() => {
    return boardType === 'basic';
  }, [boardType]);

  function resetBoardLabelCheck() {
    setCheckedBoardLabel('');
    setIsBoardLabelAvailable(false);
    setBoardLabelCheckMessage('');
  }

  function handleBoardLabelChange(event: InputChangeEvent) {
    setBoardLabel(event.currentTarget.value);
    setErrorMessage('');
    setSuccessMessage('');
    resetBoardLabelCheck();
  }

  function handleBoardKeyChange(event: InputChangeEvent) {
    const normalizedValue = normalizeBoardKey(event.currentTarget.value);

    setBoardKey(normalizedValue);
    setIsChecked(false);
    setIsAvailable(false);
    setCheckedBoardKey('');
    setSuccessMessage('');
  }

  function handlePostPerPageChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setPostPerPage(Number(event.target.value));
  }

  function handleMarkdownStatusChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setMarkdownStatus(event.target.value as MarkdownStatus);
  }

  function handleWritePermissionChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setWritePermission(event.target.value as WritePermission);
  }

  function handlePostTypeChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPostType(event.target.value as PostType);
  }

  function handleIsActiveChange(event: React.ChangeEvent<HTMLInputElement>) {
    setIsActive(event.target.checked);
  }

  async function loadBoard() {
    const response = await fetch(`/api/boards/${boardName}?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as BoardResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '게시판 정보를 불러오지 못했습니다.');
    }

    if (!result.board) {
      throw new Error('게시판 정보를 불러오지 못했습니다.');
    }

    setBoardId(result.board.id);
    setBoardLabel(result.board.board_label);
    setOriginBoardLabel(result.board.board_label);
    setBoardKey(result.board.board_key);
    setOriginBoardKey(result.board.board_key);
    setBoardType(result.board.board_type);
    setPostPerPage(result.board.post_per_page ?? 5);
    setMarkdownStatus(result.board.markdown_status ?? 'markdown_default');
    setWritePermission(result.board.write_permission ?? 'member');
    setPostType(result.board.post_type ?? 'none');
    setIsActive(result.board.is_active);

    setIsChecked(true);
    setIsAvailable(true);
    setCheckedBoardKey(result.board.board_key);

    setIsBoardLabelAvailable(true);
    setCheckedBoardLabel(result.board.board_label);
  }

  async function handleCheckBoardLabel() {
    const trimmedBoardLabel = boardLabel.trim();

    setErrorMessage('');
    setSuccessMessage('');
    resetBoardLabelCheck();

    if (!trimmedBoardLabel) {
      setErrorMessage('게시판 이름을 입력해주세요.');
      return;
    }

    if (trimmedBoardLabel === originBoardLabel) {
      setCheckedBoardLabel(trimmedBoardLabel);
      setIsBoardLabelAvailable(true);
      setBoardLabelCheckMessage('현재 사용 중인 게시판 이름입니다.');
      return;
    }

    try {
      setIsCheckingBoardLabel(true);

      const response = await fetch('/api/boards/check-label', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          boardLabel: trimmedBoardLabel,
          currentBoardId: boardId,
        }),
      });

      const result = (await response.json()) as BoardLabelCheckResponse;

      if (!response.ok || !result.ok) {
        setCheckedBoardLabel(result.boardLabel ?? trimmedBoardLabel);
        setIsBoardLabelAvailable(false);
        setErrorMessage(result.error ?? '사용할 수 없는 게시판 이름입니다.');
        return;
      }

      setBoardLabel(result.boardLabel ?? trimmedBoardLabel);
      setCheckedBoardLabel(result.boardLabel ?? trimmedBoardLabel);
      setIsBoardLabelAvailable(true);
      setBoardLabelCheckMessage('사용 가능한 게시판 이름입니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 이름 확인에 실패했습니다.');
      } else {
        setErrorMessage('게시판 이름 확인에 실패했습니다.');
      }

      resetBoardLabelCheck();
    } finally {
      setIsCheckingBoardLabel(false);
    }
  }

  async function handleCheckBoardKey() {
    const normalizedBoardKey = normalizeBoardKey(boardKey);

    if (!normalizedBoardKey) {
      setErrorMessage('게시판 식별자를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (hasInvalidBoardKeyCharacters(normalizedBoardKey)) {
      setErrorMessage("영소문자, 하이픈('-'), 숫자만 사용 가능합니다.");
      setSuccessMessage('');
      return;
    }

    if (/^\d/.test(normalizedBoardKey)) {
      setErrorMessage('게시판 식별자는 숫자로 시작할 수 없습니다.');
      setSuccessMessage('');
      return;
    }

    if (normalizedBoardKey.length < 5 || normalizedBoardKey.length > 15) {
      setErrorMessage('게시판 식별자는 5자 이상 15자 이하여야 합니다.');
      setSuccessMessage('');
      return;
    }

    if (normalizedBoardKey === originBoardKey) {
      setIsChecked(true);
      setIsAvailable(true);
      setCheckedBoardKey(normalizedBoardKey);
      setErrorMessage('');
      setSuccessMessage('현재 사용 중인 게시판 식별자입니다.');
      return;
    }

    try {
      setErrorMessage('');
      setSuccessMessage('');
      setIsChecking(true);

      const response = await fetch(`/api/boards/check-key?siteName=${siteName}&boardKey=${normalizedBoardKey}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as BoardKeyCheckResponse;

      if (!response.ok || !result.ok) {
        setIsChecked(true);
        setIsAvailable(false);
        setCheckedBoardKey(normalizedBoardKey);
        setErrorMessage(result.error ?? '사용할 수 없는 게시판 식별자입니다.');
        setSuccessMessage('');
        return;
      }

      setIsChecked(true);
      setIsAvailable(true);
      setCheckedBoardKey(result.boardKey ?? normalizedBoardKey);
      setBoardKey(result.boardKey ?? normalizedBoardKey);
      setErrorMessage('');
      setSuccessMessage('사용 가능한 게시판 식별자입니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 식별자 확인에 실패했습니다.');
      } else {
        setErrorMessage('게시판 식별자 확인에 실패했습니다.');
      }
      setSuccessMessage('');
      setIsChecked(false);
      setIsAvailable(false);
      setCheckedBoardKey('');
    } finally {
      setIsChecking(false);
    }
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedBoardLabel = boardLabel.trim();
    const normalizedBoardKey = normalizeBoardKey(boardKey);

    if (!normalizedBoardLabel) {
      setErrorMessage('게시판 이름을 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!isBoardLabelAvailable || checkedBoardLabel !== normalizedBoardLabel) {
      setErrorMessage('게시판 이름 중복 확인을 해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!normalizedBoardKey) {
      setErrorMessage('게시판 식별자를 입력해주세요.');
      setSuccessMessage('');
      return;
    }

    if (!isChecked || !isAvailable || checkedBoardKey !== normalizedBoardKey) {
      setErrorMessage('게시판 식별자 중복 체크를 해주세요.');
      setSuccessMessage('');
      return;
    }

    try {
      setErrorMessage('');
      setSuccessMessage('');
      setIsSubmitting(true);

      const response = await fetch(`/api/boards/${boardName}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          boardKey: normalizedBoardKey,
          boardLabel: normalizedBoardLabel,
          boardType,
          isActive,
          markdownStatus,
          writePermission,
          postPerPage,
          postType: canUsePostType ? postType : 'none',
        }),
      });

      const result = (await response.json()) as UpdateBoardResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '게시판 수정에 실패했습니다.');
      }

      if (!result.boardName) {
        throw new Error('게시판 수정에 실패했습니다.');
      }

      router.replace(`/${siteName}/manage/contents/posts/c/${result.boardName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 수정에 실패했습니다.');
      } else {
        setErrorMessage('게시판 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setErrorMessage('');
        await loadBoard();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판 정보를 불러오지 못했습니다.');
        }
      }
    })();
  }, [siteName, boardName]);

  return (
    <Container pageTitle="게시판 수정" pageBack={`/${siteName}/manage/contents/posts/c/${boardName}`} menu="contents">
      <div className="container">
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
            {errorMessage ? (
              <Alert severity="error" variant="filled">
                {errorMessage}
              </Alert>
            ) : null}

            {successMessage ? (
              <Alert severity="success" variant="outlined">
                {successMessage}
              </Alert>
            ) : null}

            <TextField
              label="게시판 종류"
              value={
                boardType === 'basic'
                  ? '일반 게시판 (변경 불가)'
                  : boardType === 'gallery'
                    ? '갤러리 게시판 (변경 불가)'
                    : boardType === 'youtube'
                      ? '유튜브 영상 공유 게시판 (변경 불가)'
                      : '피드 게시판 (변경 불가)'
              }
              fullWidth
              size="small"
              slotProps={{ input: { readOnly: true, disabled: true } }}
            />

            <TextField
              label="게시판 식별자 (필수)"
              value={boardKey}
              onChange={handleBoardKeyChange}
              fullWidth
              size="medium"
              helperText={`스텝 관리화면: ${baseUrl}/${siteName}/manage/contents/posts/c/${boardKey}`}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      {baseUrl}/{siteName}/
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={handleCheckBoardKey}
                        disabled={isChecking}
                        size="small"
                      >
                        중복 확인
                      </Button>
                    </InputAdornment>
                  ),
                },
              }}
            />

            <TextField
              label="게시판 이름 (필수)"
              value={boardLabel}
              onChange={handleBoardLabelChange}
              fullWidth
              size="small"
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={handleCheckBoardLabel}
                        disabled={isCheckingBoardLabel}
                        size="small"
                      >
                        중복 확인
                      </Button>
                    </InputAdornment>
                  ),
                },
              }}
            />

            {boardLabelCheckMessage ? (
              <Alert severity="success" variant="outlined">
                {boardLabelCheckMessage}
              </Alert>
            ) : null}

            <FormControl>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                게시판 상태
              </Typography>
              <FormControlLabel
                control={<Switch checked={isActive} onChange={handleIsActiveChange} />}
                label="활성화"
              />
            </FormControl>

            <TextField
              select
              label="목록 표시 개수 (필수)"
              value={postPerPage}
              onChange={handlePostPerPageChange}
              fullWidth
              size="small"
            >
              {POST_PER_PAGE_OPTIONS.map((count) => (
                <MenuItem key={count} value={count}>
                  {count}개씩
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="마크다운 사용"
              value={markdownStatus || 'markdown_default'}
              onChange={handleMarkdownStatusChange}
              fullWidth
              size="small"
            >
              {MARKDOWN_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="글 작성 권한"
              value={writePermission}
              onChange={handleWritePermissionChange}
              fullWidth
              size="small"
            >
              {WRITE_PERMISSION_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>

            {canUsePostType ? (
              <>
                <FormControl>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    말머리/연재 설정
                  </Typography>
                  <RadioGroup row value={postType} onChange={handlePostTypeChange}>
                    <FormControlLabel value="none" control={<Radio />} label="선택 안함" />
                    <FormControlLabel value="prefix" control={<Radio />} label="말머리형" />
                    <FormControlLabel value="series" control={<Radio />} label="연재형" />
                  </RadioGroup>
                </FormControl>

                <Alert severity="warning" variant="outlined">
                  말머리/연재 여부는 한번 설정되면 변경하실 수 없습니다.
                </Alert>
              </>
            ) : null}

            <Stack direction="row" spacing={1.5} justifyContent="flex-end">
              <Button
                component={Link}
                href={`/${siteName}/manage/contents/posts/c/${boardName}`}
                underline="none"
                variant="outlined"
              >
                취소
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                저장
              </Button>
            </Stack>
          </Stack>
        </div>
      </div>
    </Container>
  );
}
