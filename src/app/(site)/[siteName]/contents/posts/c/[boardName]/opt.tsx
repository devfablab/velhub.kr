'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@mui/material/Link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { formatDate } from '@/lib/utils';

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
  };
  contents?: ContentRow[];
};

type ErrorResponse = {
  error?: string;
};

type DeleteResponse = {
  ok?: boolean;
  error?: string;
};

type Props = {
  siteName: string;
  boardName: string;
};

const PAGE_SIZE = 10;
const PAGE_GROUP_SIZE = 5;

function parsePage(value: string | null) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return Math.floor(parsedValue);
}

export default function Opt({ siteName, boardName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [boardLabel, setBoardLabel] = useState('');
  const [contents, setContents] = useState<ContentRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<'single' | 'bulk' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContentRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentPage = parsePage(searchParams.get('page'));

  const totalPage = useMemo(() => {
    const pageCount = Math.ceil(contents.length / PAGE_SIZE);
    return pageCount > 0 ? pageCount : 1;
  }, [contents.length]);

  const safeCurrentPage = currentPage > totalPage ? totalPage : currentPage;

  const currentPageContents = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return contents.slice(startIndex, startIndex + PAGE_SIZE);
  }, [contents, safeCurrentPage]);

  const currentPageIds = useMemo(() => currentPageContents.map((content) => content.id), [currentPageContents]);

  const isAllCurrentPageChecked = useMemo(() => {
    return currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));
  }, [currentPageIds, selectedIds]);

  const isSomeCurrentPageChecked = useMemo(() => {
    return currentPageIds.some((id) => selectedIds.includes(id));
  }, [currentPageIds, selectedIds]);

  const pageGroupStart = Math.floor((safeCurrentPage - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const pageGroupEnd = Math.min(pageGroupStart + PAGE_GROUP_SIZE - 1, totalPage);

  const pageNumberList = useMemo(() => {
    const numbers: number[] = [];

    for (let pageNumber = pageGroupStart; pageNumber <= pageGroupEnd; pageNumber += 1) {
      numbers.push(pageNumber);
    }

    return numbers;
  }, [pageGroupEnd, pageGroupStart]);

  useEffect(() => {
    async function loadBoard() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/boards/${boardName}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        if (!response.ok) {
          const errorResult = (await response.json()) as ErrorResponse;

          throw new Error(errorResult.error || '게시판을 불러오지 못했습니다.');
        }

        const result = (await response.json()) as BoardResponse;

        setBoardLabel(result.board?.board_label ?? '');
        setContents(Array.isArray(result.contents) ? result.contents : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판을 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadBoard();
  }, [boardName, siteName]);

  useEffect(() => {
    setSelectedIds((previousIds) => previousIds.filter((id) => contents.some((content) => content.id === id)));
  }, [contents]);

  useEffect(() => {
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
  }, [currentPage, pathname, router, searchParams, totalPage]);

  function moveToPage(pageNumber: number) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (pageNumber <= 1) {
      nextSearchParams.delete('page');
    } else {
      nextSearchParams.set('page', String(pageNumber));
    }

    const nextQuery = nextSearchParams.toString();
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname);
  }

  function handleMoveToNew() {
    router.push(`/${siteName}/contents/posts/c/${boardName}/new`);
  }

  function handleMoveToDetail(contentId: string) {
    router.push(`/${siteName}/contents/posts/c/${boardName}/${contentId}`);
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
    <>
      <Stack spacing={2}>
        <Typography>{boardLabel}</Typography>

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

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

        <Paper elevation={0} sx={{ overflowX: 'auto' }}>
          <Table>
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
                <TableCell align="right">글 삭제</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {currentPageContents.map((content) => (
                <TableRow key={content.id}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selectedIds.includes(content.id)} onChange={() => handleToggleOne(content.id)} />
                  </TableCell>

                  <TableCell>
                    <Button
                      type="button"
                      variant="text"
                      onClick={() => handleMoveToDetail(content.slug)}
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

              {currentPageContents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    글이 없습니다.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </Paper>

        {contents.length > 0 ? (
          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
            <Button
              type="button"
              variant="outlined"
              onClick={() => moveToPage(pageGroupStart - 1)}
              disabled={pageGroupStart <= 1}
            >
              이전
            </Button>

            {pageNumberList.map((pageNumber) => (
              <Button
                key={pageNumber}
                type="button"
                variant={pageNumber === safeCurrentPage ? 'contained' : 'outlined'}
                onClick={() => moveToPage(pageNumber)}
              >
                {pageNumber}
              </Button>
            ))}

            <Button
              type="button"
              variant="outlined"
              onClick={() => moveToPage(pageGroupEnd + 1)}
              disabled={pageGroupEnd >= totalPage}
            >
              다음
            </Button>
          </Stack>
        ) : null}
      </Stack>

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
    </>
  );
}
