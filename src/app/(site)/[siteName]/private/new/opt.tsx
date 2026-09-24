'use client';

import { type ChangeEvent, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  MenuItem,
  Select,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ToastEditor from '@/components/editor/ToastEditor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import styles from '@/app/board.module.sass';

export type Response = {
  board?: { is_image_enabled: boolean };
  categories?: { id: string; label: string }[];
  error?: string;
};

type SelectedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_FILE_SIZE = 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function Opt({
  initialData,
  initialError,
  initialStatus,
}: {
  initialData: Response | null;
  initialError: string;
  initialStatus: number;
}) {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const [categories] = useState<{ id: string; label: string }[]>(initialData?.categories ?? []);
  const [categoryId, setCategoryId] = useState(initialData?.categories?.[0]?.id ?? '');
  const [isImageEnabled] = useState(initialData?.board?.is_image_enabled === true);
  const [subject, setSubject] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [imageDialogImages, setImageDialogImages] = useState<SelectedImage[]>([]);
  const [imageDialogMessage, setImageDialogMessage] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [error, setError] = useState(initialError);
  const [isLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const categorySelectReference = useRef<HTMLDivElement | null>(null);
  const imageInputReference = useRef<HTMLInputElement | null>(null);
  const [subjectPaddingLeft, setSubjectPaddingLeft] = useState(12);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    if (initialStatus === 401) router.replace(`/auth/sign-in?next=/${siteName}/private/new`);
  }, [initialStatus, router, siteName]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const width = categorySelectReference.current?.getBoundingClientRect().width ?? 0;
      setSubjectPaddingLeft(Math.ceil(width) + 12);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [categories, categoryId]);

  async function submit() {
    if (isSaving) return;
    setError('');
    setIsSaving(true);
    const formData = new FormData();
    formData.set('siteName', siteName);
    formData.set('categoryId', categoryId);
    formData.set('subject', subject);
    formData.set('contentHtml', contentHtml);
    images.forEach((image) => formData.append('images', image.file));
    const response = await fetch('/api/private-board/posts', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    const result = (await response.json()) as { id?: string; error?: string };
    if (!response.ok || !result.id) {
      setError(result.error ?? '글 작성에 실패했습니다.');
      setIsSaving(false);
      return;
    }
    router.replace(`/${siteName}/private/${result.id}`);
  }

  function openImageDialog() {
    setImageDialogImages(images);
    setImageDialogMessage('');
    setImageDialogOpen(true);
  }

  function closeImageDialog() {
    imageDialogImages.forEach((image) => {
      if (!images.some((savedImage) => savedImage.id === image.id)) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
    setImageDialogImages([]);
    setImageDialogMessage('');
    setImageDialogOpen(false);
    if (imageInputReference.current) imageInputReference.current.value = '';
  }

  function applyImageDialog() {
    images.forEach((image) => {
      if (!imageDialogImages.some((dialogImage) => dialogImage.id === image.id)) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });
    setImages(imageDialogImages);
    setImageDialogImages([]);
    setImageDialogMessage('');
    setImageDialogOpen(false);
    if (imageInputReference.current) imageInputReference.current.value = '';
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);
    if (selectedFiles.length === 0) return;
    if (imageDialogImages.length + selectedFiles.length > MAX_IMAGE_COUNT) {
      setImageDialogMessage(`이미지는 ${MAX_IMAGE_COUNT}개를 초과할 수 없습니다.`);
      event.currentTarget.value = '';
      return;
    }
    if (selectedFiles.some((file) => !ACCEPTED_IMAGE_TYPES.includes(file.type))) {
      setImageDialogMessage('png, jpeg, webp 이미지만 등록할 수 있습니다.');
      event.currentTarget.value = '';
      return;
    }
    if (selectedFiles.some((file) => file.size > MAX_IMAGE_FILE_SIZE)) {
      setImageDialogMessage('이미지 한 장의 용량은 1MB 이하만 등록할 수 있습니다.');
      event.currentTarget.value = '';
      return;
    }
    setImageDialogImages((previousImages) => [
      ...previousImages,
      ...selectedFiles.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) })),
    ]);
    setImageDialogMessage('');
    event.currentTarget.value = '';
  }

  function removeImage(imageId: string) {
    setImageDialogImages((previousImages) => {
      const targetImage = previousImages.find((image) => image.id === imageId);
      if (targetImage && !images.some((savedImage) => savedImage.id === imageId)) {
        URL.revokeObjectURL(targetImage.previewUrl);
      }
      return previousImages.filter((image) => image.id !== imageId);
    });
  }

  if (isLoading) {
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
            <h2>
              <ListAltOutlinedIcon />
              <span>글쓰기</span>
            </h2>
          )}
          <div className="paper">
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <h2>
            <ListAltOutlinedIcon />
            <span>글쓰기</span>
          </h2>
        )}
        {error ? <div className="paper paper-error">{error}</div> : null}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
          className={`${styles.form} form`}
        >
          <fieldset>
            <legend>비공개 게시판 글쓰기 폼</legend>
            <div className="paper">
              <div className={styles['post-info']}>
                <div className={styles['form-group']}>
                  <div ref={categorySelectReference} className={styles['form-select']}>
                    <Select
                      displayEmpty
                      value={categoryId}
                      onChange={(event) => setCategoryId(event.target.value)}
                      className={styles['MuiInputBase-root']}
                    >
                      {categories.map((category) => (
                        <MenuItem key={category.id} value={category.id}>
                          {category.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </div>
                  <div className={styles['form-control']}>
                    <input
                      type="text"
                      value={subject}
                      onChange={(event) => setSubject(event.currentTarget.value)}
                      placeholder="제목을 입력해 주세요 (필수)"
                      style={{ paddingLeft: subjectPaddingLeft }}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className={`${styles.editor} ${styles['editor-basic']} service-editor`}>
              <ToastEditor
                initialValue={contentHtml}
                initialMarkdown=""
                initialEditType="wysiwyg"
                hideModeSwitch
                markdownStatus="markdown_off"
                onHtmlChange={setContentHtml}
                onMarkdownChange={() => {}}
              />
            </div>
            {isImageEnabled ? (
              <div className="paper">
                <button type="button" className="button medium action" onClick={openImageDialog}>
                  첨부 이미지 {images.length}/{MAX_IMAGE_COUNT}
                </button>
              </div>
            ) : null}
            <div className={styles['button-group']}>
              <Anchor href={`/${siteName}/private`} className={`${styles.link} link`}>
                취소
              </Anchor>
              <button type="submit" className={`${styles.submit} button`} disabled={isSaving}>
                등록
              </button>
            </div>
          </fieldset>
        </form>

        {isMobile ? (
          <Drawer
            anchor="bottom"
            open={imageDialogOpen}
            onClose={closeImageDialog}
            className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['thumbnail-dialog']}`}
          >
            <h2>첨부 이미지 업로드</h2>
            <button type="button" className="close-button" onClick={closeImageDialog} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <div className={`VhiDrawer-bottom-content ${styles['thumbnail-dialog-content']}`}>
              {imageDialogMessage ? (
                <DialogContentText className={styles['thumbnail-dialog-message']}>
                  {imageDialogMessage}
                </DialogContentText>
              ) : null}
              <div className={styles['thumbnail-uploader']}>
                <button
                  type="button"
                  className={styles['thumbnail-upload-button']}
                  onClick={() => imageInputReference.current?.click()}
                >
                  <span>
                    이미지 추가 {imageDialogImages.length}/{MAX_IMAGE_COUNT}
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
              {imageDialogImages.length > 0 ? (
                <div className={styles['gallery-dialog-preview']}>
                  {imageDialogImages.map((image) => (
                    <div key={image.id} className={styles['gallery-dialog-preview-image']}>
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        aria-label="이미지 삭제"
                        className={styles['gallery-dialog-remove-button']}
                      >
                        <CloseRoundedIcon />
                      </button>
                      {/* Local object URLs are only used for the unsaved image preview. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.previewUrl} alt="" />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="drawer-dialog-actions">
              <button type="button" onClick={closeImageDialog} className="button small cancel">
                취소
              </button>
              <button
                type="button"
                onClick={applyImageDialog}
                disabled={imageDialogImages.length === 0}
                className="button small submit"
              >
                이미지 업로드
              </button>
            </div>
          </Drawer>
        ) : (
          <Dialog
            open={imageDialogOpen}
            onClose={closeImageDialog}
            className={`vh-dialog vh-alert-dialog ${styles['thumbnail-dialog']}`}
          >
            <DialogTitle>첨부 이미지 업로드</DialogTitle>
            <button type="button" className="close-button" onClick={closeImageDialog} aria-label="닫기">
              <CloseRoundedIcon />
            </button>
            <DialogContent className={styles['thumbnail-dialog-content']}>
              {imageDialogMessage ? (
                <DialogContentText className={styles['thumbnail-dialog-message']}>
                  {imageDialogMessage}
                </DialogContentText>
              ) : null}
              <div className={styles['thumbnail-uploader']}>
                <button
                  type="button"
                  className={styles['thumbnail-upload-button']}
                  onClick={() => imageInputReference.current?.click()}
                >
                  <span>
                    이미지 추가 {imageDialogImages.length}/{MAX_IMAGE_COUNT}
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
              {imageDialogImages.length > 0 ? (
                <div className={styles['gallery-dialog-preview']}>
                  {imageDialogImages.map((image) => (
                    <div key={image.id} className={styles['gallery-dialog-preview-image']}>
                      <button
                        type="button"
                        onClick={() => removeImage(image.id)}
                        aria-label="이미지 삭제"
                        className={styles['gallery-dialog-remove-button']}
                      >
                        <CloseRoundedIcon />
                      </button>
                      {/* Local object URLs are only used for the unsaved image preview. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.previewUrl} alt="" />
                    </div>
                  ))}
                </div>
              ) : null}
            </DialogContent>
            <DialogActions>
              <button type="button" onClick={closeImageDialog} className="cancel-button">
                취소
              </button>
              <button type="button" onClick={applyImageDialog} disabled={imageDialogImages.length === 0}>
                이미지 적용
              </button>
            </DialogActions>
          </Dialog>
        )}
      </div>
    </div>
  );
}
