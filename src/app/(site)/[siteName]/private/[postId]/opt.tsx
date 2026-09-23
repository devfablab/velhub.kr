'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  Avatar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ToastEditor from '@/components/editor/ToastEditor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PostCountTableList from '@/components/service/community/PostCountTableList';
import RecentTableList from '@/components/service/community/RecentTableList';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import UserInfo from '@/components/service/community/UserInfo';
import EmbeddedContentHtml from '@/components/service/EmbeddedContentHtml';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/board.module.sass';

type Reply = {
  id: string;
  author_type: 'user' | 'staff';
  author_stigma_id: string;
  author_name: string;
  author_avatar_url: string;
  can_edit: boolean;
  content_html: string;
  created_at: string;
  updated_at: string;
  images: AttachedImage[];
};
type AttachedImage = { id: string; url: string; file?: File | null };
export type Data = {
  boardLabel?: string;
  canEditPost?: boolean;
  canDeletePost?: boolean;
  previousPost?: { id: string; subject: string } | null;
  nextPost?: { id: string; subject: string } | null;
  post?: {
    subject: string;
    content_html: string;
    author_stigma_id: string;
    author_name: string;
    author_avatar_url: string;
    created_at: string;
    images: { id: string; url: string; width: number | null; height: number | null }[];
  };
  replies?: Reply[];
  isStaff?: boolean;
  currentStigmaId?: string;
  isImageEnabled?: boolean;
  error?: string;
};

const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_FILE_SIZE = 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

type PrivateImageDialogProps = {
  images: AttachedImage[];
  isMobile: boolean;
  onApply: (images: AttachedImage[]) => void;
  onClose: () => void;
  open: boolean;
};

function PrivateImageDialog({ images, isMobile, onApply, onClose, open }: PrivateImageDialogProps) {
  const [dialogImages, setDialogImages] = useState<AttachedImage[]>(images);
  const [message, setMessage] = useState('');
  const imageInputReference = useRef<HTMLInputElement | null>(null);

  function closeDialog() {
    dialogImages.forEach((image) => {
      if (image.file && !images.some((savedImage) => savedImage.id === image.id)) {
        URL.revokeObjectURL(image.url);
      }
    });
    setDialogImages([]);
    setMessage('');
    onClose();
    if (imageInputReference.current) imageInputReference.current.value = '';
  }

  function applyDialog() {
    images.forEach((image) => {
      if (image.file && !dialogImages.some((dialogImage) => dialogImage.id === image.id)) {
        URL.revokeObjectURL(image.url);
      }
    });
    onApply(dialogImages);
    setDialogImages([]);
    setMessage('');
    onClose();
    if (imageInputReference.current) imageInputReference.current.value = '';
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);

    if (selectedFiles.length === 0) return;
    if (dialogImages.length + selectedFiles.length > MAX_IMAGE_COUNT) {
      setMessage(`이미지는 ${MAX_IMAGE_COUNT}개를 초과할 수 없습니다.`);
      event.currentTarget.value = '';
      return;
    }
    if (selectedFiles.some((file) => !ACCEPTED_IMAGE_TYPES.includes(file.type))) {
      setMessage('png, jpeg, webp 이미지만 등록할 수 있습니다.');
      event.currentTarget.value = '';
      return;
    }
    if (selectedFiles.some((file) => file.size > MAX_IMAGE_FILE_SIZE)) {
      setMessage('이미지 한 장의 용량은 1MB 이하만 등록할 수 있습니다.');
      event.currentTarget.value = '';
      return;
    }

    setDialogImages((currentImages) => [
      ...currentImages,
      ...selectedFiles.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) })),
    ]);
    setMessage('');
    event.currentTarget.value = '';
  }

  function removeImage(imageId: string) {
    setDialogImages((currentImages) => {
      const targetImage = currentImages.find((image) => image.id === imageId);

      if (targetImage?.file && !images.some((savedImage) => savedImage.id === imageId)) {
        URL.revokeObjectURL(targetImage.url);
      }

      return currentImages.filter((image) => image.id !== imageId);
    });
  }

  const uploader = (
    <>
      {message ? <DialogContentText className={styles['thumbnail-dialog-message']}>{message}</DialogContentText> : null}
      <div className={styles['thumbnail-uploader']}>
        <button
          type="button"
          className={styles['thumbnail-upload-button']}
          onClick={() => imageInputReference.current?.click()}
        >
          <span>
            이미지 추가 {dialogImages.length}/{MAX_IMAGE_COUNT}
          </span>
          <CollectionsOutlinedIcon />
        </button>
        <input
          ref={imageInputReference}
          type="file"
          multiple
          accept="image/png,image/jpeg,image/webp"
          className={styles['thumbnail-file-input']}
          onChange={handleImageChange}
        />
      </div>
      {dialogImages.length > 0 ? (
        <div className={styles['gallery-dialog-preview']}>
          {dialogImages.map((image) => (
            <div key={image.id} className={styles['gallery-dialog-preview-image']}>
              <button
                type="button"
                onClick={() => removeImage(image.id)}
                aria-label="이미지 삭제"
                className={styles['gallery-dialog-remove-button']}
              >
                <CloseRoundedIcon />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={image.url} alt="" />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );

  return isMobile ? (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={closeDialog}
      className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['thumbnail-dialog']}`}
    >
      <h2>첨부 이미지 업로드</h2>
      <button type="button" className="close-button" onClick={closeDialog} aria-label="닫기">
        <CloseRoundedIcon />
      </button>
      <div className={`VhiDrawer-bottom-content ${styles['thumbnail-dialog-content']}`}>{uploader}</div>
      <div className="drawer-dialog-actions">
        <button type="button" onClick={closeDialog} className="button medium cancel">
          취소
        </button>
        <button
          type="button"
          onClick={applyDialog}
          disabled={dialogImages.length === 0}
          className="button medium submit"
        >
          이미지 업로드
        </button>
      </div>
    </Drawer>
  ) : (
    <Dialog open={open} onClose={closeDialog} className={`vh-dialog vh-alert-dialog ${styles['thumbnail-dialog']}`}>
      <DialogTitle>첨부 이미지 업로드</DialogTitle>
      <DialogContent className={styles['thumbnail-dialog-content']}>{uploader}</DialogContent>
      <DialogActions>
        <button type="button" onClick={closeDialog} className="cancel-button">
          취소
        </button>
        <button type="button" onClick={applyDialog} disabled={dialogImages.length === 0}>
          이미지 적용
        </button>
      </DialogActions>
    </Dialog>
  );
}

export default function Opt({
  initialData,
  initialError,
  initialStatus,
}: {
  initialData: Data | null;
  initialError: string;
  initialStatus: number;
}) {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const postId = normalizeText(params.postId);
  const [data, setData] = useState<Data>(
    initialData ? { ...initialData, error: initialError || initialData.error } : { error: initialError },
  );
  const [contentHtml, setContentHtml] = useState('');
  const [replyImages, setReplyImages] = useState<AttachedImage[]>([]);
  const [replyImageDialogOpen, setReplyImageDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingReplyId, setEditingReplyId] = useState('');
  const [editingReplyHtml, setEditingReplyHtml] = useState('');
  const [editingReplyImages, setEditingReplyImages] = useState<AttachedImage[]>([]);
  const [editingReplyImageDialogOpen, setEditingReplyImageDialogOpen] = useState(false);
  const [isSavingReply, setIsSavingReply] = useState(false);
  const [readyReplyEditorKey, setReadyReplyEditorKey] = useState('');
  const [galleryViewerOpen, setGalleryViewerOpen] = useState(false);
  const [galleryViewerIndex, setGalleryViewerIndex] = useState(0);
  const [galleryImages, setGalleryImages] = useState<AttachedImage[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeletingPost, setIsDeletingPost] = useState(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = useState('');
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  async function load() {
    const response = await fetch(`/api/private-board/${postId}?siteName=${siteName}`, { credentials: 'include' });
    const result = (await response.json()) as Data;
    if (response.status === 401) {
      router.replace(`/auth/sign-in?next=/${siteName}/private/${postId}`);
      return;
    }
    setData(result);
  }

  useEffect(() => {
    if (initialStatus === 401) router.replace(`/auth/sign-in?next=/${siteName}/private/${postId}`);
  }, [initialStatus, postId, router, siteName]);

  async function reply() {
    if (isSaving) return;
    setIsSaving(true);
    const formData = new FormData();
    formData.set('contentHtml', contentHtml);
    replyImages.forEach((image) => {
      if (image.file) formData.append('images', image.file);
    });
    const response = await fetch(`/api/private-board/${postId}?siteName=${siteName}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (response.ok) {
      setContentHtml('');
      setReplyImages([]);
      await load();
    } else {
      const result = (await response.json()) as Data;
      setData((value) => ({ ...value, error: result.error }));
    }
    setIsSaving(false);
  }

  function startReplyEdit(reply: Reply) {
    setEditingReplyId(reply.id);
    setEditingReplyHtml(reply.content_html);
    setEditingReplyImages(reply.images.map((image) => ({ ...image, file: null })));
  }

  function cancelReplyEdit() {
    setEditingReplyId('');
    setEditingReplyHtml('');
    setEditingReplyImages([]);
    setEditingReplyImageDialogOpen(false);
  }

  function openGalleryViewer(images: AttachedImage[], index: number) {
    setGalleryImages(images);
    setGalleryViewerIndex(index);
    setGalleryViewerOpen(true);
  }

  function closeGalleryViewer() {
    setGalleryViewerOpen(false);
  }

  function showPreviousGalleryImage() {
    const imageCount = galleryImages.length;

    if (!imageCount) return;

    setGalleryViewerIndex((index) => (index <= 0 ? imageCount - 1 : index - 1));
  }

  function showNextGalleryImage() {
    const imageCount = galleryImages.length;

    if (!imageCount) return;

    setGalleryViewerIndex((index) => (index >= imageCount - 1 ? 0 : index + 1));
  }

  async function updateReply(replyId: string) {
    if (isSavingReply) return;

    setIsSavingReply(true);
    setData((value) => ({ ...value, error: undefined }));

    try {
      const formData = new FormData();
      formData.set('contentHtml', editingReplyHtml);
      formData.set(
        'retainedImageIds',
        JSON.stringify(editingReplyImages.filter((image) => image.file === null).map((image) => image.id)),
      );
      editingReplyImages.forEach((image) => {
        if (image.file) formData.append('images', image.file);
      });
      const response = await fetch(`/api/private-board/${postId}/replies/${replyId}?siteName=${siteName}`, {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });
      const result = (await response.json()) as Data;

      if (!response.ok) throw new Error(result.error ?? '답변 수정에 실패했습니다.');

      await load();
      cancelReplyEdit();
      setIsSavingReply(false);
    } catch (error) {
      setData((value) => ({
        ...value,
        error: error instanceof Error ? error.message : '답변 수정에 실패했습니다.',
      }));
      setIsSavingReply(false);
    }
  }

  async function deletePost() {
    if (isDeletingPost) return;

    try {
      setIsDeletingPost(true);
      setDeleteErrorMessage('');
      const response = await fetch(`/api/private-board/${postId}?siteName=${siteName}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const result = (await response.json()) as Data;

      if (!response.ok) {
        throw new Error(result.error ?? '글 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/private`);
    } catch (error) {
      setDeleteErrorMessage(error instanceof Error ? error.message : '글 삭제에 실패했습니다.');
      setIsDeletingPost(false);
    }
  }
  if (data.error && !data.post)
    return (
      <div className="container">
        {!isMobile ? (
          <aside>
            <SiteInfo />
            <TableList writeHref={`/${siteName}/private/new`} />
          </aside>
        ) : null}
        <div className={`${styles.content} content`}>
          <ScreenState kind="error">{data.error}</ScreenState>
        </div>
      </div>
    );
  const last = data.replies?.at(-1);
  const canReply = data.isStaff
    ? last?.author_type === 'user' ||
      (!last &&
        Boolean(data.post?.created_at) &&
        Date.now() - new Date(data.post?.created_at ?? '').getTime() >= 5 * 60 * 1000)
    : last?.author_type === 'staff';
  const replyEditorKey = `${last?.id ?? 'post'}:${canReply ? 'ready' : 'waiting'}`;
  const isReplyEditorReady = readyReplyEditorKey === replyEditorKey;
  const replyWaitingMessage = data.isStaff
    ? !last
      ? '글 작성 5분 뒤에 답변할 수 있습니다.'
      : '작성자의 추가 문의를 기다리고 있습니다.'
    : '운영자 또는 매니저의 답변을 기다리고 있습니다.';
  const hasReplyEditor = canReply || Boolean(editingReplyId);
  const isLoadingPost = !data.post;

  return (
    <div className="container">
      {!isMobile ? (
        <aside>
          <SiteInfo />
          <TableList writeHref={`/${siteName}/private/new`} />
        </aside>
      ) : null}
      <div className={`${styles.content} content`}>
        {isMobile ? null : (
          <>
            <div className={styles['top-buttons']}>
              <Anchor href={`/${siteName}/private`} className="button">
                <ArrowBackIosRoundedIcon />
                <span>목록</span>
              </Anchor>
              {data.nextPost ? (
                <Anchor href={`/${siteName}/private/${data.nextPost.id}`} className="button">
                  <span>다음글</span>
                  <ArrowForwardIosRoundedIcon />
                </Anchor>
              ) : null}
            </div>
          </>
        )}
        {isLoadingPost ? (
          <div className="paper">
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        ) : (
          <>
            <article>
              <div className="paper">
                <header className={styles['content-header']}>
                  <div className={styles['content-board-name']}>
                    <Anchor href={`/${siteName}/private`} className={styles['board-link']}>
                      <span>{data.boardLabel}</span>
                      <ArrowForwardIosRoundedIcon />
                    </Anchor>
                    {data.canEditPost ? (
                      <Anchor href={`/${siteName}/private/${postId}/edit`} className={styles['edit-link']}>
                        <span>글 수정</span>
                        <EditNoteRoundedIcon />
                      </Anchor>
                    ) : null}
                  </div>
                  <h3>
                    <strong>{data.post?.subject}</strong>
                  </h3>
                  <div className={styles['author-profile']}>
                    <div className={styles.avatar}>
                      <Avatar src={data.post?.author_avatar_url} alt="" />
                    </div>
                    <div className={styles.info}>
                      <div className={styles.name}>
                        <cite>{data.post?.author_name}</cite>
                      </div>
                      <div className={styles.datetime}>
                        <span>{data.post?.created_at ? formatDateTimeDetail(data.post.created_at) : ''}</span>
                      </div>
                    </div>
                  </div>
                </header>
              </div>
              <div className={`${styles['board-container']} ${styles['basic-board']}`}>
                <div className="paper">
                  <EmbeddedContentHtml
                    contentHtml={data.post?.content_html ?? ''}
                    contentMarkdown={null}
                    markdownStatus="markdown_off"
                    themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                    className="viewer"
                  />
                  {data.post?.images.length ? (
                    <div className={styles['content-images']}>
                      {data.post.images.map((image, index) => (
                        <div key={image.id} className={styles['content-thumbnail-image']}>
                          <button type="button" onClick={() => openGalleryViewer(data.post?.images ?? [], index)}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={image.url} alt="" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {galleryImages.length ? (
                    <Dialog
                      open={galleryViewerOpen}
                      onClose={closeGalleryViewer}
                      fullScreen
                      className={`vh-dialog ${styles['gallery-viewer-dialog']}`}
                    >
                      <DialogTitle className={styles['dialog-title']}>{galleryViewerIndex + 1}번째 이미지</DialogTitle>
                      <DialogContent className={styles['dialog-content']}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={galleryImages[galleryViewerIndex]?.url} alt="" />
                      </DialogContent>
                      <DialogActions className={styles['dialog-actions']}>
                        <button
                          type="button"
                          onClick={showPreviousGalleryImage}
                          className={`${styles['control-button']} ${styles['prev-button']}`}
                          aria-label="이전 이미지"
                        >
                          <ArrowBackRoundedIcon />
                        </button>
                        <button
                          type="button"
                          onClick={showNextGalleryImage}
                          className={`${styles['control-button']} ${styles['next-button']}`}
                          aria-label="다음 이미지"
                        >
                          <ArrowForwardRoundedIcon />
                        </button>
                        <button
                          type="button"
                          onClick={closeGalleryViewer}
                          className={styles['close-button']}
                          aria-label="갤러리 닫기"
                        >
                          <CloseRoundedIcon />
                        </button>
                      </DialogActions>
                    </Dialog>
                  ) : null}
                </div>
              </div>
            </article>
            {data.canEditPost || data.canDeletePost ? (
              <div className={styles.options}>
                <div className={styles.buttons}>
                  <div className={styles['button-basics']}>
                    {data.canEditPost ? (
                      <Anchor href={`/${siteName}/private/${postId}/edit`} className={`${styles.button} button`}>
                        <EditNoteRoundedIcon />
                        <strong>수정</strong>
                      </Anchor>
                    ) : null}
                    {data.canDeletePost ? (
                      <button
                        type="button"
                        className={`${styles.button} button`}
                        onClick={() => {
                          setDeleteErrorMessage('');
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <DeleteForeverRoundedIcon />
                        <strong>삭제</strong>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
            {(data.replies ?? []).map((reply) => (
              <article key={reply.id}>
                <div className="paper">
                  <header className={styles['content-header']}>
                    <div className={styles['content-board-name']}>
                      <h3>
                        <strong>{reply.author_type === 'staff' ? '운영자 답변' : '추가 문의'}</strong>
                      </h3>
                      {reply.can_edit ? (
                        <button type="button" className={styles['edit-link']} onClick={() => startReplyEdit(reply)}>
                          <span>{reply.author_type === 'staff' ? '답변 수정' : '추가 문의 수정'}</span>
                          <EditNoteRoundedIcon />
                        </button>
                      ) : null}
                    </div>
                    <div className={styles['author-profile']}>
                      <div className={styles.avatar}>
                        <Avatar src={reply.author_avatar_url} alt="" />
                      </div>
                      <div className={styles.info}>
                        <div className={styles.name}>
                          <cite>{reply.author_name}</cite>
                        </div>
                        <div className={styles.datetime}>
                          <span>
                            {formatDateTimeDetail(reply.created_at)}
                            {reply.updated_at !== reply.created_at ? ' / 수정됨' : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  </header>
                </div>
                <div className={`${styles['board-container']} ${styles['basic-board']}`}>
                  {editingReplyId === reply.id ? (
                    <form
                      className={`${styles.form} form`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        void updateReply(reply.id);
                      }}
                    >
                      <fieldset>
                        <legend>{reply.author_type === 'staff' ? '운영자 답변 수정 폼' : '추가 문의 수정 폼'}</legend>
                        <div className={`${styles.editor} ${styles['editor-basic']} service-editor`}>
                          <ToastEditor
                            key={`reply-edit:${reply.id}`}
                            initialValue={editingReplyHtml}
                            initialMarkdown=""
                            initialEditType="wysiwyg"
                            themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                            hideModeSwitch
                            markdownStatus="markdown_off"
                            onHtmlChange={setEditingReplyHtml}
                            onMarkdownChange={() => {}}
                          />
                        </div>
                        {data.isImageEnabled ? (
                          <div className="paper">
                            <button
                              type="button"
                              className="button medium action"
                              onClick={() => setEditingReplyImageDialogOpen(true)}
                            >
                              첨부 이미지 {editingReplyImages.length}/{MAX_IMAGE_COUNT}
                            </button>
                          </div>
                        ) : null}
                        <div className={styles['button-group']}>
                          <button type="button" className={styles.link} onClick={cancelReplyEdit}>
                            취소
                          </button>
                          <button type="submit" className={`${styles.submit} button`} disabled={isSavingReply}>
                            수정 완료
                          </button>
                        </div>
                      </fieldset>
                    </form>
                  ) : (
                    <div className="paper">
                      <EmbeddedContentHtml
                        contentHtml={reply.content_html}
                        contentMarkdown={null}
                        markdownStatus="markdown_off"
                        themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                        className="viewer"
                      />
                      {reply.images.length ? (
                        <div className={styles['content-images']}>
                          {reply.images.map((image, index) => (
                            <div key={image.id} className={styles['content-thumbnail-image']}>
                              <button type="button" onClick={() => openGalleryViewer(reply.images, index)}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={image.url} alt="" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              </article>
            ))}
            {data.error ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{data.error}</span>
              </p>
            ) : null}

            {canReply ? (
              <>
                <div className="paper">
                  <header className={styles['content-header']}>
                    <h3>
                      <strong>{data.isStaff ? '답변 작성' : '추가 문의 작성'}</strong>
                    </h3>
                    <p>
                      {data.isStaff
                        ? '작성자의 글에 답변을 남겨주세요.'
                        : '답변 내용을 확인한 뒤 추가 문의를 남겨주세요.'}
                    </p>
                  </header>
                </div>
                <div className={styles.form}>
                  <fieldset>
                    <div className={`${styles.editor} service-editor`}>
                      <ToastEditor
                        key={replyEditorKey}
                        initialValue={contentHtml}
                        initialMarkdown=""
                        initialEditType="wysiwyg"
                        themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                        hideModeSwitch
                        markdownStatus="markdown_off"
                        onHtmlChange={setContentHtml}
                        onMarkdownChange={() => {}}
                        onReady={() => setReadyReplyEditorKey(replyEditorKey)}
                      />
                    </div>
                  </fieldset>
                </div>
                {data.isImageEnabled ? (
                  <div className="paper">
                    <button
                      type="button"
                      className="button medium action"
                      onClick={() => setReplyImageDialogOpen(true)}
                    >
                      첨부 이미지 {replyImages.length}/{MAX_IMAGE_COUNT}
                    </button>
                  </div>
                ) : null}
                {isReplyEditorReady ? (
                  <div className={styles['button-group']}>
                    <Anchor href={`/${siteName}/private`} className={`${styles.link} link`}>
                      취소
                    </Anchor>
                    <button
                      type="button"
                      className={`${styles.submit} button`}
                      disabled={isSaving}
                      onClick={() => void reply()}
                    >
                      {data.isStaff ? '답변 등록' : '추가 문의 등록'}
                    </button>
                  </div>
                ) : null}
              </>
            ) : (
              <ScreenState>{replyWaitingMessage}</ScreenState>
            )}
          </>
        )}
        {replyImageDialogOpen ? (
          <PrivateImageDialog
            images={replyImages}
            isMobile={isMobile}
            onApply={setReplyImages}
            onClose={() => setReplyImageDialogOpen(false)}
            open
          />
        ) : null}
        {editingReplyImageDialogOpen ? (
          <PrivateImageDialog
            images={editingReplyImages}
            isMobile={isMobile}
            onApply={setEditingReplyImages}
            onClose={() => setEditingReplyImageDialogOpen(false)}
            open
          />
        ) : null}
        {data.canDeletePost ? (
          isMobile ? (
            <Drawer
              anchor="bottom"
              open={deleteDialogOpen}
              onClose={() => setDeleteDialogOpen(false)}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
            >
              <h2>글 삭제</h2>
              <button type="button" className="close-button" onClick={() => setDeleteDialogOpen(false)}>
                <CloseRoundedIcon />
              </button>
              <div className="VhiDrawer-bottom-content">
                <p>정말로 글을 삭제하시겠습니까?</p>
                {deleteErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{deleteErrorMessage}</span>
                  </p>
                ) : null}
              </div>
              <div className="drawer-dialog-actions">
                <button type="button" className="cancel-button" onClick={() => setDeleteDialogOpen(false)}>
                  취소
                </button>
                <button
                  type="button"
                  className="delete-button"
                  disabled={isDeletingPost}
                  onClick={() => void deletePost()}
                >
                  {isDeletingPost ? '삭제 중' : '삭제'}
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={deleteDialogOpen}
              onClose={() => setDeleteDialogOpen(false)}
              className="VhiDialog VhiDialog-service"
            >
              <DialogTitle className={styles['dialog-title']}>글 삭제</DialogTitle>
              <button type="button" className="close-button" onClick={() => setDeleteDialogOpen(false)}>
                <CloseRoundedIcon />
              </button>
              <DialogContent className={styles['dialog-content']}>
                <p>정말로 글을 삭제하시겠습니까?</p>
                {deleteErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{deleteErrorMessage}</span>
                  </p>
                ) : null}
              </DialogContent>
              <DialogActions>
                <button type="button" className="button medium close" onClick={() => setDeleteDialogOpen(false)}>
                  취소
                </button>
                <button
                  type="button"
                  className="button medium delete"
                  disabled={isDeletingPost}
                  onClick={() => void deletePost()}
                >
                  {isDeletingPost ? '삭제 중' : '삭제'}
                </button>
              </DialogActions>
            </Dialog>
          )
        ) : null}
      </div>
      {!isMobile && !hasReplyEditor ? (
        <aside>
          <UserInfo />
          <PostCountTableList />
          <RecentTableList />
        </aside>
      ) : null}
    </div>
  );
}
