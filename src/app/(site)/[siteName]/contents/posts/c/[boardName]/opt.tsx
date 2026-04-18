'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import {
  Alert,
  Backdrop,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { formatDate, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type ContentRow = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  edited_at: string;
  created_at: string;
  idx: number;
  board_id: string;
  site_id: string;
  user_id: string;
  author_name: string;
  is_closed?: boolean;
};

type BoardResponse = {
  board?: {
    id: string;
    board_key: string;
    board_label: string;
    created_at?: string;
    post_per_page?: number | null;
  };
  contents?: ContentRow[];
  page?: number;
  size?: number;
  totalCount?: number;
  totalPage?: number;
};

type ErrorResponse = {
  error?: string;
};

type DeleteResponse = {
  ok?: boolean;
  error?: string;
};

const SIZE_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

type DeleteMode = 'single' | 'bulk' | null;

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
  const isMobile = !isNotMobile;

  const [board, setBoard] = useState<BoardResponse['board'] | null>(null);
  const [contents, setContents] = useState<ContentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [totalPage, setTotalPage] = useState(1);

  const currentPage = parsePage(searchParams.get('page'));
  const sizeParam = parseSize(searchParams.get('size'));

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
          `/api/boards/${boardName}?siteName=${siteName}&page=${currentPage}${sizeParam ? `&size=${sizeParam}` : ''}`,
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
  }, [boardName, siteName, currentPage, sizeParam]);

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

  function getListHref(pageNumber: number, size?: number) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());
    const nextSize = size ?? currentSize;

    if (pageNumber <= 1) {
      nextSearchParams.delete('page');
    } else {
      nextSearchParams.set('page', String(pageNumber));
    }

    nextSearchParams.set('size', String(nextSize));

    const nextQuery = nextSearchParams.toString();
    return nextQuery ? `${pathname}?${nextQuery}` : pathname;
  }

  function handleMoveToNew() {
    router.push(`/${siteName}/contents/posts/c/${boardName}/new`);
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
  }

  function handleOpenBulkDeleteDialog() {
    if (selectedIds.length === 0) {
      return;
    }

    setDeleteMode('bulk');
    setDeleteTarget(null);
  }

  function handleCloseDeleteDialog() {
    if (isDeleting) {
      return;
    }

    setDeleteMode(null);
    setDeleteTarget(null);
  }

  async function handleDelete() {
    const targets =
      deleteMode === 'single' && deleteTarget
        ? [deleteTarget]
        : contents.filter((content) => selectedIds.includes(content.id));

    if (targets.length === 0) {
      return;
    }

    try {
      setErrorMessage('');
      setIsDeleting(true);

      for (const target of targets) {
        const response = await fetch(`/api/boards/${boardName}/${target.slug}/delete?siteName=${siteName}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        const result = (await response.json()) as DeleteResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '글 삭제에 실패했습니다.');
        }
      }

      const deletedIds = new Set(targets.map((target) => target.id));

      setContents((previousContents) => previousContents.filter((content) => !deletedIds.has(content.id)));
      setSelectedIds((previousIds) => previousIds.filter((id) => !deletedIds.has(id)));
      setDeleteMode(null);
      setDeleteTarget(null);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '글 삭제에 실패했습니다.');
      } else {
        setErrorMessage('글 삭제에 실패했습니다.');
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
      {isNotMobile && (
        <Typography variant="h4" component="h1" sx={{ mb: 2.5 }}>
          글 목록
        </Typography>
      )}

      <Typography>{board?.board_label ?? ''}</Typography>

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {selectedIds.length > 0 ? (
          <Button type="button" color="error" variant="outlined" onClick={handleOpenBulkDeleteDialog}>
            글 삭제
          </Button>
        ) : (
          <span />
        )}

        <Button type="button" variant="contained" onClick={handleMoveToNew}>
          새 글 쓰기
        </Button>
      </Stack>

      <Stack direction="row" justifyContent="flex-end" alignItems="center">
        <TextField
          select
          label="보기 방식"
          value={currentSize}
          onChange={(event) => {
            router.push(getListHref(1, Number(event.target.value)));
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
        <TableContainer elevation={3} component={Paper}>
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
                <TableCell>제목</TableCell>
                <TableCell>작성일</TableCell>
                <TableCell>작성자</TableCell>
                <TableCell>공개여부</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>

            <TableBody>
              {contents.map((content) => (
                <TableRow key={content.id}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selectedIds.includes(content.id)} onChange={() => handleToggleOne(content.id)} />
                  </TableCell>

                  <TableCell>
                    <Button
                      LinkComponent={NextLink}
                      type="button"
                      variant="text"
                      href={`/${siteName}/contents/posts/c/${boardName}/${content.slug}`}
                      sx={{
                        p: 0,
                        minWidth: 0,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                      }}
                    >
                      {content.subject}
                    </Button>
                  </TableCell>

                  <TableCell>{formatDate(content.created_at)}</TableCell>
                  <TableCell>{content.author_name}</TableCell>
                  <TableCell>{content.is_closed === true ? '비공개' : '공개'}</TableCell>

                  <TableCell align="right">
                    <Button
                      type="button"
                      color="error"
                      variant="outlined"
                      onClick={() => handleOpenSingleDeleteDialog(content)}
                    >
                      글 삭제
                    </Button>
                  </TableCell>
                </TableRow>
              ))}

              {contents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    글이 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
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
      </Box>

      {totalPage > 1 ? (
        <Stack alignItems="center">
          <Pagination
            page={safeCurrentPage}
            count={totalPage}
            color="primary"
            siblingCount={1}
            boundaryCount={1}
            renderItem={(item) => <PaginationItem {...item} component={NextLink} href={getListHref(item.page ?? 1)} />}
          />
        </Stack>
      ) : null}
      <Dialog open={deleteMode !== null} onClose={handleCloseDeleteDialog}>
        <DialogTitle>글 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            {deleteMode === 'single' ? '이 글을 삭제하시겠습니까?' : '선택한 글을 삭제하시겠습니까?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            취소
          </Button>
          <Button type="button" color="error" variant="contained" onClick={handleDelete} disabled={isDeleting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
