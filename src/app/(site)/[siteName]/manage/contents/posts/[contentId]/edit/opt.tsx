'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  styled,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { ko } from 'date-fns/locale/ko';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import ToastEditor from '@/components/editor/ToastEditor';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Anchor from '@/components/Anchor';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import Container from '../../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type CommentProvider = 'none' | 'giscus' | 'disqus' | 'velhub';

type PublishTimeMode = 'now' | 'scheduled';
type PublishedStatus = 'draft' | 'published' | 'unknown';

type StatusResponse = {
  hasBoard: boolean;
  boardName: string | null;
  commentProvider: CommentProvider;
};

type CategoryRow = {
  id: string;
  category_key: string;
  category_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  sort_order: number;
  board_id: string;
  site_id: string;
  created_at?: string;
};

type SeriesRow = {
  id: string;
  created_at: string;
  series_key: string;
  series_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  board_id: string;
  site_id: string;
  last_published_at: string | null;
  is_completed: boolean;
  user_id: string | null;
};

type ContentResponse = {
  content?: {
    published_status: string;
    published_at: string;
    id: string;
    slug: string;
    subject: string;
    summary: string | null;
    content_html: string;
    content_markdown: string | null;
    thumbnail_image: string | null;
    thumbnail_width: number | null;
    thumbnail_height: number | null;
    is_comment: boolean;
    markdown_status: string | null;
  };
  categories?: CategoryRow[];
  series?: SeriesRow | null;
  error?: string;
};

type EditResponse = {
  ok?: boolean;
  slug?: string;
  error?: string;
};

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

type CategoryListResponse = {
  categories?: CategoryRow[];
  error?: string;
};

type SeriesListResponse = {
  series?: SeriesRow[];
  error?: string;
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

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지 정보를 불러오지 못했습니다.'));
    };

    image.src = objectUrl;
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

function createWebpFile(blob: Blob, originalFile: File) {
  const baseName = originalFile.name.replace(/\.[^.]+$/, '') || `editor-${Date.now()}`;

  return new File([blob], `${baseName}.webp`, {
    type: 'image/webp',
  });
}

async function convertImageToWebpFile(file: File, maxSizeMessage: string) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('png, jpeg, webp 이미지만 등록할 수 있습니다.');
  }

  if (file.size > MAX_EDITOR_IMAGE_FILE_SIZE) {
    throw new Error(maxSizeMessage);
  }

  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지 변환에 실패했습니다.');
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  const qualities = [0.92, 0.86, 0.8, 0.74, 0.68];

  for (const quality of qualities) {
    const nextBlob = await canvasToWebpBlob(canvas, quality);

    if (nextBlob.size <= MAX_EDITOR_IMAGE_FILE_SIZE) {
      return createWebpFile(nextBlob, file);
    }
  }

  throw new Error(maxSizeMessage);
}

function normalizePublishedStatus(value: string | null | undefined): PublishedStatus {
  if (value === 'draft' || value === 'published' || value === 'unknown') {
    return value;
  }

  return 'published';
}

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const siteName = normalizeText(params.siteName);
  const contentId = normalizeText(params.contentId);
  const ti = normalizeText(searchParams.get('t'));

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const fileInputReference = useRef<HTMLInputElement | null>(null);
  const editorBlobImagesReference = useRef<EditorBlobImage[]>([]);

  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [editorBlobImages, setEditorBlobImages] = useState<EditorBlobImage[]>([]);
  const [thumbnailImage, setThumbnailImage] = useState('');
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState('');
  const [thumbnailWidth, setThumbnailWidth] = useState<number | null>(null);
  const [thumbnailHeight, setThumbnailHeight] = useState<number | null>(null);
  const [hasBoard, setHasBoard] = useState(false);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRow[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState('');
  const [isSeriesLocked, setIsSeriesLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [commentProvider, setCommentProvider] = useState<CommentProvider>('none');
  const [isComment, setIsComment] = useState(false);
  const [publishedStatus, setPublishedStatus] = useState<PublishedStatus>('published');
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [canEditPublishTime, setCanEditPublishTime] = useState(true);
  const [publishTimeMode, setPublishTimeMode] = useState<PublishTimeMode>('now');
  const [scheduledPublishedAt, setScheduledPublishedAt] = useState<Date | null>(null);

  useEffect(() => {
    editorBlobImagesReference.current = editorBlobImages;
  }, [editorBlobImages]);

  useEffect(() => {
    return () => {
      editorBlobImagesReference.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      editorBlobImagesReference.current = [];
    };
  }, []);

  useEffect(() => {
    async function loadData() {
      try {
        setErrorMessage('');
        setIsLoading(true);

        const statusResponse = await fetch(`/api/manage/contents/blog-posts/status?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const statusResult = (await statusResponse.json()) as StatusResponse | { error?: string };

        if (!statusResponse.ok) {
          throw new Error(
            'error' in statusResult
              ? statusResult.error || '블로그 상태를 확인하지 못했습니다.'
              : '블로그 상태를 확인하지 못했습니다.',
          );
        }

        if (!('hasBoard' in statusResult) || !('boardName' in statusResult)) {
          throw new Error('블로그 상태를 확인하지 못했습니다.');
        }

        setHasBoard(statusResult.hasBoard);
        setBoardName(statusResult.boardName);
        setCommentProvider(statusResult.commentProvider);

        if (!statusResult.hasBoard || !statusResult.boardName) {
          return;
        }

        const [contentResponse, categoryResponse, seriesResponse] = await Promise.all([
          fetch(`/api/boards/${statusResult.boardName}/${contentId}?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          }),
          fetch(`/api/boards/${statusResult.boardName}/category?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          }),
          fetch(`/api/boards/${statusResult.boardName}/series?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          }),
        ]);

        const contentResult = (await contentResponse.json()) as ContentResponse;
        const categoryResult = (await categoryResponse.json()) as CategoryListResponse;
        const seriesResult = (await seriesResponse.json()) as SeriesListResponse;

        if (!contentResponse.ok) {
          throw new Error(contentResult.error ?? '글 정보를 불러오지 못했습니다.');
        }

        if (!contentResult.content) {
          throw new Error('글 정보를 불러오지 못했습니다.');
        }

        if (!categoryResponse.ok) {
          throw new Error(categoryResult.error ?? '카테고리 목록을 불러오지 못했습니다.');
        }

        if (!seriesResponse.ok) {
          throw new Error(seriesResult.error ?? '연재 목록을 불러오지 못했습니다.');
        }

        setSubject(contentResult.content.subject);
        setSummary(contentResult.content.summary || '');
        setContentHtml(contentResult.content.content_html);
        setContentMarkdown(contentResult.content.content_markdown || '');
        setThumbnailImage(contentResult.content.thumbnail_image || '');
        setThumbnailWidth(contentResult.content.thumbnail_width ?? null);
        setThumbnailHeight(contentResult.content.thumbnail_height ?? null);
        setIsComment(statusResult.commentProvider === 'none' ? false : contentResult.content.is_comment);
        setSelectedCategories(
          Array.isArray(contentResult.categories)
            ? contentResult.categories.map((category) => category.category_key)
            : [],
        );
        setCategories(Array.isArray(categoryResult.categories) ? categoryResult.categories : []);
        setSeriesList(Array.isArray(seriesResult.series) ? seriesResult.series : []);
        setSelectedSeriesKey(contentResult.series?.series_key || '');
        setIsSeriesLocked(Boolean(contentResult.series?.series_key));
        const contentPublishedStatus = normalizePublishedStatus(contentResult.content.published_status);
        const contentPublishedAt = contentResult.content.published_at;
        const contentPublishedAtDate = contentPublishedAt ? new Date(contentPublishedAt) : null;
        const hasValidPublishedAt = contentPublishedAtDate !== null && !Number.isNaN(contentPublishedAtDate.getTime());
        const isFutureScheduledPost =
          contentPublishedStatus === 'unknown' && hasValidPublishedAt && contentPublishedAtDate.getTime() > Date.now();
        const isPastScheduledPost =
          contentPublishedStatus === 'unknown' && hasValidPublishedAt && contentPublishedAtDate.getTime() <= Date.now();

        setPublishedStatus(contentPublishedStatus);
        setPublishedAt(contentPublishedAt);

        if (isFutureScheduledPost) {
          setCanEditPublishTime(true);
          setPublishTimeMode('scheduled');
          setScheduledPublishedAt(contentPublishedAtDate);
        } else if (isPastScheduledPost) {
          setCanEditPublishTime(false);
          setPublishTimeMode('scheduled');
          setScheduledPublishedAt(contentPublishedAtDate);
        } else {
          setCanEditPublishTime(true);
          setPublishTimeMode('now');
          setScheduledPublishedAt(null);
        }

        if (contentResult.content.thumbnail_image) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
          const imagePath = contentResult.content.thumbnail_image;

          if (supabaseUrl && imagePath) {
            setThumbnailImageUrl(`${supabaseUrl}/storage/v1/object/public/og-image/${imagePath}`);
          } else {
            setThumbnailImageUrl('');
          }
        } else {
          setThumbnailImageUrl('');
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '글 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('글 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadData();
  }, [contentId, siteName]);

  function handlePublishTimeModeChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    if (nextValue !== 'now' && nextValue !== 'scheduled') {
      return;
    }

    setPublishTimeMode(nextValue);

    if (nextValue === 'now') {
      setScheduledPublishedAt(null);
    }

    setErrorMessage('');
  }

  function getScheduledPublishedAtIsoString() {
    if (!scheduledPublishedAt) {
      return '';
    }

    const nextDate = new Date(scheduledPublishedAt);
    nextDate.setSeconds(0, 0);

    if (Number.isNaN(nextDate.getTime())) {
      return '';
    }

    return nextDate.toISOString();
  }

  function getSubmitAction() {
    if (!canEditPublishTime) {
      return 'update';
    }

    if (publishTimeMode === 'scheduled') {
      return 'unknown';
    }

    if (publishedStatus === 'unknown' || publishedStatus === 'draft') {
      return 'publish';
    }

    return 'update';
  }

  function handleSubjectChange(event: InputChangeEvent) {
    setSubject(event.currentTarget.value);
  }

  function handleSummaryChange(event: InputChangeEvent) {
    setSummary(event.currentTarget.value);
  }

  function handleCategoryChange(event: SelectChangeEvent<string[]>) {
    const value = event.target.value;
    setSelectedCategories(typeof value === 'string' ? value.split(',') : value);
  }

  function handleSeriesChange(event: SelectChangeEvent<string>) {
    if (isSeriesLocked) {
      return;
    }

    setSelectedSeriesKey(event.target.value);
  }

  function handleClickThumbnailUpload() {
    if (isUploadingThumbnail) {
      return;
    }

    fileInputReference.current?.click();
  }

  function handleIsCommentChange(event: InputChangeEvent) {
    setIsComment(event.currentTarget.checked);
  }

  async function handleThumbnailFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || isUploadingThumbnail) {
      inputElement.value = '';
      return;
    }

    setErrorMessage('');
    setIsUploadingThumbnail(true);

    try {
      const imageUrl = URL.createObjectURL(selectedFile);

      const imageSize = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const image = new Image();

        image.onload = () => {
          resolve({
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
          URL.revokeObjectURL(imageUrl);
        };

        image.onerror = () => {
          reject(new Error('썸네일 이미지 정보를 불러오지 못했습니다.'));
          URL.revokeObjectURL(imageUrl);
        };

        image.src = imageUrl;
      });

      const previousThumbnailImage = thumbnailImage;

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/attachment/add/og-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '썸네일 이미지 업로드에 실패했습니다.');
      }

      if (previousThumbnailImage) {
        await fetch('/api/attachment/delete/og-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: previousThumbnailImage,
          }),
        });
      }

      setThumbnailImage(result.ogImage ?? '');
      setThumbnailImageUrl(result.url ?? '');
      setThumbnailWidth(imageSize.width);
      setThumbnailHeight(imageSize.height);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '썸네일 이미지 업로드에 실패했습니다.');
      } else {
        setErrorMessage('썸네일 이미지 업로드에 실패했습니다.');
      }
    } finally {
      setIsUploadingThumbnail(false);
      inputElement.value = '';
    }
  }

  async function uploadPostImage(file: File, folder: 'editor') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
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
      const uploadedImage = await uploadPostImage(webpFile, 'editor');

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

    if (isSubmitting || isLoading) {
      return;
    }

    if (!hasBoard || !boardName) {
      setErrorMessage('블로그 게시판을 찾을 수 없습니다.');
      return;
    }

    const action = getSubmitAction();
    const nextPublishedAt = publishTimeMode === 'scheduled' ? getScheduledPublishedAtIsoString() : '';

    if (canEditPublishTime && publishTimeMode === 'scheduled' && !nextPublishedAt) {
      setErrorMessage('예약 날짜와 시간을 선택해주세요.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const uploadedEditorContent = await uploadEditorImagesIfNeeded();

      const editResponse = await fetch(`/api/boards/${boardName}/${contentId}/edit?siteName=${siteName}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          action,
          subject,
          summary,
          contentHtml: uploadedEditorContent.contentHtml,
          contentMarkdown: uploadedEditorContent.contentMarkdown,
          thumbnailImage: thumbnailImage || null,
          thumbnailWidth,
          thumbnailHeight,
          categories: selectedCategories,
          seriesKey: selectedSeriesKey || null,
          publishedAt: action === 'unknown' ? nextPublishedAt : null,
          isComment: commentProvider === 'none' ? false : isComment,
        }),
      });

      const editResult = (await editResponse.json()) as EditResponse;

      if (!editResponse.ok) {
        throw new Error(editResult.error ?? '블로그 글 수정에 실패했습니다.');
      }

      if (ti === 'i') router.replace(`/${siteName}/b/${contentId}`);
      else router.replace(`/${siteName}/manage/contents/posts/${contentId}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '블로그 글 수정에 실패했습니다.');
      } else {
        setErrorMessage('블로그 글 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/${contentId}`} menu="contents">
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

  if (!hasBoard) {
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/${contentId}`} menu="contents">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper paper-error ${styles.paper}`}>콘텐츠를 찾을 수 없습니다.</div>
            <Stack direction="row" justifyContent="space-between" gap={1} sx={{ p: 2 }}>
              <Anchor href={`/${siteName}/manage/contents/posts/c/${boardName}`} className="button medium cancel">
                목록
              </Anchor>
            </Stack>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/${contentId}`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {isMobile ? (
            <Typography variant="h5" component="h2" sx={{ p: 2 }}>
              글 수정
            </Typography>
          ) : null}

          <div className={`paper ${styles.paper}`}>
            <Stack component="form" gap={2.5} onSubmit={handleSubmit}>
              <Stack gap={1}>
                <Typography variant="subtitle2">제목 *</Typography>
                <TextField
                  placeholder="제목 (필수)"
                  value={subject}
                  onChange={handleSubjectChange}
                  fullWidth
                  size="small"
                />
              </Stack>
              <Stack gap={1}>
                <Typography variant="subtitle2">부제목</Typography>
                <TextField placeholder="부제목" value={summary} onChange={handleSummaryChange} fullWidth size="small" />
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">연재 선택</Typography>
                <FormControl fullWidth size="small">
                  <Select labelId="post-series-select-label" value={selectedSeriesKey} onChange={handleSeriesChange}>
                    <MenuItem value="">
                      <ListItemText primary="선택 안함" />
                    </MenuItem>
                    {seriesList
                      .filter((series) => !series.is_completed)
                      .map((series) => (
                        <MenuItem key={series.id} value={series.series_key}>
                          <ListItemText primary={series.series_label} />
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack gap={1}>
                <Typography variant="subtitle2">카테고리 선택</Typography>
                <FormControl fullWidth size="small">
                  <Select
                    labelId="post-category-select-label"
                    multiple
                    value={selectedCategories}
                    onChange={handleCategoryChange}
                    renderValue={(selected) =>
                      categories
                        .filter((category) => selected.includes(category.category_key))
                        .map((category) => category.category_label)
                        .join(', ')
                    }
                  >
                    {categories.map((category) => (
                      <MenuItem key={category.id} value={category.category_key}>
                        <Checkbox checked={selectedCategories.includes(category.category_key)} />
                        <ListItemText primary={category.category_label} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              <Stack direction="column">
                <Stack direction="row" gap={2} justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">오픈그래프 이미지</Typography>

                  <VisuallyHiddenInput
                    ref={fileInputReference}
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailFileChange}
                  />
                  <button
                    type="button"
                    className="button small action"
                    onClick={handleClickThumbnailUpload}
                    disabled={isUploadingThumbnail}
                  >
                    {thumbnailImageUrl ? '이미지 교체' : '이미지 추가'}
                  </button>
                  {thumbnailImageUrl ? (
                    <Box
                      component="img"
                      src={thumbnailImageUrl}
                      alt="오픈그래프 이미지"
                      sx={{ width: '100%', maxWidth: 480, display: 'block', mb: 1.5 }}
                    />
                  ) : null}
                </Stack>
              </Stack>
              <Stack gap={1}>
                <Typography sx={{ mb: 1 }}>내용 *</Typography>
                <ToastEditor
                  initialValue={contentHtml}
                  initialMarkdown={contentMarkdown}
                  initialEditType="wysiwyg"
                  themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                  markdownStatus="markdown_default"
                  hideModeSwitch
                  onHtmlChange={setContentHtml}
                  onMarkdownChange={setContentMarkdown}
                  onUploadImage={handleUploadEditorImage}
                />
              </Stack>

              {canEditPublishTime ? (
                <>
                  <Stack gap={1}>
                    <Typography variant="subtitle2">블로그 글 출간시간 선택 *</Typography>
                    <RadioGroup value={publishTimeMode} onChange={handlePublishTimeModeChange}>
                      <FormControlLabel value="now" control={<Radio />} label="현재 시각으로 등록하기" />
                      <FormControlLabel value="scheduled" control={<Radio />} label="지정한 날짜와 시간으로 예약" />
                    </RadioGroup>
                  </Stack>

                  {publishTimeMode === 'scheduled' ? (
                    <Stack gap={1}>
                      <Typography variant="subtitle2">날짜 및 시간 예약</Typography>
                      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                        <DateTimePicker
                          value={scheduledPublishedAt}
                          onChange={(nextValue) => setScheduledPublishedAt(nextValue)}
                          ampm={false}
                          slotProps={{
                            textField: {
                              fullWidth: true,
                              size: 'small',
                            },
                          }}
                        />
                      </LocalizationProvider>
                    </Stack>
                  ) : null}
                </>
              ) : null}

              {commentProvider !== 'none' ? (
                <FormControlLabel
                  control={<IOSSwitch sx={{ m: 1 }} checked={isComment} onChange={handleIsCommentChange} />}
                  label={isComment ? '댓글 열기' : '댓글 닫기'}
                />
              ) : null}

              <Stack direction="row" gap={1.5} justifyContent="space-between">
                <Anchor href={`/${siteName}/manage/contents/posts`} className="button medium cancel">
                  취소
                </Anchor>
                {isMobile ? (
                  <div className={styles['button-top']}>
                    <button type="submit" className={`button ${styles.button}`}>
                      저장
                    </button>
                  </div>
                ) : (
                  <button type="submit" className="button medium submit">
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
