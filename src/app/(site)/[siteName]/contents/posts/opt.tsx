'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from '@mui/material/Link';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Alert,
  Box,
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
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDate, normalizeText } from '@/lib/utils';

type SiteType = 'blog' | 'community';

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: string;
  is_active: boolean;
  sort_order: number;
  markdown_status: string;
  site_id: string;
  created_at?: string;
};

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

type SitePublicResponse = {
  rhizomes?: {
    site_type?: SiteType;
  };
};

type BoardsResponse = {
  boards: BoardRow[];
};

type StatusResponse = {
  hasBoard: boolean;
  boardName: string | null;
};

type BoardContentsResponse = {
  contents: PostRow[];
};

type BoardOrderResponse = {
  ok?: boolean;
  error?: string;
};

type ErrorResponse = {
  error?: string;
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

function isVisibleCommunityBoard(board: BoardRow) {
  return board.board_key !== 'b' && board.board_key !== 'p';
}

function SortableBoardRow({
  board,
  onMoveToCommunityBoard,
  onMoveToCommunityBoardEdit,
}: {
  board: BoardRow;
  onMoveToCommunityBoard: (boardKey: string) => void;
  onMoveToCommunityBoardEdit: (boardKey: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: board.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow
      ref={(node) => {
        setNodeRef(node);
      }}
      style={style}
    >
      <TableCell>
        <Box
          {...attributes}
          {...listeners}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            width: 'fit-content',
          }}
        >
          <DragIndicatorIcon />
        </Box>
      </TableCell>

      <TableCell>
        <Button
          type="button"
          variant="text"
          onClick={() => onMoveToCommunityBoard(board.board_key)}
          sx={{
            p: 0,
            minWidth: 0,
            justifyContent: 'flex-start',
            textAlign: 'left',
          }}
        >
          {board.board_label}
        </Button>
      </TableCell>

      <TableCell>{formatDate(board.created_at ?? '')}</TableCell>

      <TableCell align="right">
        <Button type="button" variant="outlined" onClick={() => onMoveToCommunityBoardEdit(board.board_key)}>
          수정
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function Opt() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const [siteType, setSiteType] = useState<SiteType | null>(null);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<PostRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOrderingBoards, setIsOrderingBoards] = useState(false);
  const [isBoardOrderChanged, setIsBoardOrderChanged] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

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
    async function loadData() {
      try {
        setErrorMessage('');

        const siteResponse = await fetch(`/api/site/public?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const siteResult = (await siteResponse.json()) as SitePublicResponse | ErrorResponse;

        if (!siteResponse.ok) {
          throw new Error(('error' in siteResult ? siteResult.error : '') || '사이트 정보를 불러오지 못했습니다.');
        }

        if (!('rhizomes' in siteResult)) {
          throw new Error('사이트 정보를 불러오지 못했습니다.');
        }

        const nextSiteType = siteResult.rhizomes?.site_type;

        if (nextSiteType !== 'blog' && nextSiteType !== 'community') {
          throw new Error('사이트 정보를 불러오지 못했습니다.');
        }

        setSiteType(nextSiteType);

        if (nextSiteType === 'blog') {
          const statusResponse = await fetch(`/api/posts/status?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          });

          const statusResult = (await statusResponse.json()) as StatusResponse | ErrorResponse;

          if (!statusResponse.ok) {
            throw new Error(
              ('error' in statusResult ? statusResult.error : '') || '블로그 상태를 확인하지 못했습니다.',
            );
          }

          if (!('hasBoard' in statusResult) || !('boardName' in statusResult)) {
            throw new Error('블로그 상태를 확인하지 못했습니다.');
          }

          if (!statusResult.hasBoard || !statusResult.boardName) {
            setBoardName(null);
            setPosts([]);
            setBoards([]);
            setIsBoardOrderChanged(false);
            return;
          }

          setBoardName(statusResult.boardName);

          const boardResponse = await fetch(`/api/boards/${statusResult.boardName}?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          });

          const boardResult = (await boardResponse.json()) as BoardContentsResponse | ErrorResponse;

          if (!boardResponse.ok) {
            throw new Error(
              ('error' in boardResult ? boardResult.error : '') || '출간된 블로그 글 목록을 불러오지 못했습니다.',
            );
          }

          if (!('contents' in boardResult) || !Array.isArray(boardResult.contents)) {
            throw new Error('출간된 블로그 글 목록을 불러오지 못했습니다.');
          }

          setPosts(boardResult.contents);
          setBoards([]);
          setIsBoardOrderChanged(false);
          return;
        }

        const boardsResponse = await fetch(`/api/boards?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const boardsResult = (await boardsResponse.json()) as BoardsResponse | ErrorResponse;

        if (!boardsResponse.ok) {
          throw new Error(('error' in boardsResult ? boardsResult.error : '') || '게시판을 불러오지 못했습니다.');
        }

        if (!('boards' in boardsResult) || !Array.isArray(boardsResult.boards)) {
          throw new Error('게시판을 불러오지 못했습니다.');
        }

        setBoards(boardsResult.boards.filter(isVisibleCommunityBoard));
        setPosts([]);
        setBoardName(null);
        setIsBoardOrderChanged(false);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
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

  function handleMoveToCommunityBoard(nextBoardName: string) {
    router.push(`/${siteName}/contents/posts/c/${nextBoardName}`);
  }

  function handleMoveToCommunityBoardEdit(nextBoardName: string) {
    router.push(`/${siteName}/contents/posts/c/${nextBoardName}/edit`);
  }

  function handleMoveToCommunityBoardNew() {
    router.push(`/${siteName}/contents/posts/c/new`);
  }

  function handleToggleAllCurrentPage() {
    setSelectedIds((previousIds) => {
      if (isAllCurrentPageChecked) {
        return previousIds.filter((id) => !currentPageIds.includes(id));
      }

      return Array.from(new Set([...previousIds, ...currentPageIds]));
    });
  }

  function handleToggleSingle(postId: string) {
    setSelectedIds((previousIds) => {
      if (previousIds.includes(postId)) {
        return previousIds.filter((id) => id !== postId);
      }

      return [...previousIds, postId];
    });
  }

  function handleOpenSingleDeleteDialog(targetPost: PostRow) {
    setDeleteMode('single');
    setDeleteTarget(targetPost);
  }

  function handleOpenBulkDeleteDialog() {
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

  function handleBoardDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setBoards((previousBoards) => {
      const oldIndex = previousBoards.findIndex((board) => board.id === active.id);
      const newIndex = previousBoards.findIndex((board) => board.id === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return previousBoards;
      }

      setIsBoardOrderChanged(true);

      return arrayMove(previousBoards, oldIndex, newIndex).map((board, index) => ({
        ...board,
        sort_order: index + 1,
      }));
    });
  }

  async function handleSaveBoardOrder() {
    if (isOrderingBoards || boards.length === 0) {
      return;
    }

    try {
      setErrorMessage('');
      setIsOrderingBoards(true);

      const response = await fetch(`/api/boards/${siteName}/order`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          boards: boards.map((board, index) => ({
            boardName: board.board_key,
            sortOrder: index + 1,
          })),
        }),
      });

      const result = (await response.json()) as BoardOrderResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '게시판 순서 저장에 실패했습니다.');
      }

      setBoards((previousBoards) =>
        previousBoards.map((board, index) => ({
          ...board,
          sort_order: index + 1,
        })),
      );
      setIsBoardOrderChanged(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 순서 저장에 실패했습니다.');
      } else {
        setErrorMessage('게시판 순서 저장에 실패했습니다.');
      }
    } finally {
      setIsOrderingBoards(false);
    }
  }

  async function handleDelete() {
    if (isDeleting) {
      return;
    }

    const deleteTargets =
      deleteMode === 'single'
        ? deleteTarget
          ? [deleteTarget]
          : []
        : posts.filter((post) => selectedIds.includes(post.id));

    if (deleteTargets.length === 0) {
      setDeleteMode(null);
      setDeleteTarget(null);
      return;
    }

    try {
      setErrorMessage('');
      setIsDeleting(true);

      for (const target of deleteTargets) {
        const response = await fetch(`/api/boards/${boardName}/${target.slug}/delete?siteName=${siteName}`, {
          method: 'DELETE',
          credentials: 'include',
        });

        const result = (await response.json()) as { ok?: boolean; error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? '게시물 삭제에 실패했습니다.');
        }
      }

      const deletedIds = new Set(deleteTargets.map((target) => target.id));

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

  if (siteType === 'community') {
    return (
      <Stack spacing={2}>
        {isNotMobile && (
          <Typography variant="h4" component="h1">
            게시판 목록
          </Typography>
        )}

        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Button type="button" variant="contained" onClick={handleMoveToCommunityBoardNew}>
            게시판 만들기
          </Button>

          {isBoardOrderChanged ? (
            <Button type="button" variant="outlined" onClick={handleSaveBoardOrder} disabled={isOrderingBoards}>
              순서 저장
            </Button>
          ) : (
            <span />
          )}
        </Stack>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

        {isBoardOrderChanged ? <Alert severity="warning">순서를 변경하시면 반드시 저장을 눌러주세요.</Alert> : null}

        {boards.length === 0 ? (
          <Paper elevation={0} sx={{ p: 3 }}>
            <Typography>게시판이 없습니다.</Typography>
          </Paper>
        ) : (
          <Paper elevation={0} sx={{ overflowX: 'auto' }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBoardDragEnd}>
              <SortableContext items={boards.map((board) => board.id)} strategy={verticalListSortingStrategy}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell width={64}></TableCell>
                      <TableCell>게시판</TableCell>
                      <TableCell>날짜</TableCell>
                      <TableCell align="right">수정</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {boards.map((board) => (
                      <SortableBoardRow
                        key={board.id}
                        board={board}
                        onMoveToCommunityBoard={handleMoveToCommunityBoard}
                        onMoveToCommunityBoardEdit={handleMoveToCommunityBoardEdit}
                      />
                    ))}
                  </TableBody>
                </Table>
              </SortableContext>
            </DndContext>
          </Paper>
        )}
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {isNotMobile && (
        <Typography variant="h4" component="h1">
          {siteType === 'blog' ? '블로그 글 목록' : '게시판 목록'}
        </Typography>
      )}

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

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      {posts.length === 0 ? (
        <Paper elevation={0} sx={{ p: 3 }}>
          <Typography>출간된 블로그 글이 없습니다.</Typography>
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
                <TableRow key={post.id} hover>
                  <TableCell padding="checkbox">
                    <Checkbox checked={selectedIds.includes(post.id)} onChange={() => handleToggleSingle(post.id)} />
                  </TableCell>

                  <TableCell>
                    <Button
                      type="button"
                      variant="text"
                      onClick={() => router.push(`/${siteName}/contents/posts/${post.slug}`)}
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

                  <TableCell>{formatDate(post.created_at)}</TableCell>
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

      {posts.length > 0 ? (
        <Stack direction="row" spacing={1} justifyContent="center">
          <Button
            type="button"
            variant="outlined"
            disabled={safeCurrentPage <= 1}
            onClick={() => moveToPage(safeCurrentPage - 1)}
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
            disabled={safeCurrentPage >= totalPage}
            onClick={() => moveToPage(safeCurrentPage + 1)}
          >
            다음
          </Button>
        </Stack>
      ) : null}

      <Dialog open={deleteMode !== null} onClose={handleCloseDeleteDialog}>
        <DialogTitle>게시물 삭제</DialogTitle>
        <DialogContent>
          <Typography>
            {deleteMode === 'single' ? '이 게시물을 삭제하시겠습니까?' : '선택한 게시물을 삭제하시겠습니까?'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            취소
          </Button>
          <Button type="button" color="error" onClick={handleDelete} disabled={isDeleting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
