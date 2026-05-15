'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import PushPinIcon from '@mui/icons-material/PushPin';
import {
  Alert,
  Backdrop,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  MenuItem,
  Pagination,
  PaginationItem,
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
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type ContentRow = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  edited_at: string;
  created_at: string;
  idx: number;
  series_idx: number | null;
  board_id: string;
  site_id: string;
  user_id: string;
  author_name: string;
  is_closed?: boolean;
  closed_by: string | null;
  closed_at: string | null;
  closed_message: string | null;
  closed_by_name: string;
  prefix_id: string | null;
  prefix_label: string | null;
  published_status?: 'draft' | 'published';
  post_count?: number | null;
  is_pin?: boolean;
};

type BoardResponse = {
  board?: {
    id: string;
    board_key: string;
    board_label: string;
    created_at?: string;
    post_per_page?: number | null;
    post_type: 'none' | 'prefix' | 'series';
  };
  contents?: ContentRow[];
  page?: number;
  size?: number;
  totalCount?: number;
  totalPage?: number;
  filter?: 'all' | 'deleted';
};

type ErrorResponse = {
  error?: string;
};

type DeleteResponse = {
  ok?: boolean;
  error?: string;
};

type DeleteMode = 'single' | 'bulk' | null;
type DialogMode = 'delete' | 'restore' | null;

const SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

function parsePage(value: string | null) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return Math.floor(parsedValue);
}

function parseSize(value: string | null) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return null;
  }

  return Math.floor(parsedValue);
}

export default function Opt() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

  const [board, setBoard] = useState<BoardResponse['board'] | null>(null);
  const [contents, setContents] = useState<ContentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [totalPage, setTotalPage] = useState(1);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'deleted'>('all');
  const [closedMessage, setClosedMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const currentPage = parsePage(searchParams.get('page'));
  const sizeParam = parseSize(searchParams.get('size'));
  const filterParam = normalizeText(searchParams.get('filter')).toLowerCase();

  const defaultPostPerPage =
    typeof board?.post_per_page === 'number' && Number.isFinite(board.post_per_page) ? board.post_per_page : 5;

  const currentSize = sizeParam ?? defaultPostPerPage;
  const safeCurrentPage = currentPage > totalPage ? totalPage : currentPage;

  const currentPageIds = useMemo(() => contents.map((content) => content.id), [contents]);

  const isAllCurrentPageChecked = useMemo(() => {
    return currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));
  }, [currentPageIds, selectedIds]);

  const isSomeCurrentPageChecked = useMemo(() => {
    return currentPageIds.some((id) => selectedIds.includes(id));
  }, [currentPageIds, selectedIds]);

  useEffect(() => {
    async function loadBoard() {
      try {
        if (hasLoaded) {
          setIsFetching(true);
        }

        setErrorMessage('');

        const response = await fetch(
          `/api/boards/${boardName}?siteName=${siteName}&page=${currentPage}${
            sizeParam ? `&size=${sizeParam}` : ''
          }${filterParam ? `&filter=${filterParam}` : ''}`,
          {
            method: 'GET',
            credentials: 'include',
          },
        );

        const result = (await response.json()) as BoardResponse | ErrorResponse;

        if (!response.ok) {
          throw new Error(
            'error' in result ? result.error || '게시판을 불러오지 못했습니다.' : '게시판을 불러오지 못했습니다.',
          );
        }

        if (!('board' in result) || !result.board) {
          throw new Error('게시판을 불러오지 못했습니다.');
        }

        setBoard(result.board);
        setContents(Array.isArray(result.contents) ? result.contents : []);
        setTotalPage(typeof result.totalPage === 'number' && result.totalPage > 0 ? result.totalPage : 1);
        setCurrentFilter(result.filter === 'deleted' ? 'deleted' : 'all');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판을 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판을 불러오지 못했습니다.');
        }
      } finally {
        setHasLoaded(true);
        setIsLoading(false);
        setIsFetching(false);
      }
    }

    void loadBoard();
  }, [boardName, siteName, currentPage, sizeParam, filterParam, reloadKey, hasLoaded]);

  useEffect(() => {
    setSelectedIds((previousIds) => previousIds.filter((id) => contents.some((content) => content.id === id)));
  }, [contents]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (currentPage > totalPage) {
      const nextSearchParams = new URLSearchParams(searchParams.toString());

      if (totalPage <= 1) {
        nextSearchParams.delete('page');
      } else {
        nextSearchParams.set('page', String(totalPage));
      }

      const nextQuery = nextSearchParams.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname);
    }
  }, [currentPage, isLoading, pathname, router, searchParams, totalPage]);

  function getListHref({ page, size, filter }: { page?: number; size?: number; filter?: 'all' | 'deleted' }) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    const nextPage = page ?? safeCurrentPage;
    const nextSize = size ?? currentSize;
    const nextFilter = filter ?? currentFilter;

    if (nextPage <= 1) {
      nextSearchParams.delete('page');
    } else {
      nextSearchParams.set('page', String(nextPage));
    }

    nextSearchParams.set('size', String(nextSize));

    if (nextFilter === 'deleted') {
      nextSearchParams.set('filter', 'deleted');
    } else {
      nextSearchParams.delete('filter');
    }

    const nextQuery = nextSearchParams.toString();
    return nextQuery ? `${pathname}?${nextQuery}` : pathname;
  }

  function handleMoveToNew() {
    router.push(`/${siteName}/manage/contents/posts/c/${boardName}/new`);
  }

  function handleMoveToPrefixManage() {
    router.push(`/${siteName}/manage/contents/posts/c/${boardName}/prefix`);
  }

  function handleToggleAllCurrentPage() {
    if (isAllCurrentPageChecked) {
      setSelectedIds((previousIds) => previousIds.filter((id) => !currentPageIds.includes(id)));
      return;
    }

    setSelectedIds((previousIds) => Array.from(new Set([...previousIds, ...currentPageIds])));
  }

  function handleToggleOne(id: string) {
    setSelectedIds((previousIds) => {
      if (previousIds.includes(id)) {
        return previousIds.filter((selectedId) => selectedId !== id);
      }

      return [...previousIds, id];
    });
  }

  function handleOpenSingleDeleteDialog(content: ContentRow) {
    setDeleteMode('single');
    setDeleteTarget(content);
    setDialogMode('delete');
    setClosedMessage('');
    setDialogErrorMessage('');
  }

  function handleOpenBulkDeleteDialog() {
    if (selectedIds.length === 0) {
      return;
    }

    setDeleteMode('bulk');
    setDeleteTarget(null);
    setDialogMode('delete');
    setClosedMessage('');
    setDialogErrorMessage('');
  }

  function handleOpenRestoreDialog(content: ContentRow) {
    setDeleteMode('single');
    setDeleteTarget(content);
    setDialogMode('restore');
    setClosedMessage('');
    setDialogErrorMessage('');
  }

  function handleCloseDeleteDialog() {
    if (isDeleting) {
      return;
    }

    setDeleteMode(null);
    setDeleteTarget(null);
    setDialogMode(null);
    setClosedMessage('');
    setDialogErrorMessage('');
  }

  function handleClosedMessageChange(event: InputChangeEvent) {
    setClosedMessage(event.currentTarget.value);
    setDialogErrorMessage('');
  }

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    if (dialogMode === 'restore') {
      if (!deleteTarget) {
        return;
      }

      try {
        setErrorMessage('');
        setIsDeleting(true);

        const response = await fetch(`/api/boards/${boardName}/${deleteTarget.slug}/delete?siteName=${siteName}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'restore',
          }),
        });

        const result = (await response.json()) as DeleteResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '게시물 복구에 실패했습니다.');
        }

        setDeleteMode(null);
        setDeleteTarget(null);
        setDialogMode(null);
        setClosedMessage('');
        setDialogErrorMessage('');
        setSelectedIds((previousIds) => previousIds.filter((id) => id !== deleteTarget.id));
        setReloadKey((previousValue) => previousValue + 1);
        return;
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setDialogErrorMessage(unknownError.message || '게시물 복구에 실패했습니다.');
        } else {
          setDialogErrorMessage('게시물 복구에 실패했습니다.');
        }
        return;
      } finally {
        setIsDeleting(false);
      }
    }

    if (!closedMessage.trim()) {
      setDialogErrorMessage('삭제 사유를 입력해주세요.');
      return;
    }

    try {
      setErrorMessage('');
      setDialogErrorMessage('');
      setIsDeleting(true);

      if (deleteMode === 'single') {
        if (!deleteTarget) {
          return;
        }

        const response = await fetch(`/api/boards/${boardName}/${deleteTarget.slug}/delete?siteName=${siteName}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'close',
            closedMessage: closedMessage.trim(),
          }),
        });

        const result = (await response.json()) as DeleteResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '게시물 삭제에 실패했습니다.');
        }
      }

      if (deleteMode === 'bulk') {
        for (const selectedId of selectedIds) {
          const selectedContent = contents.find((content) => content.id === selectedId);

          if (!selectedContent) {
            continue;
          }

          const response = await fetch(`/api/boards/${boardName}/${selectedContent.slug}/delete?siteName=${siteName}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              action: 'close',
              closedMessage: closedMessage.trim(),
            }),
          });

          const result = (await response.json()) as DeleteResponse;

          if (!response.ok) {
            throw new Error(result.error ?? '게시물 삭제에 실패했습니다.');
          }
        }
      }

      setDeleteMode(null);
      setDeleteTarget(null);
      setDialogMode(null);
      setClosedMessage('');
      setDialogErrorMessage('');
      setSelectedIds([]);
      setReloadKey((previousValue) => previousValue + 1);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '게시물 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('게시물 삭제에 실패했습니다.');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={2}>
      {isNotMobile ? (
        <Typography variant="h4" component="h1" sx={{ mb: 2.5 }}>
          {board?.board_label ? board.board_label : '글 목록'}
        </Typography>
      ) : (
        <Typography variant="h5" component="h2">
          {board?.board_label}
        </Typography>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Stack direction="row" spacing={1}>
          {board?.post_type === 'prefix' ? (
            <Button type="button" variant="outlined" onClick={handleMoveToPrefixManage}>
              말머리 관리
            </Button>
          ) : null}

          {selectedIds.length > 0 && currentFilter !== 'deleted' ? (
            <Button type="button" color="error" variant="outlined" onClick={handleOpenBulkDeleteDialog}>
              삭제
            </Button>
          ) : null}
        </Stack>

        <Button type="button" variant="contained" onClick={handleMoveToNew}>
          새 글 쓰기
        </Button>
      </Stack>

      <Stack
        direction="row"
        spacing={1}
        justifyContent={isNotMobile ? 'space-between' : 'flex-end'}
        alignItems="center"
      >
        <ButtonGroup size="medium">
          <Button
            LinkComponent={NextLink}
            type="button"
            variant={currentFilter === 'all' ? 'contained' : 'outlined'}
            href={getListHref({ page: 1, filter: 'all' })}
          >
            전체글
          </Button>

          <Button
            LinkComponent={NextLink}
            type="button"
            variant={currentFilter === 'deleted' ? 'contained' : 'outlined'}
            href={getListHref({ page: 1, filter: 'deleted' })}
          >
            삭제글
          </Button>
        </ButtonGroup>

        <TextField
          select
          value={currentSize}
          onChange={(event) => {
            router.push(getListHref({ page: 1, size: Number(event.target.value) }));
          }}
          size="small"
          sx={{ minWidth: 180 }}
        >
          {SIZE_OPTIONS.map((sizeOption) => (
            <MenuItem key={sizeOption} value={sizeOption}>
              {sizeOption}개씩
              {board?.post_per_page === sizeOption ? ' (기본값)' : ''}
            </MenuItem>
          ))}
        </TextField>
      </Stack>

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      <Box sx={{ position: 'relative' }}>
        <TableContainer variant="outlined" component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={isAllCurrentPageChecked}
                    indeterminate={!isAllCurrentPageChecked && isSomeCurrentPageChecked}
                    onChange={handleToggleAllCurrentPage}
                  />
                </TableCell>
                <TableCell />
                <TableCell>제목</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>조회수</TableCell>
                <TableCell>작성일</TableCell>
                <TableCell>작성자</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>삭제자</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>삭제일</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>삭제사유</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>

            <TableBody>
              {contents.map((content) => (
                <TableRow key={content.id}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selectedIds.includes(content.id)} onChange={() => handleToggleOne(content.id)} />
                  </TableCell>

                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {content.is_pin ? <PushPinIcon fontSize="small" /> : (content.series_idx ?? content.idx)}
                  </TableCell>

                  <TableCell>
                    <Stack direction="row" gap={1}>
                      {content.published_status === 'draft' ? (
                        <Chip label="임시저장글" color="warning" size="small" />
                      ) : null}
                      {content.prefix_label ? (
                        <Chip label={content.prefix_label} size="small" variant="outlined" />
                      ) : null}

                      <Link
                        href={`/${siteName}/manage/contents/posts/c/${boardName}/${content.slug}`}
                        sx={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: 270,
                          display: 'inline-block',
                        }}
                      >
                        {content.subject}
                      </Link>
                    </Stack>
                  </TableCell>

                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {typeof content.post_count === 'number' ? content.post_count : 0}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeDetail(content.created_at)}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{content.author_name}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{content.closed_by_name}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    {content.closed_at ? formatDateTimeDetail(content.closed_at) : ''}
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{content.closed_message}</TableCell>

                  <TableCell align="right">
                    {content.is_closed ? (
                      <Button
                        type="button"
                        variant="outlined"
                        color="warning"
                        onClick={() => handleOpenRestoreDialog(content)}
                      >
                        복구
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        color="error"
                        variant="outlined"
                        onClick={() => handleOpenSingleDeleteDialog(content)}
                      >
                        삭제
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}

              {contents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center">
                    {currentFilter === 'deleted' ? '삭제된 글이 없습니다.' : '글이 없습니다.'}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>

          <Backdrop
            open={isFetching}
            sx={{
              position: 'absolute',
              zIndex: 1,
              color: '#fff',
            }}
          >
            <Stack spacing={2} alignItems="center">
              <Stack justifyContent="center" alignItems="center">
                <LoadingIndicator />
              </Stack>
            </Stack>
          </Backdrop>
        </TableContainer>
      </Box>

      {totalPage > 1 ? (
        <Stack alignItems="center">
          <Pagination
            page={safeCurrentPage}
            count={totalPage}
            color="primary"
            siblingCount={1}
            boundaryCount={1}
            renderItem={(item) => (
              <PaginationItem {...item} component={NextLink} href={getListHref({ page: item.page ?? 1 })} />
            )}
          />
        </Stack>
      ) : null}

      <Dialog open={dialogMode === 'delete'} onClose={handleCloseDeleteDialog} fullWidth maxWidth="sm">
        <DialogTitle>게시물 삭제</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info" variant="filled">
              삭제시 언제든 복구가 가능합니다.
              <br />
              삭제사유를 입력해 주세요. (필수)
            </Alert>

            <TextField
              label="삭제 사유"
              value={closedMessage}
              onChange={handleClosedMessageChange}
              fullWidth
              multiline
              minRows={3}
              size="small"
            />

            {dialogErrorMessage ? (
              <Alert severity="error" variant="outlined">
                {dialogErrorMessage}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            취소
          </Button>
          <Button type="button" variant="contained" color="primary" onClick={handleDelete} disabled={isDeleting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={dialogMode === 'restore'} onClose={handleCloseDeleteDialog} fullWidth maxWidth="xs">
        <DialogTitle>게시물 복구</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>
              해당 게시물을 복구하시겠습니까?
              <br />
              복구하시면 해당 게시물을 모두가 볼 수 있게 됩니다.
            </Typography>

            {dialogErrorMessage ? (
              <Alert severity="error" variant="filled">
                {dialogErrorMessage}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            취소
          </Button>
          <Button type="button" variant="contained" color="primary" onClick={handleDelete} disabled={isDeleting}>
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
