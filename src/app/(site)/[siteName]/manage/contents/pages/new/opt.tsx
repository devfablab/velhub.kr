'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Box, InputAdornment, Stack, styled, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import ToastEditor from '@/components/editor/ToastEditor';
import Anchor from '@/components/Anchor';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type UploadResponse = {
  ok?: boolean;
  path?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  error?: string;
};

type EditorBlobImage = {
  id: string;
  file: File;
  previewUrl: string;
};

const MAX_EDITOR_IMAGE_FILE_SIZE = 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

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

function normalizeSlug(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function normalizeBoardName(rawValue: string | null) {
  return rawValue?.trim().toLowerCase() ?? '';
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('이미지를 불러오지 못했습니다.'));
    };

    image.src = imageUrl;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 변환에 실패했습니다.'));
          return;
        }

        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}

async function convertImageToWebpFile(file: File, errorMessage = '이미지는 1MB 이하로 등록해주세요.') {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지 변환에 실패했습니다.');
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  const qualitySteps = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5];
  let convertedBlob: Blob | null = null;

  for (const quality of qualitySteps) {
    const nextBlob = await canvasToWebpBlob(canvas, quality);

    if (nextBlob.size <= MAX_EDITOR_IMAGE_FILE_SIZE) {
      convertedBlob = nextBlob;
      break;
    }

    convertedBlob = nextBlob;
  }

  if (!convertedBlob || convertedBlob.size > MAX_EDITOR_IMAGE_FILE_SIZE) {
    throw new Error(errorMessage);
  }

  const filename = `${file.name.replace(/\.[^.]+$/, '') || `image-${Date.now()}`}.webp`;

  return new File([convertedBlob], filename, {
    type: 'image/webp',
  });
}

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const fileInputReference = useRef<HTMLInputElement | null>(null);
  const editorBlobImagesReference = useRef<EditorBlobImage[]>([]);

  const [slug, setSlug] = useState('');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [markdownStatus, setMarkdownStatus] = useState<string | null>('markdown_default');
  const [editorBlobImages, setEditorBlobImages] = useState<EditorBlobImage[]>([]);
  const [ogImage, setOgImage] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [slugMessage, setSlugMessage] = useState('');
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingOgImage, setIsUploadingOgImage] = useState(false);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    return () => {
      editorBlobImagesReference.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      editorBlobImagesReference.current = [];
    };
  }, []);

  function handleSlugChange(event: InputChangeEvent) {
    const normalizedValue = normalizeSlug(event.currentTarget.value);

    setSlug(normalizedValue);
    setSlugMessage('');
    setIsSlugAvailable(null);
  }

  function handleSubjectChange(event: InputChangeEvent) {
    setSubject(event.currentTarget.value);
  }

  function handleSummaryChange(event: InputChangeEvent) {
    setSummary(event.currentTarget.value);
  }

  async function handleCheckSlug() {
    if (isCheckingSlug) {
      return;
    }

    setSlugMessage('');
    setIsSlugAvailable(null);

    try {
      setIsCheckingSlug(true);

      const statusResponse = await fetch(`/api/manage/contents/pages/status?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const statusResult = await statusResponse.json();

      if (!statusResponse.ok) {
        throw new Error(statusResult.error ?? '페이지 식별자 확인에 실패했습니다.');
      }

      const boardName = normalizeBoardName(statusResult.boardName || 'p');

      const response = await fetch(
        `/api/manage/contents/pages/check-slug?siteName=${siteName}&boardName=${boardName}&slug=${slug}`,
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '페이지 식별자 확인에 실패했습니다.');
      }

      if (result.ok) {
        setIsSlugAvailable(true);
        setSlug(result.slug ?? slug);
        setSlugMessage('사용 가능한 페이지 식별자입니다.');
        return;
      }

      setIsSlugAvailable(false);
      setSlug(result.slug ?? slug);
      setSlugMessage(result.error ?? '사용할 수 없는 페이지 식별자입니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setIsSlugAvailable(false);
        setSlugMessage(unknownError.message || '페이지 식별자 확인에 실패했습니다.');
      } else {
        setIsSlugAvailable(false);
        setSlugMessage('페이지 식별자 확인에 실패했습니다.');
      }
    } finally {
      setIsCheckingSlug(false);
    }
  }

  function handleClickOgImageUpload() {
    if (isUploadingOgImage) {
      return;
    }

    fileInputReference.current?.click();
  }

  async function handleOgImageFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || isUploadingOgImage) {
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setIsUploadingOgImage(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/attachment/add/og-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '오픈그래프 이미지 업로드에 실패했습니다.');
      }

      setOgImage(typeof result.ogImage === 'string' ? result.ogImage : '');
      setOgImageUrl(typeof result.url === 'string' ? result.url : '');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '오픈그래프 이미지 업로드에 실패했습니다.');
      } else {
        setErrorMessage('오픈그래프 이미지 업로드에 실패했습니다.');
      }
    } finally {
      setIsUploadingOgImage(false);
      inputElement.value = '';
    }
  }

  async function uploadPostImage(file: File) {
    const formData = new FormData();

    formData.append('file', file);
    formData.append('folder', 'editor');
    formData.append('siteName', siteName);

    const response = await fetch('/api/attachment/add/post', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const result = (await response.json()) as UploadResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '이미지 업로드에 실패했습니다.');
    }

    if (!result.path || !result.url) {
      throw new Error('이미지 업로드에 실패했습니다.');
    }

    return {
      path: result.path,
      url: result.url,
      width: typeof result.width === 'number' ? result.width : null,
      height: typeof result.height === 'number' ? result.height : null,
    };
  }

  async function handleUploadEditorImage(file: Blob | File) {
    const editorFile =
      file instanceof File
        ? file
        : new File([file], `editor-${Date.now()}.png`, {
            type: file.type || 'image/png',
          });

    if (!ACCEPTED_IMAGE_TYPES.includes(editorFile.type)) {
      throw new Error('png, jpeg, webp 이미지만 등록할 수 있습니다.');
    }

    if (editorFile.size > MAX_EDITOR_IMAGE_FILE_SIZE) {
      throw new Error('이미지는 1MB 이하로 등록해주세요.');
    }

    const previewUrl = URL.createObjectURL(editorFile);
    const nextImage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      file: editorFile,
      previewUrl,
    };

    editorBlobImagesReference.current = [...editorBlobImagesReference.current, nextImage];
    setEditorBlobImages(editorBlobImagesReference.current);

    return previewUrl;
  }

  function replaceAllImageUrl(value: string, fromUrl: string, toUrl: string) {
    return value.split(fromUrl).join(toUrl);
  }

  async function uploadEditorImagesIfNeeded() {
    const currentEditorBlobImages = editorBlobImagesReference.current;

    if (currentEditorBlobImages.length === 0) {
      return {
        contentHtml,
        contentMarkdown,
      };
    }

    let nextContentHtml = contentHtml;
    let nextContentMarkdown = contentMarkdown;
    const usedPreviewUrls = new Set<string>();

    for (const image of currentEditorBlobImages) {
      const isUsedInHtml = nextContentHtml.includes(image.previewUrl);
      const isUsedInMarkdown = nextContentMarkdown.includes(image.previewUrl);

      if (!isUsedInHtml && !isUsedInMarkdown) {
        URL.revokeObjectURL(image.previewUrl);
        continue;
      }

      const webpFile = await convertImageToWebpFile(image.file, '이미지는 1MB 이하로 등록해주세요.');
      const uploadedImage = await uploadPostImage(webpFile);

      nextContentHtml = replaceAllImageUrl(nextContentHtml, image.previewUrl, uploadedImage.url);
      nextContentMarkdown = replaceAllImageUrl(nextContentMarkdown, image.previewUrl, uploadedImage.url);
      usedPreviewUrls.add(image.previewUrl);

      URL.revokeObjectURL(image.previewUrl);
    }

    const remainingEditorBlobImages = currentEditorBlobImages.filter((image) => !usedPreviewUrls.has(image.previewUrl));

    editorBlobImagesReference.current = remainingEditorBlobImages;
    setContentHtml(nextContentHtml);
    setContentMarkdown(nextContentMarkdown);
    setEditorBlobImages(remainingEditorBlobImages);

    return {
      contentHtml: nextContentHtml,
      contentMarkdown: nextContentMarkdown,
    };
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const statusResponse = await fetch(`/api/manage/contents/pages/status?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const statusResult = await statusResponse.json();

      if (!statusResponse.ok) {
        throw new Error(statusResult.error ?? '페이지 상태를 확인하지 못했습니다.');
      }

      const boardName = normalizeBoardName(statusResult.boardName || 'p');

      const slugCheckResponse = await fetch(
        `/api/manage/contents/pages/check-slug?siteName=${siteName}&boardName=${boardName}&slug=${slug}`,
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      const slugCheckResult = await slugCheckResponse.json();

      if (!slugCheckResponse.ok) {
        throw new Error(slugCheckResult.error ?? '페이지 식별자 확인에 실패했습니다.');
      }

      if (!slugCheckResult.ok) {
        setIsSlugAvailable(false);
        setSlugMessage(slugCheckResult.error ?? '사용할 수 없는 페이지 식별자입니다.');
        throw new Error(slugCheckResult.error ?? '사용할 수 없는 페이지 식별자입니다.');
      }

      setSlug(slugCheckResult.slug ?? slug);
      setIsSlugAvailable(true);
      setSlugMessage('사용 가능한 페이지 식별자입니다.');

      const uploadedEditorContent = await uploadEditorImagesIfNeeded();

      const targetUrl =
        statusResult.hasBoard && statusResult.boardName
          ? `/api/boards/${statusResult.boardName}/new`
          : '/api/manage/contents/pages/new';

      const createResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          slug: slugCheckResult.slug ?? slug,
          subject,
          summary,
          contentHtml: uploadedEditorContent.contentHtml,
          contentMarkdown: uploadedEditorContent.contentMarkdown,
          ogImage: ogImage || null,
          attachmentSlug: null,
          attachmentOrigin: null,
        }),
      });

      const createResult = await createResponse.json();

      if (!createResponse.ok) {
        if (ogImage) {
          await fetch('/api/attachment/delete/og-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              path: ogImage,
            }),
          });
        }

        throw new Error(createResult.error ?? '페이지 추가에 실패했습니다.');
      }

      router.replace(`/${siteName}/manage/contents/pages/${createResult.slug}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '페이지 추가에 실패했습니다.');
      } else {
        setErrorMessage('페이지 추가에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/pages`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {isMobile ? (
            <Typography variant="h5" component="h2" sx={{ p: 2 }}>
              페이지 생성
            </Typography>
          ) : null}

          <div className={`paper ${styles.paper}`}>
            <Stack component="form" gap={2.5} onSubmit={handleSubmit}>
              <Stack gap={1}>
                <Typography variant="subtitle2">페이지 식별자 *</Typography>
                <TextField
                  placeholder="페이지 식별자 (필수)"
                  value={slug}
                  onChange={handleSlugChange}
                  fullWidth
                  size="medium"
                  helperText={`스텝 관리화면: ${baseUrl}/${siteName}/manage/contents/pages/${slug}`}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          {baseUrl}/{siteName}/p/
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <button
                            type="button"
                            className="button small action"
                            onClick={() => void handleCheckSlug()}
                            disabled={isCheckingSlug}
                          >
                            중복 확인
                          </button>
                        </InputAdornment>
                      ),
                    },
                  }}
                />
                {slugMessage ? (
                  <p className={`alert ${isSlugAvailable ? 'info' : 'error'}`}>
                    {isSlugAvailable ? <InfoOutlineRoundedIcon /> : <ErrorOutlineRoundedIcon />}
                    {slugMessage}
                  </p>
                ) : null}
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">페이지 제목 *</Typography>
                <TextField
                  placeholder="페이지 제목 (필수)"
                  value={subject}
                  onChange={handleSubjectChange}
                  fullWidth
                  size="small"
                />
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">페이지 부제목</Typography>
                <TextField value={summary} onChange={handleSummaryChange} fullWidth size="small" />
              </Stack>

              <Stack direction="column">
                <Stack direction="row" gap={2} justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">오픈그래프 이미지</Typography>

                  <VisuallyHiddenInput
                    ref={fileInputReference}
                    type="file"
                    accept="image/*"
                    onChange={handleOgImageFileChange}
                  />

                  <button
                    type="button"
                    onClick={handleClickOgImageUpload}
                    disabled={isUploadingOgImage}
                    className="button small action"
                  >
                    {ogImageUrl ? '이미지 교체' : '이미지 추가'}
                  </button>
                </Stack>
                {ogImageUrl ? (
                  <Box
                    component="img"
                    src={ogImageUrl}
                    alt="오픈그래프 이미지"
                    sx={{ maxWidth: '100%', height: 'auto', display: 'block', mb: 1.5 }}
                  />
                ) : null}
              </Stack>

              <Stack gap={2}>
                <Typography variant="subtitle2">페이지 내용 *</Typography>
                <ToastEditor
                  initialValue={contentHtml}
                  initialMarkdown={contentMarkdown}
                  initialEditType="wysiwyg"
                  themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                  markdownStatus={markdownStatus}
                  hideModeSwitch
                  onHtmlChange={setContentHtml}
                  onMarkdownChange={setContentMarkdown}
                  onUploadImage={handleUploadEditorImage}
                />
              </Stack>

              <Stack direction="row" gap={1.5} justifyContent="flex-end">
                <Anchor className="button medium cancel" href={`/${siteName}/manage/contents/pages`}>
                  취소
                </Anchor>
                {isMobile ? (
                  <div className={styles['button-top']}>
                    <button type="submit" className={`button ${styles.button}`} disabled={isSubmitting}>
                      저장
                    </button>
                  </div>
                ) : (
                  <button type="submit" className="button medium submit" disabled={isSubmitting}>
                    저장
                  </button>
                )}
              </Stack>

              {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
            </Stack>
          </div>
        </div>
      </div>
    </Container>
  );
}
