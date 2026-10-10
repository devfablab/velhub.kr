'use client';
import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CollectionsIcon from '@mui/icons-material/Collections';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import DrawEventFields, { emptyBlogCommunityDraw } from '@/components/service/blog-community/DrawEventFields';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import { type BlogCommunityResponse } from '../opt';
import styles from '@/app/board.module.sass';

const MAX_CONTENT_LENGTH = 10_000;
const MAX_IMAGE_COUNT = 9;
const MAX_IMAGE_SIZE = 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
type PreviewImage = { file: File; previewUrl: string };

function ImagePicker({
  images,
  onChange,
  disabled,
}: {
  images: File[];
  onChange: (images: File[]) => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('lg'));
  const inputReference = useRef<HTMLInputElement>(null);
  const previewReference = useRef<PreviewImage[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PreviewImage[]>([]);
  const [message, setMessage] = useState('');

  useEffect(
    () => () => {
      previewReference.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    },
    [],
  );

  function releasePreviews() {
    previewReference.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    previewReference.current = [];
  }

  function openDialog() {
    releasePreviews();
    const next = images.map((file) => ({ file, previewUrl: URL.createObjectURL(file) }));
    previewReference.current = next;
    setDraft(next);
    setMessage('');
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    releasePreviews();
    setDraft([]);
    setMessage('');
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (!files.length) return;
    if (draft.length + files.length > MAX_IMAGE_COUNT) return setMessage('이미지는 9개를 초과할 수 없습니다');
    if (files.some((file) => !IMAGE_TYPES.has(file.type)))
      return setMessage('png, jpg, webp 이미지만 등록할 수 있습니다.');
    if (files.some((file) => file.size > MAX_IMAGE_SIZE))
      return setMessage('이미지 한 장은 1MB 이하만 등록할 수 있습니다.');
    const next = [...files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })), ...draft];
    previewReference.current = next;
    setDraft(next);
    setMessage('');
  }

  function removeImage(previewUrl: string) {
    URL.revokeObjectURL(previewUrl);
    const next = draft.filter((image) => image.previewUrl !== previewUrl);
    previewReference.current = next;
    setDraft(next);
    setMessage('');
  }

  function applyImages() {
    onChange(draft.map((image) => image.file));
    closeDialog();
  }

  const content = (
    <>
      {message ? <DialogContentText className={styles['thumbnail-dialog-message']}>{message}</DialogContentText> : null}
      <div className={styles['thumbnail-uploader']}>
        <button
          type="button"
          onClick={() => inputReference.current?.click()}
          className={styles['thumbnail-upload-button']}
        >
          <span>{`이미지 추가 ${draft.length}/9`}</span>
          <CollectionsOutlinedIcon />
        </button>
        <input
          ref={inputReference}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className={styles['thumbnail-file-input']}
          aria-label="첨부할 이미지 선택"
          onChange={handleFileChange}
        />
      </div>
      {draft.length ? (
        <div className={styles['gallery-dialog-preview']}>
          {draft.map((image) => (
            <div key={image.previewUrl} className={styles['gallery-dialog-preview-image']}>
              <button
                type="button"
                onClick={() => removeImage(image.previewUrl)}
                aria-label="이미지 삭제"
                className={styles['gallery-dialog-remove-button']}
              >
                <CloseRoundedIcon />
              </button>
              <img src={image.previewUrl} alt="" />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );

  return (
    <>
      <div className={styles.image}>
        <button
          type="button"
          disabled={disabled}
          onClick={openDialog}
          className={images.length ? styles.enabled : undefined}
        >
          {images.length ? <CollectionsIcon /> : <CollectionsOutlinedIcon />}
          <span>이미지 첨부</span>
        </button>
      </div>
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={open}
          onClose={closeDialog}
          className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['thumbnail-dialog']}`}
        >
          <h2>이미지 첨부</h2>
          <button type="button" className="close-button" onClick={closeDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className={`VhiDrawer-bottom-content ${styles['thumbnail-dialog-content']}`}>{content}</div>
          <div className="drawer-dialog-actions">
            <button type="button" onClick={closeDialog} className="button medium close">
              취소
            </button>
            <button type="button" onClick={applyImages} className="button medium submit">
              이미지 업로드
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog open={open} onClose={closeDialog} className={`vh-dialog vh-alert-dialog ${styles['thumbnail-dialog']}`}>
          <DialogTitle>이미지 첨부</DialogTitle>
          <button type="button" className="close-button" onClick={closeDialog} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent className={styles['thumbnail-dialog-content']}>{content}</DialogContent>
          <DialogActions>
            <button type="button" onClick={closeDialog} className="cancel-button">
              취소
            </button>
            <button type="button" onClick={applyImages}>
              이미지 업로드
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: BlogCommunityResponse | null;
  initialError: string;
}) {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const feature = initialData?.feature;
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [draw, setDraw] = useState(emptyBlogCommunityDraw);
  const [fieldError, setFieldError] = useState('');
  const [dialogError, setDialogError] = useState<string | null>(initialError || initialData?.error || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingReference = useRef(false);
  const isOverLimit = content.length > MAX_CONTENT_LENGTH;
  const canPost = feature?.canUse === true && normalizeText(content).length > 0 && !isOverLimit && !isSubmitting;
  function validateImages(nextImages: File[]) {
    if (nextImages.length > MAX_IMAGE_COUNT) return '이미지는 최대 9장까지 등록할 수 있습니다.';
    for (const image of nextImages) {
      if (!IMAGE_TYPES.has(image.type)) return 'JPG, PNG, WEBP 이미지만 등록할 수 있습니다.';
      if (image.size > MAX_IMAGE_SIZE) return '이미지 한 장은 1MB 이하만 등록할 수 있습니다.';
    }
    return '';
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingReference.current) return;
    const normalizedContent = normalizeText(content);
    const imageError = validateImages(images);
    const error = !normalizedContent
      ? '내용을 입력해주세요.'
      : isOverLimit
        ? '내용은 10,000자 이하로 입력해주세요.'
        : imageError;
    setFieldError(error);
    if (error) {
      setDialogError(error);
      return;
    }
    submittingReference.current = true;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set('content', normalizedContent);
      formData.set('drawType', draw.type);
      formData.set('drawLimit', String(draw.limit));
      if (draw.endsAt) formData.set('drawEndsAt', draw.endsAt.toISOString());
      images.forEach((image) => formData.append('images', image));
      const response = await fetch(`/api/site/${siteName}/community-on-blog`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const result = (await response.json().catch(() => null)) as { error?: string; imageUploadError?: boolean } | null;
      if (!response.ok) throw new Error(result?.error || '글을 게시하지 못했습니다.');
      if (result?.imageUploadError) setDialogError('글은 게시되었지만 일부 이미지를 업로드하지 못했습니다.');
      router.replace(`/${siteName}/community-on-blog`);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : '글을 게시하지 못했습니다.';
      setFieldError(message);
      setDialogError(message);
      submittingReference.current = false;
      setIsSubmitting(false);
    }
  }

  if (initialError || initialData?.error)
    return <ScreenState kind="error">{initialError || initialData?.error}</ScreenState>;
  if (!feature?.isPersonalBlog || !feature.isEnabled)
    return <ScreenState kind="error">현재 사용할 수 없는 메뉴입니다.</ScreenState>;
  if (!feature.canUse) return <ScreenState kind="error">블로그 구독자만 이용할 수 있습니다.</ScreenState>;
  return (
    <Container pageBack={`/${siteName}/community-on-blog`} pageTitle="커뮤니티 글쓰기">
      <div className="container">
        <div className={`content ${styles.content} ${styles['blog-content']}`}>
          <form onSubmit={handleSubmit} className={`${styles.form} form`} noValidate>
            <fieldset>
              <legend>글쓰기 폼</legend>
              <div className="paper">
                <div className={styles['post-options']}>
                  <ImagePicker images={images} onChange={setImages} disabled={isSubmitting} />
                  {feature.isOperator ? (
                    <DrawEventFields value={draw} onChange={setDraw} disabled={isSubmitting} classes={styles} />
                  ) : null}
                </div>
              </div>
              <div className="paper paper-p0">
                <textarea
                  className={`${styles['content-simple']} ${styles['content-simple-feed']}`}
                  required
                  value={content}
                  disabled={isSubmitting}
                  maxLength={MAX_CONTENT_LENGTH + 1}
                  aria-label="커뮤니티 글 내용"
                  placeholder="무슨 일이 일어나고 있나요??"
                  onChange={(event) => {
                    setContent(event.currentTarget.value);
                    setFieldError('');
                  }}
                />
              </div>
              {fieldError ? <div className="paper paper-error">{fieldError}</div> : null}
              <div className={styles['button-group']}>
                <Anchor href={`/${siteName}/community-on-blog`} className={`${styles.link} link`}>
                  취소
                </Anchor>
                <button type="submit" className={`${styles.submit} button`} disabled={!canPost}>
                  {isSubmitting ? '게시 중' : '게시'}
                </button>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
      <FormErrorDialog
        open={Boolean(dialogError)}
        title="글 작성 오류"
        messages={dialogError ? [dialogError] : []}
        onClose={() => setDialogError(null)}
      />
    </Container>
  );
}
