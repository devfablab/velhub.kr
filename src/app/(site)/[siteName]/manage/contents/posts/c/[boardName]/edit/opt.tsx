'use client';

import { type JSX, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import {
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
import { runInputAdornmentAction } from '@/lib/input/runInputAdornmentAction';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import PopupMessage from '@/components/PopupMessage';
import Container from '../../../../../menu';
import styles from '@/app/manage.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type PostType = 'none' | 'prefix' | 'series';
type BoardType = 'basic' | 'gallery' | 'youtube' | 'feed';
type MarkdownStatus = 'markdown_default' | 'markdown_on' | 'markdown_off';
type WritePermission = 'member' | 'manager' | 'community-manager' | 'owner';

export type BoardResponse = {
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

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: BoardResponse | null;
  initialError: string;
}) {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const initialBoard = initialData?.board;
  const [boardId] = useState(initialBoard?.id ?? '');
  const [boardLabel, setBoardLabel] = useState(initialBoard?.board_label ?? '');
  const [originBoardLabel] = useState(initialBoard?.board_label ?? '');
  const [boardKey, setBoardKey] = useState(initialBoard?.board_key ?? '');
  const [originBoardKey] = useState(initialBoard?.board_key ?? '');
  const [boardType] = useState<BoardType>(initialBoard?.board_type ?? 'basic');
  const [postPerPage, setPostPerPage] = useState(initialBoard?.post_per_page ?? 5);
  const [markdownStatus, setMarkdownStatus] = useState<MarkdownStatus>(
    initialBoard?.markdown_status ?? 'markdown_default',
  );
  const [writePermission, setWritePermission] = useState<WritePermission>(initialBoard?.write_permission ?? 'member');
  const [postType, setPostType] = useState<PostType>(initialBoard?.post_type ?? 'none');
  const [isActive, setIsActive] = useState(initialBoard?.is_active ?? true);

  const [isChecking, setIsChecking] = useState(false);
  const [isChecked, setIsChecked] = useState(Boolean(initialBoard));
  const [isAvailable, setIsAvailable] = useState(Boolean(initialBoard));
  const [checkedBoardKey, setCheckedBoardKey] = useState(initialBoard?.board_key ?? '');

  const [isCheckingBoardLabel, setIsCheckingBoardLabel] = useState(false);
  const [checkedBoardLabel, setCheckedBoardLabel] = useState(initialBoard?.board_label ?? '');
  const [isBoardLabelAvailable, setIsBoardLabelAvailable] = useState(Boolean(initialBoard));
  const [boardLabelCheckMessage, setBoardLabelCheckMessage] = useState('');

  const [errorMessage, setErrorMessage] = useState(initialError);
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  const canUsePostType = useMemo(() => {
    return boardType === 'basic' || boardType === 'gallery';
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
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/c/${boardName}`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']} ${styles.Content}`}>
          {isMobile ? (
            <Typography variant="h6" component="h2" sx={{ p: 2 }}>
              게시판 수정
            </Typography>
          ) : null}

          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
          {boardId ? (
            <div className={`paper ${styles.paper}`}>
              <Stack component="form" gap={2.5} onSubmit={handleSubmit}>
                <PopupMessage
                  open={Boolean(successMessage)}
                  message={successMessage}
                  onClose={() => setSuccessMessage('')}
                />

                <Stack gap={1}>
                  <Typography variant="subtitle2">게시판 종류 *</Typography>
                  <TextField
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
                </Stack>

                <Stack gap={1}>
                  <Typography variant="subtitle2">게시판 식별자 *</Typography>
                  <TextField
                    value={boardKey}
                    onChange={handleBoardKeyChange}
                    onKeyDown={(event) => runInputAdornmentAction(event, handleCheckBoardKey, isChecking)}
                    fullWidth
                    size="small"
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
                            <button
                              type="button"
                              className="button small action"
                              onClick={handleCheckBoardKey}
                              disabled={isChecking}
                            >
                              중복 확인
                            </button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />
                </Stack>

                <Stack gap={1}>
                  <Typography variant="subtitle2">게시판 이름 *</Typography>
                  <TextField
                    value={boardLabel}
                    onChange={handleBoardLabelChange}
                    onKeyDown={(event) => runInputAdornmentAction(event, handleCheckBoardLabel, isCheckingBoardLabel)}
                    fullWidth
                    size="small"
                    slotProps={{
                      input: {
                        endAdornment: (
                          <InputAdornment position="end">
                            <button
                              type="button"
                              className="button small action"
                              onClick={handleCheckBoardLabel}
                              disabled={isCheckingBoardLabel}
                            >
                              중복 확인
                            </button>
                          </InputAdornment>
                        ),
                      },
                    }}
                  />

                  <PopupMessage
                    open={Boolean(boardLabelCheckMessage)}
                    message={boardLabelCheckMessage}
                    onClose={() => setBoardLabelCheckMessage('')}
                  />
                </Stack>

                <FormControl>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    게시판 상태
                  </Typography>
                  <FormControlLabel
                    control={<IOSSwitch sx={{ m: 1 }} checked={isActive} onChange={handleIsActiveChange} />}
                    label="활성화"
                  />
                </FormControl>

                <Stack gap={1}>
                  <Typography variant="subtitle2">목록 표시 개수 *</Typography>
                  <TextField select value={postPerPage} onChange={handlePostPerPageChange} fullWidth size="small">
                    {POST_PER_PAGE_OPTIONS.map((count) => (
                      <MenuItem key={count} value={count}>
                        {postPerPage === count ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {count}개씩
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <Stack gap={1}>
                  <Typography variant="subtitle2">마크다운 사용여부 *</Typography>
                  <TextField
                    select
                    value={markdownStatus || 'markdown_default'}
                    onChange={handleMarkdownStatusChange}
                    fullWidth
                    size="small"
                  >
                    {MARKDOWN_STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {markdownStatus === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                <Stack gap={1}>
                  <Typography variant="subtitle2">글 작성 권한 *</Typography>
                  <TextField
                    select
                    value={writePermission}
                    onChange={handleWritePermissionChange}
                    fullWidth
                    size="small"
                  >
                    {WRITE_PERMISSION_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {writePermission === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>

                {canUsePostType ? (
                  <>
                    <FormControl>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        {boardType === 'gallery' ? '연재 설정' : '말머리/연재 설정'}
                      </Typography>
                      <RadioGroup row value={postType} onChange={handlePostTypeChange}>
                        <FormControlLabel value="none" control={<Radio />} label="선택 안함" />
                        {boardType === 'basic' ? (
                          <FormControlLabel value="prefix" control={<Radio />} label="말머리형" />
                        ) : null}
                        <FormControlLabel value="series" control={<Radio />} label="연재형" />
                      </RadioGroup>
                    </FormControl>

                    <p className="alert warning">
                      <WarningAmberRoundedIcon />
                      <span>
                        {boardType === 'gallery' ? '연재' : '말머리/연재'} 여부는 한번 설정되면 변경하실 수 없습니다.
                      </span>
                    </p>
                  </>
                ) : null}

                <Stack direction="row" gap={1.5} justifyContent="flex-end">
                  <Anchor href={`/${siteName}/manage/contents/posts/c/${boardName}`} className="button medium cancel">
                    취소
                  </Anchor>
                  {isMobile ? (
                    <div className={styles['button-top']}>
                      <button type="submit" className={`button ${styles.button}`} disabled={isSubmitting}>
                        저장
                      </button>
                    </div>
                  ) : (
                    <button type="submit" className="button medium submit" disabled={isSubmitting}>
                      저장
                    </button>
                  )}
                </Stack>
              </Stack>
            </div>
          ) : null}
        </div>
      </div>
    </Container>
  );
}
