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
import { formatDateTimeFull } from '@/lib/utils';

type PostRow = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  edited_at: string;
  thumbnail_image: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  idx: number;
  user_id: string;
  site_id: string;
  board_id: string;
  created_at: string;
  author_name: string;
};

type Props = {
  siteName: string;
};

type DeleteMode = 'single' | 'bulk' | null;

const PAGE_SIZE = 10;
const PAGE_GROUP_SIZE = 5;

function parsePage(value: string | null) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return Math.floor(parsedValue);
}

export default function Opt({ siteName }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [posts, setPosts] = useState<PostRow[]>([]);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<PostRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const currentPage = parsePage(searchParams.get('page'));

  const totalPage = useMemo(() => {
    const pageCount = Math.ceil(posts.length / PAGE_SIZE);
    return pageCount > 0 ? pageCount : 1;
  }, [posts.length]);

  const safeCurrentPage = currentPage > totalPage ? totalPage : currentPage;

  const currentPagePosts = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
    return posts.slice(startIndex, startIndex + PAGE_SIZE);
  }, [posts, safeCurrentPage]);

  const currentPageIds = useMemo(() => currentPagePosts.map((post) => post.id), [currentPagePosts]);

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
    async function loadPosts() {
      try {
        const statusResponse = await fetch(`/api/posts/status?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const statusResult = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(statusResult.error ?? '블로그 상태를 확인하지 못했습니다.');
        }

        if (!statusResult.hasBoard || !statusResult.boardName) {
          setBoardName(null);
          setPosts([]);
          return;
        }

        setBoardName(statusResult.boardName);

        const boardResponse = await fetch(`/api/boards/${statusResult.boardName}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const boardResult = await boardResponse.json();

        if (!boardResponse.ok) {
          throw new Error(boardResult.error ?? '블로그 글 목록을 불러오지 못했습니다.');
        }

        setPosts(Array.isArray(boardResult.contents) ? (boardResult.contents as PostRow[]) : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '블로그 글 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('블로그 글 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPosts();
  }, [siteName]);

  useEffect(() => {
    setSelectedIds((previousIds) => previousIds.filter((id) => posts.some((post) => post.id === id)));
  }, [posts]);

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

  function handleMoveToDetail(slug: string) {
    router.push(`/${siteName}/contents/posts/${slug}`);
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

  function handleOpenSingleDeleteDialog(post: PostRow) {
    setDeleteMode('single');
    setDeleteTarget(post);
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
    if (!boardName || isDeleting) {
      return;
    }

    const targets =
      deleteMode === 'single' && deleteTarget ? [deleteTarget] : posts.filter((post) => selectedIds.includes(post.id));

    if (targets.length === 0) {
      return;
    }

    setErrorMessage('');
    setIsDeleting(true);

    try {
      for (const target of targets) {
        const response = await fetch(`/api/boards/${boardName}/${target.slug}/delete?siteName=${siteName}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '게시물 삭제에 실패했습니다.');
        }
      }

      const deletedIds = new Set(targets.map((target) => target.id));

      setPosts((previousPosts) => previousPosts.filter((post) => !deletedIds.has(post.id)));
      setSelectedIds((previousIds) => previousIds.filter((id) => !deletedIds.has(id)));
      setDeleteMode(null);
      setDeleteTarget(null);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시물 삭제에 실패했습니다.');
      } else {
        setErrorMessage('게시물 삭제에 실패했습니다.');
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
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {selectedIds.length > 0 ? (
          <Button type="button" color="error" variant="outlined" onClick={handleOpenBulkDeleteDialog}>
            게시물 삭제
          </Button>
        ) : (
          <span />
        )}

        <Button LinkComponent={Link} type="button" variant="contained" href={`/${siteName}/contents/posts/new`}>
          글쓰기
        </Button>
      </Stack>

      {posts.length === 0 ? (
        <Paper elevation={0} sx={{ p: 3 }}>
          <Typography>개설된 블로그 글이 없습니다</Typography>
        </Paper>
      ) : (
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
                <TableCell align="right">게시물 삭제</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {currentPagePosts.map((post) => (
                <TableRow key={post.id}>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selectedIds.includes(post.id)} onChange={() => handleToggleOne(post.id)} />
                  </TableCell>

                  <TableCell>
                    <Button
                      type="button"
                      variant="text"
                      onClick={() => handleMoveToDetail(post.slug)}
                      sx={{
                        p: 0,
                        minWidth: 0,
                        justifyContent: 'flex-start',
                        textAlign: 'left',
                      }}
                    >
                      {post.subject}
                    </Button>
                  </TableCell>

                  <TableCell>{formatDateTimeFull(post.created_at)}</TableCell>
                  <TableCell>{post.author_name}</TableCell>

                  <TableCell align="right">
                    <Button
                      type="button"
                      color="error"
                      variant="outlined"
                      onClick={() => handleOpenSingleDeleteDialog(post)}
                    >
                      삭제
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {posts.length > PAGE_SIZE ? (
        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
          {pageGroupStart > 1 ? (
            <Button type="button" variant="outlined" onClick={() => moveToPage(pageGroupStart - 1)}>
              {'<<'}
            </Button>
          ) : null}

          {safeCurrentPage > 1 ? (
            <Button type="button" variant="outlined" onClick={() => moveToPage(safeCurrentPage - 1)}>
              {'<'}
            </Button>
          ) : null}

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

          {safeCurrentPage < totalPage ? (
            <Button type="button" variant="outlined" onClick={() => moveToPage(safeCurrentPage + 1)}>
              {'>'}
            </Button>
          ) : null}

          {pageGroupEnd < totalPage ? (
            <Button type="button" variant="outlined" onClick={() => moveToPage(pageGroupEnd + 1)}>
              {'>>'}
            </Button>
          ) : null}
        </Stack>
      ) : null}

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Dialog open={Boolean(deleteMode)} onClose={handleCloseDeleteDialog} fullWidth maxWidth="xs">
        <DialogTitle>게시물을 삭제합니다</DialogTitle>
        <DialogContent>
          <Typography>삭제 후 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
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
