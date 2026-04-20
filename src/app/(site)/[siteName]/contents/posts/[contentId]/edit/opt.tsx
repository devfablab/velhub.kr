'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import Link from '@mui/material/Link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  styled,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import ToastEditor from '@/components/editor/ToastEditor';
import { normalizeText } from '@/lib/utils';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type StatusResponse = {
  hasBoard: boolean;
  boardName: string | null;
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
    id: string;
    slug: string;
    subject: string;
    summary: string | null;
    content_html: string;
    content_markdown: string | null;
    thumbnail_image: string | null;
    thumbnail_width: number | null;
    thumbnail_height: number | null;
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

type CategoryListResponse = {
  categories?: CategoryRow[];
  error?: string;
};

type SeriesListResponse = {
  series?: SeriesRow[];
  error?: string;
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

function isSupabaseOgImageValue(value: string) {
  return value.startsWith('supabase:');
}

function getSupabaseOgImagePath(value: string) {
  return value.replace('supabase:', '').trim();
}

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

  const fileInputReference = useRef<HTMLInputElement | null>(null);

  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
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

  useEffect(() => {
    async function loadData() {
      try {
        setErrorMessage('');
        setIsLoading(true);

        const statusResponse = await fetch(`/api/posts/status?siteName=${siteName}`, {
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
          throw new Error(seriesResult.error ?? '시리즈 목록을 불러오지 못했습니다.');
        }

        setSubject(contentResult.content.subject);
        setSummary(contentResult.content.summary || '');
        setContentHtml(contentResult.content.content_html);
        setContentMarkdown(contentResult.content.content_markdown || '');
        setThumbnailImage(contentResult.content.thumbnail_image || '');
        setThumbnailWidth(contentResult.content.thumbnail_width ?? null);
        setThumbnailHeight(contentResult.content.thumbnail_height ?? null);
        setSelectedCategories(
          Array.isArray(contentResult.categories)
            ? contentResult.categories.map((category) => category.category_key)
            : [],
        );
        setCategories(Array.isArray(categoryResult.categories) ? categoryResult.categories : []);
        setSeriesList(Array.isArray(seriesResult.series) ? seriesResult.series : []);
        setSelectedSeriesKey(contentResult.series?.series_key || '');
        setIsSeriesLocked(Boolean(contentResult.series?.series_key));

        if (contentResult.content.thumbnail_image && isSupabaseOgImageValue(contentResult.content.thumbnail_image)) {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
          const imagePath = getSupabaseOgImagePath(contentResult.content.thumbnail_image);

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

      if (previousThumbnailImage && isSupabaseOgImageValue(previousThumbnailImage)) {
        await fetch('/api/attachment/delete/og-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: getSupabaseOgImagePath(previousThumbnailImage),
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

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting || isLoading) {
      return;
    }

    if (!hasBoard || !boardName) {
      setErrorMessage('블로그 게시판을 찾을 수 없습니다.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const editResponse = await fetch(`/api/boards/${boardName}/${contentId}/edit`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          subject,
          summary,
          contentHtml,
          contentMarkdown,
          thumbnailImage: thumbnailImage || null,
          thumbnailWidth,
          thumbnailHeight,
          categories: selectedCategories,
          seriesKey: selectedSeriesKey || null,
        }),
      });

      const editResult = (await editResponse.json()) as EditResponse;

      if (!editResponse.ok) {
        throw new Error(editResult.error ?? '블로그 글 수정에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts/${contentId}`);
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
    return null;
  }

  if (!hasBoard) {
    return (
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Alert severity="error" variant="filled">
            블로그 게시판을 찾을 수 없습니다.
          </Alert>

          <Box>
            <Button component={Link} href={`/${siteName}/contents/posts`} underline="none" variant="outlined">
              목록으로 이동
            </Button>
          </Box>
        </Stack>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      {isNotMobile ? (
        <Typography variant="h4" component="h1" sx={{ mb: 2.5 }}>
          블로그 글 수정
        </Typography>
      ) : null}

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField label="제목 (필수)" value={subject} onChange={handleSubjectChange} fullWidth size="small" />
        <TextField label="부제목" value={summary} onChange={handleSummaryChange} fullWidth size="small" />

        <FormControl fullWidth size="small">
          <InputLabel id="post-series-select-label">시리즈</InputLabel>
          <Select
            labelId="post-series-select-label"
            value={selectedSeriesKey}
            onChange={handleSeriesChange}
            input={<OutlinedInput label="시리즈" />}
            disabled={isSeriesLocked}
          >
            <MenuItem value="">
              <ListItemText primary="선택 안함" />
            </MenuItem>
            {seriesList
              .filter((series) => !series.is_completed || series.series_key === selectedSeriesKey)
              .map((series) => (
                <MenuItem key={series.id} value={series.series_key}>
                  <ListItemText primary={series.series_label} />
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {isSeriesLocked ? (
          <Alert severity="info" variant="outlined">
            시리즈가 설정된 글은 시리즈를 변경할 수 없습니다.
          </Alert>
        ) : null}

        <FormControl fullWidth size="small">
          <InputLabel id="post-category-select-label">카테고리</InputLabel>
          <Select
            labelId="post-category-select-label"
            multiple
            value={selectedCategories}
            onChange={handleCategoryChange}
            input={<OutlinedInput label="카테고리" />}
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

        <Box>
          <Typography sx={{ mb: 1 }}>오픈그래프 이미지</Typography>

          {thumbnailImageUrl ? (
            <Box
              component="img"
              src={thumbnailImageUrl}
              alt="오픈그래프 이미지"
              sx={{ width: '100%', maxWidth: 480, display: 'block', mb: 1.5 }}
            />
          ) : null}

          <VisuallyHiddenInput
            ref={fileInputReference}
            type="file"
            accept="image/*"
            onChange={handleThumbnailFileChange}
          />

          <Button type="button" variant="outlined" onClick={handleClickThumbnailUpload} disabled={isUploadingThumbnail}>
            {thumbnailImageUrl ? '이미지 교체' : '이미지 추가'}
          </Button>
        </Box>

        <Box>
          <Typography sx={{ mb: 1 }}>내용 (필수)</Typography>
          <ToastEditor
            initialValue={contentHtml}
            initialMarkdown={contentMarkdown}
            initialEditType="markdown"
            onHtmlChange={setContentHtml}
            onMarkdownChange={setContentMarkdown}
          />
        </Box>

        <Stack direction="row" spacing={1.5}>
          <Button
            component={Link}
            href={`/${siteName}/contents/posts/${contentId}`}
            underline="none"
            variant="outlined"
            size="large"
          >
            취소
          </Button>
          <Button type="submit" variant="contained" disabled={isSubmitting} size="large">
            저장
          </Button>
        </Stack>

        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}
      </Stack>
    </Paper>
  );
}
