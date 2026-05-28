'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Button,
  Checkbox,
  FormControl,
  FormControlLabel,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  styled,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ToastEditor from '@/components/editor/ToastEditor';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Anchor from '@/components/Anchor';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type CommentProvider = 'none' | 'giscus' | 'disqus' | 'velhub';

type StatusResponse = {
  hasBoard: boolean;
  boardName: string | null;
  commentProvider: CommentProvider;
  markdown_status: string | null;
};

type CreateResponse = {
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

type CategoryListResponse = {
  categories?: CategoryRow[];
  error?: string;
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

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const siteName = normalizeText(params.siteName);
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
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [commentProvider, setCommentProvider] = useState<CommentProvider>('none');
  const [isComment, setIsComment] = useState(false);

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
    async function loadStatus() {
      try {
        setErrorMessage('');
        setIsStatusLoading(true);

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
        setIsComment(statusResult.commentProvider !== 'none');

        if (statusResult.hasBoard && statusResult.boardName) {
          const [categoryResponse, seriesResponse] = await Promise.all([
            fetch(`/api/boards/${statusResult.boardName}/category?siteName=${siteName}`, {
              method: 'GET',
              credentials: 'include',
            }),
            fetch(`/api/boards/${statusResult.boardName}/series?siteName=${siteName}`, {
              method: 'GET',
              credentials: 'include',
            }),
          ]);

          const categoryResult = (await categoryResponse.json()) as CategoryListResponse;
          const seriesResult = (await seriesResponse.json()) as SeriesListResponse;

          if (!categoryResponse.ok) {
            throw new Error(categoryResult.error ?? '카테고리 목록을 불러오지 못했습니다.');
          }

          if (!seriesResponse.ok) {
            throw new Error(seriesResult.error ?? '연재 목록을 불러오지 못했습니다.');
          }

          setCategories(Array.isArray(categoryResult.categories) ? categoryResult.categories : []);
          setSeriesList(Array.isArray(seriesResult.series) ? seriesResult.series : []);
        } else {
          setCategories([]);
          setSeriesList([]);
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '블로그 상태를 확인하지 못했습니다.');
        } else {
          setErrorMessage('블로그 상태를 확인하지 못했습니다.');
        }
      } finally {
        setIsStatusLoading(false);
      }
    }

    void loadStatus();
  }, [siteName]);

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

      const response = await fetch('/api/attachment/add/og-image', {
        method: 'POST',
        credentials: 'include',
        body: (() => {
          const formData = new FormData();
          formData.append('file', selectedFile);
          return formData;
        })(),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '썸네일 이미지 업로드에 실패했습니다.');
      }

      setThumbnailImage(typeof result.ogImage === 'string' ? result.ogImage : '');
      setThumbnailImageUrl(typeof result.url === 'string' ? result.url : '');
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

    if (isSubmitting || isStatusLoading) {
      return;
    }

    if (!hasBoard || !boardName) {
      setErrorMessage('최초 글은 스텝만 작성 가능합니다');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const uploadedEditorContent = await uploadEditorImagesIfNeeded();

      const createResponse = await fetch(`/api/boards/${boardName}/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          subject,
          summary,
          contentHtml: uploadedEditorContent.contentHtml,
          contentMarkdown: uploadedEditorContent.contentMarkdown,
          thumbnailImage: thumbnailImage || null,
          thumbnailWidth,
          thumbnailHeight,
          categories: selectedCategories,
          seriesKey: selectedSeriesKey || null,
          isComment: commentProvider === 'none' ? false : isComment,
        }),
      });

      const createResult = (await createResponse.json()) as CreateResponse;

      if (!createResponse.ok) {
        if (thumbnailImage) {
          await fetch('/api/attachment/delete/og-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              path: thumbnailImage,
            }),
          });
        }

        throw new Error(createResult.error ?? '블로그 글 개설에 실패했습니다.');
      }

      if (!createResult.slug) {
        throw new Error('블로그 글 개설에 실패했습니다.');
      }

      if (ti === 'i') router.replace(`/${siteName}/b/${createResult.slug}`);
      else router.replace(`/${siteName}/manage/contents/posts/${createResult.slug}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '블로그 글 개설에 실패했습니다.');
      } else {
        setErrorMessage('블로그 글 개설에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isStatusLoading) {
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts`} menu="contents">
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
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts`} menu="contents">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper paper-error ${styles.paper}`}>최초 글은 스텝만 작성 가능합니다</div>
            <Box>
              <Anchor href={`/${siteName}/manage/contents/posts`} className="button medium action">
                목록으로 이동
              </Anchor>
            </Box>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {isMobile ? (
            <Typography variant="h5" component="h2" sx={{ p: 2 }}>
              글쓰기
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
