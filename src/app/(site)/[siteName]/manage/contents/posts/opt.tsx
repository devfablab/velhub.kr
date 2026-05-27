/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Backdrop,
  Box,
  Button,
  ButtonGroup,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  MenuItem,
  Pagination,
  PaginationItem,
  Stack,
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
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { formatDate, formatDateTimeDetail, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Anchor from '@/components/Anchor';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

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
  post_per_page?: number | null;
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
  series_idx: number | null;
  user_id: string;
  site_id: string;
  board_id: string;
  created_at: string;
  author_name: string;
  is_closed: boolean;
  closed_by: string | null;
  closed_at: string | null;
  closed_message: string | null;
  closed_by_name: string;
};

type SitePublicResponse = {
  rhizomes?: {
    site_type?: SiteType;
  };
};

type HeaderSiteResponse = {
  siteRole: string | null;
};

type BoardsResponse = {
  boards: BoardRow[];
};

type StatusResponse = {
  hasBoard: boolean;
  boardName: string | null;
};

type BoardContentsResponse = {
  board: BoardRow;
  contents: PostRow[];
  page: number;
  size: number;
  totalCount: number;
  totalPage: number;
  filter?: 'all' | 'deleted';
};

type BoardOrderResponse = {
  ok?: boolean;
  error?: string;
};

type ErrorResponse = {
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

function isVisibleCommunityBoard(board: BoardRow) {
  return board.board_key !== 'b' && board.board_key !== 'p';
}

function isStaffRole(role: string | null) {
  return role === 'owner' || role === 'manager';
}

function SortableBoardRow({ board, siteName }: { board: BoardRow; siteName: string }) {
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
        <Anchor className="link-normal" href={`/${siteName}/manage/contents/posts/c/${board.board_key}`}>
          {board.board_label}
        </Anchor>
      </TableCell>

      <TableCell>{formatDate(board.created_at ?? '')}</TableCell>

      <TableCell align="right">
        <Anchor className="button medium action" href={`/${siteName}/manage/contents/posts/c/${board.board_key}/edit`}>
          수정
        </Anchor>
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
  const isNotTablet = useMediaQuery(theme.breakpoints.up('lg'));
  const isTablet = !isNotTablet;
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const [siteType, setSiteType] = useState<SiteType | null>(null);
  const [isStaff, setIsStaff] = useState(false);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [board, setBoard] = useState<BoardRow | null>(null);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<DeleteMode>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [deleteTarget, setDeleteTarget] = useState<PostRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isOrderingBoards, setIsOrderingBoards] = useState(false);
  const [isBoardOrderChanged, setIsBoardOrderChanged] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [totalPage, setTotalPage] = useState(1);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'deleted'>('all');
  const [isFetching, setIsFetching] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [closedMessage, setClosedMessage] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const currentPage = parsePage(searchParams.get('page'));
  const sizeParam = parseSize(searchParams.get('size'));
  const filterParam = normalizeText(searchParams.get('filter')).toLowerCase();

  const defaultPostPerPage =
    typeof board?.post_per_page === 'number' && Number.isFinite(board.post_per_page) ? board.post_per_page : 5;

  const currentSize = sizeParam ?? defaultPostPerPage;
  const safeCurrentPage = currentPage > totalPage ? totalPage : currentPage;

  const currentPageIds = useMemo(() => posts.map((post) => post.id), [posts]);

  const isAllCurrentPageChecked = useMemo(() => {
    return currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.includes(id));
  }, [currentPageIds, selectedIds]);

  const isSomeCurrentPageChecked = useMemo(() => {
    return currentPageIds.some((id) => selectedIds.includes(id));
  }, [currentPageIds, selectedIds]);

  useEffect(() => {
    async function loadData() {
      try {
        if (hasLoaded) {
          setIsFetching(true);
        }

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

        const headerResponse = await fetch(`/api/header/site?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const headerResult = (await headerResponse.json()) as HeaderSiteResponse | ErrorResponse;
        const nextIsStaff =
          headerResponse.ok && 'siteRole' in headerResult ? isStaffRole(headerResult.siteRole) : false;

        setIsStaff(nextIsStaff);

        if (nextSiteType === 'blog') {
          if (filterParam === 'deleted' && !nextIsStaff) {
            setBoard(null);
            setBoardName(null);
            setPosts([]);
            setBoards([]);
            setTotalPage(1);
            setErrorMessage('접근 권한이 없습니다.');
            return;
          }

          const statusResponse = await fetch(`/api/manage/contents/blog-posts/status?siteName=${siteName}`, {
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
            setBoard(null);
            setBoardName(null);
            setPosts([]);
            setBoards([]);
            setTotalPage(1);
            setIsBoardOrderChanged(false);
            return;
          }

          setBoardName(statusResult.boardName);

          const boardResponse = await fetch(
            `/api/boards/${statusResult.boardName}?siteName=${siteName}&page=${currentPage}${
              sizeParam ? `&size=${sizeParam}` : ''
            }${filterParam ? `&filter=${filterParam}` : ''}`,
            {
              method: 'GET',
              credentials: 'include',
            },
          );

          const boardResult = (await boardResponse.json()) as BoardContentsResponse | ErrorResponse;

          if (!boardResponse.ok) {
            throw new Error(
              ('error' in boardResult ? boardResult.error : '') || '출간된 블로그 글 목록을 불러오지 못했습니다.',
            );
          }

          if (!('contents' in boardResult) || !Array.isArray(boardResult.contents) || !('board' in boardResult)) {
            throw new Error('출간된 블로그 글 목록을 불러오지 못했습니다.');
          }

          setBoard(boardResult.board);
          setPosts(boardResult.contents);
          setBoards([]);
          setTotalPage(Number(boardResult.totalPage) > 0 ? Number(boardResult.totalPage) : 1);
          setCurrentFilter(boardResult.filter === 'deleted' ? 'deleted' : 'all');
          setIsBoardOrderChanged(false);
          return;
        }

        setBoard(null);
        setBoardName(null);
        setPosts([]);
        setTotalPage(1);
        setCurrentFilter('all');

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
        setIsBoardOrderChanged(false);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('목록을 불러오지 못했습니다.');
        }
      } finally {
        setHasLoaded(true);
        setIsLoading(false);
        setIsFetching(false);
      }
    }

    void loadData();
  }, [siteName, currentPage, sizeParam, filterParam, reloadKey]);

  useEffect(() => {
    setSelectedIds((previousIds) => previousIds.filter((id) => posts.some((post) => post.id === id)));
  }, [posts]);

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
    setDialogMode('delete');
    setClosedMessage('');
    setDialogErrorMessage('');
  }

  function handleOpenBulkDeleteDialog() {
    setDeleteMode('bulk');
    setDeleteTarget(null);
    setDialogMode('delete');
    setClosedMessage('');
    setDialogErrorMessage('');
  }

  function handleOpenRestoreDialog(targetPost: PostRow) {
    setDeleteMode('single');
    setDeleteTarget(targetPost);
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

        const result = (await response.json()) as { ok?: boolean; error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? '게시물 복구에 실패했습니다.');
        }

        setDeleteMode(null);
        setDeleteTarget(null);
        setDialogMode(null);
        setClosedMessage('');
        setDialogErrorMessage('');
        setReloadKey((previousValue) => previousValue + 1);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setDialogErrorMessage(unknownError.message || '게시물 복구에 실패했습니다.');
        } else {
          setDialogErrorMessage('게시물 복구에 실패했습니다.');
        }
      } finally {
        setIsDeleting(false);
      }

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
      setDialogMode(null);
      setClosedMessage('');
      setDialogErrorMessage('');
      return;
    }

    if (isStaff && closedMessage.trim().length < 10) {
      setDialogErrorMessage('삭제 사유를 10자 이상 입력해주세요.');
      return;
    }

    try {
      setErrorMessage('');
      setIsDeleting(true);

      for (const target of deleteTargets) {
        const response = await fetch(`/api/boards/${boardName}/${target.slug}/delete?siteName=${siteName}`, {
          method: 'PATCH',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'close',
            closedMessage: isStaff ? closedMessage.trim() : null,
          }),
        });

        const result = (await response.json()) as { ok?: boolean; error?: string };

        if (!response.ok) {
          throw new Error(result.error ?? '게시물 삭제에 실패했습니다.');
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
    return (
      <div className={`container ${styles.container}`}>
        <div className={`${styles.content} content`}>
          <div className={`paper ${styles.paper}`}>
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (siteType === 'community') {
    return (
      <div className={`container ${styles.container}`}>
        <div className={`${styles.content} content`}>
          {isNotMobile && (
            <Typography variant="h6" component="h2" sx={{ p: 2 }}>
              게시판 목록
            </Typography>
          )}

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, pt: 0, pb: 0 }}>
            <Stack direction="row" justifyContent="flex-end" sx={{ width: '100%', p: 1, pt: 0, pb: 2 }}>
              <Anchor className="button small action" href={`/${siteName}/manage/contents/posts/c/new`}>
                게시판 만들기
              </Anchor>
            </Stack>

            {isBoardOrderChanged ? (
              <button
                type="button"
                className="button small submit"
                onClick={handleSaveBoardOrder}
                disabled={isOrderingBoards}
              >
                순서 저장
              </button>
            ) : (
              <span />
            )}
          </Stack>

          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          {isBoardOrderChanged ? (
            <p className="alert warning" style={{ marginBottom: 16, paddingLeft: 17 }}>
              <WarningAmberRoundedIcon />
              <span>순서를 변경하시면 반드시 저장을 눌러주세요</span>
            </p>
          ) : null}

          {boards.length === 0 ? (
            <div className={`paper ${styles.paper}`}>
              <Typography>게시판이 없습니다.</Typography>
            </div>
          ) : (
            <div className={`paper paper-p0 ${styles.paper}`}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleBoardDragEnd}>
                <SortableContext items={boards.map((board) => board.id)} strategy={verticalListSortingStrategy}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell width={64} />
                        <TableCell>게시판</TableCell>
                        <TableCell sx={{ width: 150 }}>생성날짜</TableCell>
                        <TableCell sx={{ width: 100 }} />
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {boards.map((board) => (
                        <SortableBoardRow key={board.id} board={board} siteName={siteName} />
                      ))}
                    </TableBody>
                  </Table>
                </SortableContext>
              </DndContext>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${styles.container}`}>
      <div className={`content ${styles.content} ${styles['content-manage']}`}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2, pm: 0 }}>
          <Stack direction="row" gap={1}>
            <Anchor className="button small cancel" href={`/${siteName}/manage/contents/posts/category`}>
              카테고리 관리
            </Anchor>
            <Anchor className="button small cancel" href={`/${siteName}/manage/contents/posts/series`}>
              연재 관리
            </Anchor>

            {isMobile ? null : (
              <>
                {selectedIds.length > 0 && currentFilter !== 'deleted' ? (
                  <button type="button" className="button small danger" onClick={handleOpenBulkDeleteDialog}>
                    삭제
                  </button>
                ) : null}
              </>
            )}
          </Stack>

          <Stack direction="row" justifyContent="flex-end">
            <Anchor className="button small action" href={`/${siteName}/manage/contents/posts/new`}>
              글쓰기
            </Anchor>
          </Stack>
        </Stack>

        <Stack
          direction={isMobile ? 'column' : 'row'}
          gap={1}
          justifyContent={isMobile ? 'space-between' : 'flex-end'}
          alignItems={isMobile ? 'flex-end' : 'center'}
          sx={{ pr: 2, pl: 2 }}
        >
          <Stack
            direction="row"
            gap={1}
            justifyContent={isMobile ? 'space-between' : 'flex-end'}
            sx={{ width: '100%' }}
          >
            {isMobile ? (
              <>
                {selectedIds.length > 0 && currentFilter !== 'deleted' ? (
                  <button type="button" className="button small danger" onClick={handleOpenBulkDeleteDialog}>
                    삭제
                  </button>
                ) : (
                  <i />
                )}
              </>
            ) : null}

            {isStaff ? (
              <ButtonGroup size={isMobile ? 'small' : 'medium'}>
                <Button
                  LinkComponent={NextLink}
                  type="button"
                  variant={currentFilter === 'all' ? 'contained' : 'outlined'}
                  className={`button ${isMobile ? 'small' : 'medium'} ${currentFilter === 'all' ? 'submit' : 'action'}`}
                  href={getListHref({ page: 1, filter: 'all' })}
                >
                  전체글
                </Button>
                <Button
                  LinkComponent={NextLink}
                  type="button"
                  size={isMobile ? 'small' : 'medium'}
                  variant={currentFilter === 'deleted' ? 'contained' : 'outlined'}
                  className={`button ${isMobile ? 'small' : 'medium'} ${currentFilter === 'deleted' ? 'submit' : 'action'}`}
                  href={getListHref({ page: 1, filter: 'deleted' })}
                >
                  삭제글
                </Button>
              </ButtonGroup>
            ) : null}
          </Stack>

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

        {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

        {posts.length === 0 ? (
          <p className="alert warning">
            <WarningAmberRoundedIcon />
            <span>{currentFilter === 'deleted' ? '삭제된 글이 없습니다.' : '출간된 블로그 글이 없습니다.'}</span>
          </p>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <div className={`paper paper-p0 ${styles.paper}`}>
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
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>삭제자</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>삭제일</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>삭제사유</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>

                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id} hover>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedIds.includes(post.id)}
                          onChange={() => handleToggleSingle(post.id)}
                        />
                      </TableCell>

                      <TableCell>
                        <Anchor className="link-normal" href={`/${siteName}/manage/contents/posts/${post.slug}`}>
                          {post.subject}
                        </Anchor>
                      </TableCell>

                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDate(post.created_at)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{post.author_name}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{post.closed_by_name || ''}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {post.closed_at ? formatDateTimeDetail(post.closed_at) : ''}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{post.closed_message || ''}</TableCell>
                      <TableCell align="right">
                        {post.is_closed ? (
                          <button
                            type="button"
                            className="button small action"
                            onClick={() => handleOpenRestoreDialog(post)}
                          >
                            복구
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="button small warning"
                            onClick={() => handleOpenSingleDeleteDialog(post)}
                          >
                            삭제
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

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
        )}

        {totalPage > 1 ? (
          <Stack alignItems="center">
            <Pagination
              page={safeCurrentPage}
              count={totalPage}
              color="primary"
              siblingCount={1}
              boundaryCount={1}
              renderItem={(item) => (
                <PaginationItem
                  {...item}
                  component={NextLink}
                  href={getListHref({
                    page: item.page ?? 1,
                  })}
                />
              )}
            />
          </Stack>
        ) : null}

        {isMobile ? (
          <Drawer
            anchor="bottom"
            open={dialogMode === 'delete'}
            onClose={handleCloseDeleteDialog}
            className="VhiDrawer-bottom"
          >
            <h2>게시물 삭제</h2>
            <button className="close-button" onClick={handleCloseDeleteDialog} disabled={isDeleting} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>
                    삭제시 언제든 복구가 가능합니다.
                    <br />
                    삭제사유를 입력해 주세요. (필수)
                  </span>
                </p>

                {isStaff ? (
                  <TextField
                    placeholder="삭제 사유"
                    value={closedMessage}
                    onChange={handleClosedMessageChange}
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                  />
                ) : (
                  <Typography variant="subtitle2">
                    {deleteMode === 'single' ? '이 게시물을 삭제하시겠습니까?' : '선택한 게시물을 삭제하시겠습니까?'}
                  </Typography>
                )}

                {dialogErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{dialogErrorMessage}</span>
                  </p>
                ) : null}
              </Stack>
              <Stack direction="column" spacing={1.5}>
                <button
                  type="button"
                  className="button medium cancel"
                  onClick={handleCloseDeleteDialog}
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button type="button" className="button medium danger" onClick={handleDelete} disabled={isDeleting}>
                  삭제
                </button>
              </Stack>
            </Stack>
          </Drawer>
        ) : (
          <Dialog
            open={dialogMode === 'delete'}
            onClose={handleCloseDeleteDialog}
            fullWidth
            maxWidth="sm"
            className="VhiDialog"
          >
            <DialogTitle>게시물 삭제</DialogTitle>
            <button className="close-button" onClick={handleCloseDeleteDialog} disabled={isDeleting} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>
                    삭제시 언제든 복구가 가능합니다.
                    <br />
                    삭제사유를 입력해 주세요. (필수)
                  </span>
                </p>

                {isStaff ? (
                  <TextField
                    placeholder="삭제 사유"
                    value={closedMessage}
                    onChange={handleClosedMessageChange}
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                  />
                ) : (
                  <Typography variant="subtitle2">
                    {deleteMode === 'single' ? '이 게시물을 삭제하시겠습니까?' : '선택한 게시물을 삭제하시겠습니까?'}
                  </Typography>
                )}

                {dialogErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{dialogErrorMessage}</span>
                  </p>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <button
                type="button"
                className="button medium close"
                onClick={handleCloseDeleteDialog}
                disabled={isDeleting}
              >
                취소
              </button>
              <button type="button" className="button medium danger" onClick={handleDelete} disabled={isDeleting}>
                삭제
              </button>
            </DialogActions>
          </Dialog>
        )}

        {isMobile ? (
          <Drawer
            anchor="bottom"
            open={dialogMode === 'restore'}
            onClose={handleCloseDeleteDialog}
            className="VhiDrawer-bottom"
          >
            <h2>게시물 복구</h2>
            <button className="close-button" onClick={handleCloseDeleteDialog} disabled={isDeleting} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Typography>
                  해당 게시물을 복구하시겠습니까?
                  <br />
                  복구하시면 해당 게시물을 모두가 볼 수 있게 됩니다.
                </Typography>

                {dialogErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{dialogErrorMessage}</span>
                  </p>
                ) : null}
              </Stack>
              <Stack direction="column" spacing={1.5}>
                <button
                  type="button"
                  className="button medium cancel"
                  onClick={handleCloseDeleteDialog}
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button type="button" className="button medium submit" onClick={handleDelete} disabled={isDeleting}>
                  확인
                </button>
              </Stack>
            </Stack>
          </Drawer>
        ) : (
          <Dialog open={dialogMode === 'restore'} onClose={handleCloseDeleteDialog} fullWidth maxWidth="xs">
            <DialogTitle>게시물 복구</DialogTitle>
            <button className="close-button" onClick={handleCloseDeleteDialog} disabled={isDeleting} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Typography>
                  해당 게시물을 복구하시겠습니까?
                  <br />
                  복구하시면 해당 게시물을 모두가 볼 수 있게 됩니다.
                </Typography>

                {dialogErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{dialogErrorMessage}</span>
                  </p>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <button
                type="button"
                className="button medium close"
                onClick={handleCloseDeleteDialog}
                disabled={isDeleting}
              >
                취소
              </button>
              <button type="button" className="button medium submit" onClick={handleDelete} disabled={isDeleting}>
                확인
              </button>
            </DialogActions>
          </Dialog>
        )}
      </div>
    </div>
  );
}
