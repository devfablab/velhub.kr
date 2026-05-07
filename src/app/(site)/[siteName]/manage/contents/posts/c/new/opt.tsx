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
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type CreateBoardResponse = {
  ok?: boolean;
  boardName?: string;
  error?: string;
};

type BoardsResponse = {
  boards?: Array<{
    id: string;
    board_key: string;
    board_label: string;
    board_type: string;
  }>;
  limit?: {
    maxBoardCount: number;
    currentBoardCount: number;
    canCreateBoard: boolean;
  };
  error?: string;
};

type PostType = 'none' | 'prefix' | 'series';
type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed';
type MarkdownStatus = 'markdown_default' | 'markdown_on' | 'markdown_off';

const POST_PER_PAGE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

const MARKDOWN_STATUS_OPTIONS: { value: MarkdownStatus; label: string }[] = [
  { value: 'markdown_default', label: '마크다운 전용' },
  { value: 'markdown_on', label: '마크다운 사용가능' },
  { value: 'markdown_off', label: '마크다운 사용안함' },
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

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

  const [boardLabel, setBoardLabel] = useState('');
  const [boardKey, setBoardKey] = useState('');
  const [boardType, setBoardType] = useState<BoardType>('basic');
  const [postPerPage, setPostPerPage] = useState(5);
  const [markdownStatus, setMarkdownStatus] = useState<MarkdownStatus>('markdown_default');
  const [postType, setPostType] = useState<PostType>('none');
  const [isChecking, setIsChecking] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [checkedBoardKey, setCheckedBoardKey] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [maxBoardCount, setMaxBoardCount] = useState(0);
  const [currentBoardCount, setCurrentBoardCount] = useState(0);
  const [canCreateBoard, setCanCreateBoard] = useState(true);

  const canUsePostType = useMemo(() => {
    return boardType === 'basic';
  }, [boardType]);

  function handleBoardLabelChange(event: InputChangeEvent) {
    setBoardLabel(event.currentTarget.value);
  }

  function handleBoardKeyChange(event: InputChangeEvent) {
    const normalizedValue = normalizeBoardKey(event.currentTarget.value);

    setBoardKey(normalizedValue);
    setIsChecked(false);
    setIsAvailable(false);
    setCheckedBoardKey('');
    setSuccessMessage('');
  }

  function handleBoardTypeChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const nextBoardType = event.target.value as BoardType;

    setBoardType(nextBoardType);

    if (nextBoardType !== 'basic') {
      setPostType('none');
    }
  }

  function handlePostPerPageChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setPostPerPage(Number(event.target.value));
  }

  function handleMarkdownStatusChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setMarkdownStatus(event.target.value as MarkdownStatus);
  }

  function handlePostTypeChange(event: React.ChangeEvent<HTMLInputElement>) {
    setPostType(event.target.value as PostType);
  }

  async function loadBoardLimit() {
    const response = await fetch(`/api/boards?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as BoardsResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '게시판 정보를 불러오지 못했습니다.');
    }

    setMaxBoardCount(result.limit?.maxBoardCount ?? 0);
    setCurrentBoardCount(result.limit?.currentBoardCount ?? 0);
    setCanCreateBoard(result.limit?.canCreateBoard ?? false);
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

    try {
      setErrorMessage('');
      setSuccessMessage('');
      setIsChecking(true);

      const response = await fetch(`/api/boards/${normalizedBoardKey}?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as { error?: string };

      if (response.ok) {
        setIsChecked(true);
        setIsAvailable(false);
        setCheckedBoardKey(normalizedBoardKey);
        setErrorMessage('이미 존재하는 게시판 식별자입니다.');
        setSuccessMessage('');
        return;
      }

      if (response.status === 404) {
        setIsChecked(true);
        setIsAvailable(true);
        setCheckedBoardKey(normalizedBoardKey);
        setErrorMessage('');
        setSuccessMessage('사용 가능한 게시판 식별자입니다.');
        return;
      }

      throw new Error(result.error ?? '게시판 식별자 확인에 실패했습니다.');
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

    if (!canCreateBoard) {
      setErrorMessage('더 이상 게시판을 생성할 수 없습니다.');
      setSuccessMessage('');
      return;
    }

    if (!normalizedBoardLabel) {
      setErrorMessage('게시판 이름을 입력해주세요.');
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

      const response = await fetch('/api/boards/new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          boardKey: normalizedBoardKey,
          boardLabel: normalizedBoardLabel,
          boardType,
          isActive: true,
          markdownStatus,
          postPerPage,
          postType: canUsePostType ? postType : 'none',
        }),
      });

      const result = (await response.json()) as CreateBoardResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '게시판 개설에 실패했습니다.');
      }

      if (!result.boardName) {
        throw new Error('게시판 개설에 실패했습니다.');
      }

      router.replace(`/${siteName}/manage/contents/posts/c/${result.boardName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 개설에 실패했습니다.');
      } else {
        setErrorMessage('게시판 개설에 실패했습니다.');
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
        await loadBoardLimit();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판 정보를 불러오지 못했습니다.');
        }
      }
    })();
  }, [siteName]);

  return (
    <Stack spacing={2}>
      {isNotMobile ? (
        <Typography variant="h5" component="h1">
          게시판 만들기
        </Typography>
      ) : null}

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        {!canCreateBoard ? (
          <Alert severity="error" variant="filled">
            더 이상 게시판을 생성할 수 없습니다.
          </Alert>
        ) : null}

        {maxBoardCount > 0 ? (
          <Typography variant="body2">{`생성된 게시판: ${currentBoardCount}개 / ${maxBoardCount}개`}</Typography>
        ) : null}

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

        <TextField select label="게시판 종류" value={boardType} onChange={handleBoardTypeChange} fullWidth size="small">
          <MenuItem value="basic">일반 게시판</MenuItem>
          <MenuItem value="gallery">갤러리 게시판</MenuItem>
          <MenuItem value="youtube">유튜브 영상 공유 게시판</MenuItem>
          <MenuItem value="feed">피드 게시판</MenuItem>
        </TextField>

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
                    disabled={isChecking || !canCreateBoard}
                    size="small"
                  >
                    중복 확인
                  </Button>
                </InputAdornment>
              ),
            },
          }}
        />

        <TextField label="게시판 이름" value={boardLabel} onChange={handleBoardLabelChange} fullWidth size="small" />

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
          value={markdownStatus}
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
              말머리/연재 여부는 한번 설정하면 변경하실 수 없습니다. 유의해 주세요.
            </Alert>
            <Alert severity="info" variant="outlined">
              말머리 및 연재 관리는 게시판을 만든 이후에 관리하실 수 있습니다.
            </Alert>
          </>
        ) : null}

        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
          <Button component={Link} href={`/${siteName}/manage/contents/posts`} underline="none" variant="outlined">
            취소
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting || !canCreateBoard}>
            저장
          </Button>
        </Stack>
      </Stack>
    </Stack>
  );
}
