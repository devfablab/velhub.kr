'use client';

import { type JSX, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockOpenOutlinedIcon from '@mui/icons-material/LockOpenOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import {
  Avatar,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Fab,
  Stack,
  styled,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatTimeAgo, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import ContentWithInlineLinks from '@/components/service/blog/community/ContentWithInlineLinks';
import SiteProfile from '@/components/service/blog/SiteProfile';
import ScreenState from '@/components/service/ScreenState';
import Container from '../menu';
import styles from '@/app/board.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

const CONTENT_PREVIEW_LENGTH = 127;
const MAX_CONTENT_LENGTH = 10000;
const MAX_IMAGE_SIZE = 1024 * 1024;
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

type NoticePost = {
  id: string;
  content: string;
  imageUrl: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string | null;
  authorName: string;
  authorAvatarUrl: string | null;
};

export type NoticeResponse = {
  boardLabel?: string;
  isOwner?: boolean;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  posts?: NoticePost[];
  error?: string;
};

type EditorState = {
  // null이면 새 글
  post: NoticePost | null;
};

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: NoticeResponse | null;
  initialError: string;
}) {
  const siteName = normalizeText(useParams().siteName);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const boardLabel = normalizeText(initialData?.boardLabel) || '공지';
  const isOwner = initialData?.isOwner === true;
  const page = initialData?.page ?? 1;
  const pageSize = initialData?.pageSize ?? 20;
  const [totalCount, setTotalCount] = useState(initialData?.totalCount ?? 0);
  const totalPage = Math.max(1, Math.ceil(totalCount / pageSize));
  const [posts, setPosts] = useState<NoticePost[]>(initialData?.posts ?? []);

  const [detailPost, setDetailPost] = useState<NoticePost | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorContent, setEditorContent] = useState('');
  const [editorImageFile, setEditorImageFile] = useState<File | null>(null);
  const [editorImagePreview, setEditorImagePreview] = useState('');
  const [isEditorImageRemoved, setIsEditorImageRemoved] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [togglingPostId, setTogglingPostId] = useState('');
  const [errorTitle, setErrorTitle] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const objectUrlRef = useRef('');

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  function showError(title: string, message: string) {
    setErrorTitle(title);
    setErrorMessage(message);
  }

  function clearObjectUrl() {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }
  }

  function openEditor(post: NoticePost | null) {
    clearObjectUrl();
    setEditor({ post });
    setEditorContent(post?.content ?? '');
    setEditorImageFile(null);
    setEditorImagePreview(post?.imageUrl ?? '');
    setIsEditorImageRemoved(false);
  }

  function closeEditor() {
    if (isSubmitting) {
      return;
    }

    clearObjectUrl();
    setEditor(null);
  }

  function handleImageChange(event: InputChangeEvent) {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    if (!IMAGE_MIME_TYPES.includes(file.type)) {
      showError('이미지 등록', 'JPG, PNG, WEBP 이미지만 등록할 수 있습니다.');
      return;
    }

    if (file.size >= MAX_IMAGE_SIZE) {
      showError('이미지 등록', '이미지는 1MB 미만만 등록할 수 있습니다.');
      return;
    }

    clearObjectUrl();
    objectUrlRef.current = URL.createObjectURL(file);
    setEditorImageFile(file);
    setEditorImagePreview(objectUrlRef.current);
    setIsEditorImageRemoved(false);
  }

  function handleRemoveImage() {
    clearObjectUrl();
    setEditorImageFile(null);
    setEditorImagePreview('');
    setIsEditorImageRemoved(true);
  }

  async function reloadFirstPage() {
    const response = await fetch(`/api/site/${siteName}/notice?page=1`, { credentials: 'include' });
    const result = (await response.json().catch(() => null)) as NoticeResponse | null;

    if (response.ok && result) {
      setPosts(result.posts ?? []);
      setTotalCount(result.totalCount ?? 0);
    }
  }

  async function handleSubmit() {
    if (!editor || isSubmitting) {
      return;
    }

    const content = editorContent.trim();

    if (!content) {
      showError(editor.post ? '공지 수정' : '공지 작성', '내용을 입력해주세요.');
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('content', content);

      if (editorImageFile) {
        formData.append('image', editorImageFile);
      } else if (editor.post && isEditorImageRemoved) {
        formData.append('removeImage', 'true');
      }

      const response = await fetch(
        editor.post ? `/api/site/${siteName}/notice/${editor.post.id}` : `/api/site/${siteName}/notice`,
        {
          method: editor.post ? 'PATCH' : 'POST',
          credentials: 'include',
          body: formData,
        },
      );
      const result = (await response.json().catch(() => null)) as {
        error?: string;
        imageUploadError?: boolean;
        content?: string;
        imageUrl?: string | null;
        updatedAt?: string;
      } | null;

      if (!response.ok) {
        throw new Error(result?.error || (editor.post ? '공지를 수정하지 못했습니다.' : '공지를 등록하지 못했습니다.'));
      }

      if (editor.post) {
        const editedPostId = editor.post.id;
        setPosts((previousPosts) =>
          previousPosts.map((post) =>
            post.id === editedPostId
              ? {
                  ...post,
                  content: result?.content ?? content,
                  imageUrl: result?.imageUrl ?? null,
                  updatedAt: result?.updatedAt ?? post.updatedAt,
                }
              : post,
          ),
        );
      } else {
        await reloadFirstPage();
      }

      clearObjectUrl();
      setEditor(null);

      if (result?.imageUploadError) {
        showError('이미지 등록', '공지는 등록되었지만 이미지를 업로드하지 못했습니다.');
      }
    } catch (unknownError) {
      showError(
        editor.post ? '공지 수정' : '공지 작성',
        unknownError instanceof Error ? unknownError.message : '공지를 저장하지 못했습니다.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleTogglePrivate(post: NoticePost) {
    if (togglingPostId) {
      return;
    }

    setTogglingPostId(post.id);

    try {
      const formData = new FormData();
      formData.append('isPrivate', post.isPrivate ? 'false' : 'true');

      const response = await fetch(`/api/site/${siteName}/notice/${post.id}`, {
        method: 'PATCH',
        credentials: 'include',
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as { error?: string; isPrivate?: boolean } | null;

      if (!response.ok) {
        throw new Error(result?.error || '공개 상태를 변경하지 못했습니다.');
      }

      setPosts((previousPosts) =>
        previousPosts.map((item) => (item.id === post.id ? { ...item, isPrivate: result?.isPrivate === true } : item)),
      );
    } catch (unknownError) {
      showError(
        '공개 상태 변경',
        unknownError instanceof Error ? unknownError.message : '공개 상태를 변경하지 못했습니다.',
      );
    } finally {
      setTogglingPostId('');
    }
  }

  if (initialError) {
    return <ScreenState kind="error">{initialError}</ScreenState>;
  }

  const editorTitle = editor?.post ? '공지 수정' : '공지 작성';
  const editorFields = (
    <Stack gap={1.5}>
      <TextField
        placeholder="내용"
        value={editorContent}
        onChange={(event) => setEditorContent(event.currentTarget.value)}
        multiline
        minRows={6}
        fullWidth
        size="small"
        slotProps={{ htmlInput: { maxLength: MAX_CONTENT_LENGTH } }}
      />
      {editorImagePreview ? (
        <Stack gap={1}>
          <div className={styles['content-thumbnail-image']}>
            <img src={editorImagePreview} alt="" />
          </div>
          <Button
            type="button"
            className="button small danger"
            size="small"
            onClick={handleRemoveImage}
            disabled={isSubmitting}
          >
            이미지 삭제
          </Button>
        </Stack>
      ) : (
        <Button
          component="label"
          className="button small action"
          size="small"
          startIcon={<AddPhotoAlternateOutlinedIcon />}
          disabled={isSubmitting}
        >
          이미지 추가 (1MB 미만의 JPG/PNG/WEBP)
          <VisuallyHiddenInput
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            onChange={handleImageChange}
          />
        </Button>
      )}
    </Stack>
  );

  return (
    <Container pageTitle={boardLabel}>
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']}`}>
          <SiteProfile />
          {posts.length ? (
            <div className={styles['blog-community-items']}>
              {posts.map((post) => (
                <div className="paper" key={post.id}>
                  <article className={styles['feed-item']}>
                    <header className={styles['content-header']}>
                      <div className={styles['author-profile']}>
                        <div className={styles.avatar}>
                          <Avatar src={post.authorAvatarUrl || '/broken-image.jpg'} alt={post.authorName} />
                        </div>
                        <div className={styles.info}>
                          <div className={styles.name}>
                            <cite>
                              <span>{post.authorName}</span>
                            </cite>
                          </div>
                          <div className={styles.datetime}>
                            <span aria-label="게시일">{formatTimeAgo(post.createdAt)}</span>
                            {post.updatedAt ? <span>(수정됨)</span> : null}
                            {isOwner && post.isPrivate ? <span>비공개</span> : null}
                          </div>
                        </div>
                      </div>
                    </header>
                    <div className={styles['content-simple']}>
                      <p>
                        <ContentWithInlineLinks content={post.content} limit={CONTENT_PREVIEW_LENGTH} />
                        {post.content.length > CONTENT_PREVIEW_LENGTH ? '...' : null}
                      </p>
                      {post.content.length > CONTENT_PREVIEW_LENGTH ? (
                        <div>
                          <button type="button" onClick={() => setDetailPost(post)}>
                            더보기
                          </button>
                        </div>
                      ) : null}
                      {post.imageUrl ? (
                        <div className={styles['content-images']}>
                          <div className={styles['content-thumbnail-image']}>
                            <img src={post.imageUrl} alt="" />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {isOwner ? (
                      <div className={styles.options}>
                        <div className={styles.buttons}>
                          <div className={styles['button-basics']}>
                            <button type="button" className={styles.button} onClick={() => openEditor(post)}>
                              <EditNoteRoundedIcon />
                              <strong>수정</strong>
                            </button>
                            <button
                              type="button"
                              className={styles.button}
                              onClick={() => void handleTogglePrivate(post)}
                              disabled={togglingPostId === post.id}
                            >
                              {post.isPrivate ? <LockOpenOutlinedIcon /> : <LockOutlinedIcon />}
                              <strong>{post.isPrivate ? '공개로 전환' : '비공개로 전환'}</strong>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                </div>
              ))}
            </div>
          ) : (
            <ScreenState>등록된 공지가 없습니다.</ScreenState>
          )}
          {totalPage > 1 ? (
            <nav className={styles.pagination}>
              {page > 1 ? <Anchor href={`/${siteName}/notice?page=${page - 1}`}>이전</Anchor> : null}
              <span>
                {page} / {totalPage}
              </span>
              {page < totalPage ? <Anchor href={`/${siteName}/notice?page=${page + 1}`}>다음</Anchor> : null}
            </nav>
          ) : null}
          {isOwner ? (
            isMobile ? (
              <div className="fab">
                <Fab aria-label="공지 쓰기" size="medium" onClick={() => openEditor(null)}>
                  <EditRoundedIcon />
                </Fab>
              </div>
            ) : (
              <div className={styles['button-group']}>
                <button type="button" className={`${styles.submit} button`} onClick={() => openEditor(null)}>
                  글쓰기
                </button>
              </div>
            )
          ) : null}
        </div>
      </div>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(detailPost)}
          onClose={() => setDetailPost(null)}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>상세보기</h2>
          <button type="button" className="close-button" onClick={() => setDetailPost(null)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className={`VhiDrawer-bottom-content ${styles['content-simple']}`}>
            <p>{detailPost ? <ContentWithInlineLinks content={detailPost.content} /> : null}</p>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium submit" onClick={() => setDetailPost(null)}>
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(detailPost)}
          onClose={() => setDetailPost(null)}
          fullWidth
          maxWidth="sm"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>상세보기</DialogTitle>
          <DialogContent className={styles['content-simple']}>
            <p>{detailPost ? <ContentWithInlineLinks content={detailPost.content} /> : null}</p>
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={() => setDetailPost(null)}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(editor)}
          onClose={closeEditor}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>{editorTitle}</h2>
          <button
            type="button"
            className="close-button"
            onClick={closeEditor}
            disabled={isSubmitting}
            aria-label={`${editorTitle} 닫기`}
          >
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{editorFields}</div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={closeEditor} disabled={isSubmitting}>
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void handleSubmit()}
              disabled={isSubmitting}
            >
              {editor?.post ? '수정' : '등록'}
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(editor)}
          onClose={closeEditor}
          fullWidth
          maxWidth="sm"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>{editorTitle}</DialogTitle>
          <button
            type="button"
            className="close-button"
            onClick={closeEditor}
            disabled={isSubmitting}
            aria-label={`${editorTitle} 닫기`}
          >
            <CloseRoundedIcon />
          </button>
          <DialogContent>{editorFields}</DialogContent>
          <DialogActions>
            <button type="button" className="cancel-button" onClick={closeEditor} disabled={isSubmitting}>
              취소
            </button>
            <button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {editor?.post ? '수정' : '등록'}
            </button>
          </DialogActions>
        </Dialog>
      )}

      <FormErrorDialog
        open={Boolean(errorMessage)}
        title={errorTitle || null}
        messages={errorMessage ? [errorMessage] : []}
        onClose={() => setErrorMessage('')}
      />
    </Container>
  );
}
