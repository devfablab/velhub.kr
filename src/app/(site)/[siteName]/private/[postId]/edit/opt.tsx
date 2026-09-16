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

type Category = { id: string; label: string };
type EditableImage = { id: string; file: File | null; previewUrl: string };
type Post = {
  category_id: string;
  content_html: string;
  subject: string;
  images: { id: string; url: string }[];
};
type BoardResponse = { board?: { is_image_enabled: boolean }; categories?: Category[]; error?: string };
type PostResponse = { post?: Post; error?: string };

const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_FILE_SIZE = 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const postId = normalizeText(params.postId);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [subject, setSubject] = useState('');
  const [isImageEnabled, setIsImageEnabled] = useState(false);
  const [images, setImages] = useState<EditableImage[]>([]);
  const [imageDialogImages, setImageDialogImages] = useState<EditableImage[]>([]);
  const [imageDialogMessage, setImageDialogMessage] = useState('');
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const categorySelectReference = useRef<HTMLDivElement | null>(null);
  const imageInputReference = useRef<HTMLInputElement | null>(null);
  const [subjectPaddingLeft, setSubjectPaddingLeft] = useState(12);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const width = categorySelectReference.current?.getBoundingClientRect().width ?? 0;
      setSubjectPaddingLeft(Math.ceil(width) + 12);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [categories, categoryId]);

  useEffect(() => {
    void Promise.all([
      fetch(`/api/private-board?siteName=${siteName}`, { credentials: 'include' }),
      fetch(`/api/private-board/${postId}?siteName=${siteName}`, { credentials: 'include' }),
    ])
      .then(async ([boardResponse, postResponse]) => {
        const boardResult = (await boardResponse.json()) as BoardResponse;
        const postResult = (await postResponse.json()) as PostResponse;

        if (boardResponse.status === 401 || postResponse.status === 401) {
          router.replace(`/auth/sign-in?next=/${siteName}/private/${postId}/edit`);
          return;
        }

        if (!boardResponse.ok || !postResponse.ok || !postResult.post) {
          setErrorMessage(postResult.error ?? boardResult.error ?? '글 수정 정보를 불러오지 못했습니다.');
          return;
        }

        setCategories(boardResult.categories ?? []);
        setCategoryId(postResult.post.category_id);
        setSubject(postResult.post.subject);
        setContentHtml(postResult.post.content_html);
        setIsImageEnabled(boardResult.board?.is_image_enabled === true);
        setImages(postResult.post.images.map((image) => ({ id: image.id, file: null, previewUrl: image.url })));
      })
      .catch(() => setErrorMessage('글 수정 정보를 불러오지 못했습니다.'))
      .finally(() => setIsLoading(false));
  }, [postId, router, siteName]);

  async function handleSubmit() {
    if (isSaving) return;

    setErrorMessage('');
    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.set('categoryId', categoryId);
      formData.set('contentHtml', contentHtml);
      formData.set('subject', subject);
      formData.set(
        'retainedImageIds',
        JSON.stringify(images.filter((image) => image.file === null).map((image) => image.id)),
      );
      images.forEach((image) => {
        if (image.file) formData.append('images', image.file);
      });
      const response = await fetch(`/api/private-board/${postId}?siteName=${siteName}`, {
        body: formData,
        credentials: 'include',
        method: 'PUT',
      });
      const result = (await response.json()) as PostResponse;

      if (!response.ok) throw new Error(result.error ?? '글 수정에 실패했습니다.');

      router.replace(`/${siteName}/private/${postId}`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '글 수정에 실패했습니다.');
      setIsSaving(false);
    }
  }

  function openImageDialog() {
    setImageDialogImages(images);
    setImageDialogMessage('');
    setImageDialogOpen(true);
  }

  function closeImageDialog() {
    imageDialogImages.forEach((image) => {
      if (image.file && !images.some((savedImage) => savedImage.id === image.id)) {
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
      if (image.file && !imageDialogImages.some((dialogImage) => dialogImage.id === image.id)) {
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
    setImageDialogImages((currentImages) => [
      ...currentImages,
      ...selectedFiles.map((file) => ({ id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) })),
    ]);
    setImageDialogMessage('');
    event.currentTarget.value = '';
  }

  function removeImage(imageId: string) {
    setImageDialogImages((currentImages) => {
      const targetImage = currentImages.find((image) => image.id === imageId);

      if (targetImage?.file && !images.some((savedImage) => savedImage.id === imageId)) {
        URL.revokeObjectURL(targetImage.previewUrl);
      }

      return currentImages.filter((image) => image.id !== imageId);
    });
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
            <span>글 수정</span>
          </h2>
        )}
        {isLoading ? (
          <div className="paper">
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        ) : (
          <>
            {errorMessage ? <div className="paper paper-error">{errorMessage}</div> : null}
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSubmit();
              }}
              className={`${styles.form} form`}
            >
              <fieldset>
                <legend>비공개 게시판 글 수정 폼</legend>
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
                  <Anchor href={`/${siteName}/private/${postId}`} className={`${styles.link} link`}>
                    취소
                  </Anchor>
                  <button type="submit" className={`${styles.submit} button`} disabled={isSaving}>
                    수정 완료
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
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.previewUrl} alt="" />
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="drawer-dialog-actions">
                  <button type="button" onClick={closeImageDialog} className="button medium cancel">
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={applyImageDialog}
                    disabled={imageDialogImages.length === 0}
                    className="button medium submit"
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
          </>
        )}
      </div>
    </div>
  );
}
