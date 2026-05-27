'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import Link from '@mui/material/Link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  InputAdornment,
  Stack,
  styled,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ToastEditor from '@/components/editor/ToastEditor';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../../menu';
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

type ContentRow = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  content_html: string;
  content_markdown: string | null;
  created_at: string;
  edited_at: string;
  og_image: string | null;
  og_image_url: string | null;
  attachment_slug: string | null;
  attachment_origin: string | null;
  sort_order: number;
  user_id: string;
  site_id: string;
  board_id: string;
  author_name: string;
  is_comment: boolean;
};

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
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const fileInputReference = useRef<HTMLInputElement | null>(null);
  const editorBlobImagesReference = useRef<EditorBlobImage[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [initialSlug, setInitialSlug] = useState('');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [, setEditorBlobImages] = useState<EditorBlobImage[]>([]);
  const [ogImage, setOgImage] = useState('');
  const [ogImageUrl, setOgImageUrl] = useState('');
  const [isComment, setIsComment] = useState(false);
  const [slugMessage, setSlugMessage] = useState('');
  const [isSlugAvailable, setIsSlugAvailable] = useState<boolean | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingOgImage, setIsUploadingOgImage] = useState(false);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    async function loadContent() {
      try {
        const statusResponse = await fetch(`/api/manage/contents/pages/status?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const statusResult = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(statusResult.error ?? '페이지 상태를 확인하지 못했습니다.');
        }

        if (!statusResult.hasBoard || !statusResult.boardName) {
          throw new Error('페이지 게시판을 찾을 수 없습니다.');
        }

        setBoardName(statusResult.boardName);

        const contentResponse = await fetch(`/api/boards/${statusResult.boardName}/${contentId}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const contentResult = await contentResponse.json();

        if (!contentResponse.ok) {
          throw new Error(contentResult.error ?? '페이지 정보를 불러오지 못했습니다.');
        }

        const content = contentResult.content as ContentRow;

        setSlug(content.slug ?? '');
        setInitialSlug(content.slug ?? '');
        setSubject(content.subject ?? '');
        setSummary(content.summary ?? '');
        setContentHtml(content.content_html ?? '');
        setContentMarkdown(content.content_markdown ?? '');
        setOgImage(content.og_image ?? '');
        setOgImageUrl(content.og_image_url ?? '');
        setIsComment(Boolean(content.is_comment));
        setSlugMessage('');
        setIsSlugAvailable(null);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '페이지 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('페이지 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadContent();
  }, [contentId, siteName]);

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

  function handleIsCommentChange(event: InputChangeEvent) {
    setIsComment(event.currentTarget.checked);
  }

  async function handleCheckSlug() {
    if (isCheckingSlug || !boardName) {
      return;
    }

    setSlugMessage('');
    setIsSlugAvailable(null);

    try {
      setIsCheckingSlug(true);

      const response = await fetch(
        `/api/manage/contents/pages/check-slug?siteName=${siteName}&boardName=${normalizeBoardName(boardName)}&slug=${slug}&currentSlug=${initialSlug}`,
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
      if (ogImage) {
        await fetch('/api/attachment/delete/og-image/page', {
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

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/attachment/add/og-image/page', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '오픈그래프 이미지 업로드에 실패했습니다.');
      }

      setOgImage(result.ogImage ?? '');
      setOgImageUrl(result.url ?? '');
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

    if (isSubmitting || !boardName) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const slugCheckResponse = await fetch(
        `/api/manage/contents/pages/check-slug?siteName=${siteName}&boardName=${normalizeBoardName(boardName)}&slug=${slug}&currentSlug=${initialSlug}`,
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

      const response = await fetch(`/api/boards/${boardName}/${contentId}/edit`, {
        method: 'PATCH',
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
          isComment,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '페이지 수정에 실패했습니다.');
      }

      router.replace(`/${siteName}/manage/contents/pages/${result.slug}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '페이지 수정에 실패했습니다.');
      } else {
        setErrorMessage('페이지 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  if (isLoading) {
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/pages/${contentId}`} menu="contents">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/pages/${contentId}`} menu="contents">
      <div className="container">
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {isMobile ? (
            <Typography variant="h5" component="h2" sx={{ p: 2 }}>
              페이지 수정
            </Typography>
          ) : null}

          <Stack component="form" gap={2.5} onSubmit={handleSubmit}>
            <Stack gap={1}>
              <TextField
                label="페이지 식별자 (필수)"
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
                        <Button
                          type="button"
                          variant="outlined"
                          onClick={() => void handleCheckSlug()}
                          disabled={isCheckingSlug}
                          size="small"
                        >
                          중복 확인
                        </Button>
                      </InputAdornment>
                    ),
                  },
                }}
              />
              {slugMessage ? (
                <Alert
                  severity={isSlugAvailable ? 'success' : 'error'}
                  variant={isSlugAvailable ? 'outlined' : 'filled'}
                >
                  {slugMessage}
                </Alert>
              ) : null}
            </Stack>

            <TextField
              label="페이지 제목 (필수)"
              value={subject}
              onChange={handleSubjectChange}
              fullWidth
              size="small"
            />
            <TextField label="페이지 부제목" value={summary} onChange={handleSummaryChange} fullWidth size="small" />

            <FormControlLabel
              control={<Switch checked={isComment} onChange={handleIsCommentChange} />}
              label={isComment ? '댓글 허용' : '댓글 금지'}
            />

            <Box>
              <Typography sx={{ mb: 1 }} variant="subtitle2">
                오픈그래프 이미지
              </Typography>

              {ogImageUrl ? (
                <Box
                  component="img"
                  src={ogImageUrl}
                  alt="오픈그래프 이미지"
                  sx={{ width: '100%', maxWidth: 480, display: 'block', mb: 1.5 }}
                />
              ) : null}

              <VisuallyHiddenInput
                ref={fileInputReference}
                type="file"
                accept="image/*"
                onChange={handleOgImageFileChange}
              />

              <Button type="button" variant="outlined" onClick={handleClickOgImageUpload} disabled={isUploadingOgImage}>
                {ogImageUrl ? '이미지 교체' : '이미지 추가'}
              </Button>
            </Box>

            <Box>
              <Typography sx={{ mb: 1 }} variant="subtitle2">
                페이지 내용 (필수)
              </Typography>
              <ToastEditor
                initialValue={contentHtml}
                initialMarkdown={contentMarkdown}
                initialEditType="markdown"
                onHtmlChange={setContentHtml}
                onMarkdownChange={setContentMarkdown}
                onUploadImage={handleUploadEditorImage}
              />
            </Box>

            <Stack direction="row" gap={1.5} justifyContent="flex-end">
              <Button
                component={Link}
                href={`/${siteName}/manage/contents/pages/${contentId}`}
                underline="none"
                variant="outlined"
                size="large"
              >
                취소
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting || !boardName} size="large">
                저장
              </Button>
            </Stack>

            {errorMessage ? (
              <Alert severity="error" variant="filled">
                {errorMessage}
              </Alert>
            ) : null}
          </Stack>
        </div>
      </div>
    </Container>
  );
}
