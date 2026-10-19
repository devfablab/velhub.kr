'use client';

import { type JSX, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  InputAdornment,
  Radio,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import PopupMessage from '@/components/PopupMessage';
import ScreenState from '@/components/service/ScreenState';
import Container from '../menu';
import styles from '@/app/manage.module.sass';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

export type RecommendedPost = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  thumbnailImage: string | null;
  thumbnailWidth: number | null;
  thumbnailHeight: number | null;
  publishedAt: string | null;
  userId: string;
  sortOrder: number;
};

export type RecommendedPostsResponse = {
  posts?: RecommendedPost[];
  maxPosts?: number;
  error?: string;
};

type SearchResponse = {
  posts?: RecommendedPost[];
  error?: string;
};

type ErrorResponse = { error?: string };

function SortablePost({ post, onRemove }: { post: RecommendedPost; onRemove: (postId: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: post.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li ref={setNodeRef} style={style}>
      <div className="paper">
        <Stack direction="row" alignItems="center" gap={1}>
          <Box
            {...attributes}
            {...listeners}
            sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', flexShrink: 0 }}
            aria-label={`${post.subject} 순서 변경`}
          >
            <DragIndicatorIcon />
          </Box>
          <Typography
            variant="body2"
            sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {post.subject}
          </Typography>
          <button type="button" className="button small danger" onClick={() => onRemove(post.id)}>
            <DeleteOutlineRoundedIcon />
            삭제
          </button>
        </Stack>
      </div>
    </li>
  );
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
  });
  const result = (await response.json()) as T & ErrorResponse;

  if (!response.ok) {
    throw new Error(result.error || '요청을 처리하지 못했습니다.');
  }

  return result;
}

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: RecommendedPostsResponse | null;
  initialError: string;
}) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const maxPosts = initialData?.maxPosts ?? 20;
  const [posts, setPosts] = useState<RecommendedPost[]>(initialData?.posts ?? []);
  const [savedPostIds, setSavedPostIds] = useState<string[]>(() => (initialData?.posts ?? []).map((post) => post.id));
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [searchPosts, setSearchPosts] = useState<RecommendedPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));
  const [successMessage, setSuccessMessage] = useState('');
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const postIds = useMemo(() => posts.map((post) => post.id), [posts]);
  const hasChanges = JSON.stringify(postIds) !== JSON.stringify(savedPostIds);
  const availableSearchPosts = useMemo(
    () => searchPosts.filter((post) => !postIds.includes(post.id)),
    [postIds, searchPosts],
  );

  function closeSearchDialog() {
    if (isSearching) {
      return;
    }

    setIsSearchOpen(false);
    setKeyword('');
    setSearchPosts([]);
    setSelectedPostId('');
    setHasSearched(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setPosts((previousPosts) => {
      const oldIndex = previousPosts.findIndex((post) => post.id === active.id);
      const newIndex = previousPosts.findIndex((post) => post.id === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return previousPosts;
      }

      return arrayMove(previousPosts, oldIndex, newIndex);
    });
  }

  function handleRemove(postId: string) {
    setPosts((previousPosts) => previousPosts.filter((post) => post.id !== postId));
  }

  async function handleSearch(event: FormSubmitEvent) {
    event.preventDefault();
    const normalizedKeyword = normalizeText(keyword);

    if (!normalizedKeyword) {
      setSearchPosts([]);
      setSelectedPostId('');
      setHasSearched(false);
      return;
    }

    try {
      setIsSearching(true);
      const searchParams = new URLSearchParams({ siteName, keyword: normalizedKeyword });
      const result = await requestJson<SearchResponse>(
        `/api/manage/recommended-posts/search?${searchParams.toString()}`,
      );
      setSearchPosts(result.posts ?? []);
      setSelectedPostId('');
      setHasSearched(true);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '게시물을 검색하지 못했습니다.');
      setIsErrorDialogOpen(true);
    } finally {
      setIsSearching(false);
    }
  }

  function handleAddPost() {
    const selectedPost = availableSearchPosts.find((post) => post.id === selectedPostId);

    if (!selectedPost || posts.length >= maxPosts) {
      return;
    }

    setPosts((previousPosts) => [selectedPost, ...previousPosts]);
    closeSearchDialog();
  }

  async function handleSave() {
    if (!hasChanges || isSaving) {
      return;
    }

    try {
      setIsSaving(true);
      const savedPostIdSet = new Set(savedPostIds);
      const nextPostIdSet = new Set(postIds);
      const removedPostIds = savedPostIds.filter((postId) => !nextPostIdSet.has(postId));
      const addedPostIds = postIds.filter((postId) => !savedPostIdSet.has(postId));

      for (const postId of removedPostIds) {
        await requestJson<RecommendedPostsResponse>('/api/manage/recommended-posts', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteName, postId }),
        });
      }

      for (const postId of addedPostIds) {
        await requestJson<RecommendedPostsResponse>('/api/manage/recommended-posts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteName, postId }),
        });
      }

      const result = await requestJson<RecommendedPostsResponse>('/api/manage/recommended-posts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName, postIds }),
      });
      const nextPosts = result.posts ?? [];
      setPosts(nextPosts);
      setSavedPostIds(nextPosts.map((post) => post.id));
      setSuccessMessage('추천 포스팅이 저장되었습니다.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '추천 포스팅을 저장하지 못했습니다.');
      setIsErrorDialogOpen(true);
    } finally {
      setIsSaving(false);
    }
  }

  if (initialError) {
    return <ScreenState kind="error">{initialError || '추천 포스팅을 불러오지 못했습니다.'}</ScreenState>;
  }

  const searchContent = (
    <>
      <form onSubmit={handleSearch}>
        <TextField
          fullWidth
          size="small"
          value={keyword}
          placeholder="제목 또는 내용 검색"
          onChange={(event) => setKeyword(event.target.value)}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <button type="submit" className="button small action" disabled={isSearching}>
                    <SearchRoundedIcon />
                    검색
                  </button>
                </InputAdornment>
              ),
            },
          }}
        />
      </form>

      <Stack gap={1} sx={{ mt: 2 }}>
        {availableSearchPosts.map((post) => (
          <Box
            key={post.id}
            component="label"
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', py: 1 }}
          >
            <Radio checked={selectedPostId === post.id} onChange={() => setSelectedPostId(post.id)} value={post.id} />
            <Stack gap={0.25} sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {post.subject}
              </Typography>
              {post.summary ? (
                <Typography
                  variant="caption"
                  sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {post.summary}
                </Typography>
              ) : null}
            </Stack>
          </Box>
        ))}
        {searchPosts.length > 0 && availableSearchPosts.length === 0 ? (
          <ScreenState>추가할 수 있는 게시물이 없습니다.</ScreenState>
        ) : null}
        {hasSearched && searchPosts.length === 0 ? <ScreenState>검색 결과가 없습니다.</ScreenState> : null}
      </Stack>
    </>
  );

  return (
    <Container pageTitle="추천 포스팅 관리" pageBack={`/${siteName}/manage`}>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <section className="paper">
            <Stack gap={2}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <Typography variant="subtitle2">추천 포스팅</Typography>
                <Typography variant="caption">
                  {posts.length} / {maxPosts}
                </Typography>
              </Stack>

              {hasChanges ? (
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>변경한 추천 포스팅은 저장을 눌러야 반영됩니다.</span>
                </p>
              ) : null}

              {posts.length === 0 ? (
                <ScreenState>추천 포스팅이 없습니다.</ScreenState>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={postIds} strategy={verticalListSortingStrategy}>
                    <ol style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {posts.map((post) => (
                        <SortablePost key={post.id} post={post} onRemove={handleRemove} />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
              )}

              <Stack direction="row" justifyContent="flex-end" gap={1}>
                <button
                  type="button"
                  className="button small action"
                  onClick={() => setIsSearchOpen(true)}
                  disabled={posts.length >= maxPosts || isSaving}
                >
                  <AddRoundedIcon />
                  추천 포스팅 추가
                </button>
                <button
                  type="button"
                  className="button small submit"
                  onClick={() => void handleSave()}
                  disabled={!hasChanges || isSaving}
                >
                  저장
                </button>
              </Stack>
            </Stack>
          </section>
        </div>
      </div>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={isSearchOpen}
          onClose={closeSearchDialog}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>추천 포스팅 추가</h2>
          <button
            type="button"
            className="close-button"
            onClick={closeSearchDialog}
            aria-label="닫기"
            disabled={isSearching}
          >
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{searchContent}</div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={closeSearchDialog} disabled={isSearching}>
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={handleAddPost}
              disabled={!selectedPostId || posts.length >= maxPosts}
            >
              추가
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isSearchOpen}
          onClose={closeSearchDialog}
          fullWidth
          maxWidth="sm"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>추천 포스팅 추가</DialogTitle>
          <button
            type="button"
            className="close-button"
            onClick={closeSearchDialog}
            aria-label="닫기"
            disabled={isSearching}
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>{searchContent}</DialogContent>
          <DialogActions>
            <button type="button" className="cancel-button" onClick={closeSearchDialog} disabled={isSearching}>
              취소
            </button>
            <button type="button" onClick={handleAddPost} disabled={!selectedPostId || posts.length >= maxPosts}>
              추가
            </button>
          </DialogActions>
        </Dialog>
      )}

      <PopupMessage open={Boolean(successMessage)} message={successMessage} onClose={() => setSuccessMessage('')} />
      <FormErrorDialog
        open={isErrorDialogOpen}
        title={null}
        messages={errorMessage ? [errorMessage] : []}
        onClose={() => setIsErrorDialogOpen(false)}
      />
    </Container>
  );
}
