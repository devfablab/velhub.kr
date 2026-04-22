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

type CreateResponse = {
  ok?: boolean;
  slug?: string;
  error?: string;
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

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);

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
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

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
          contentHtml,
          contentMarkdown,
          thumbnailImage: thumbnailImage || null,
          thumbnailWidth,
          thumbnailHeight,
          categories: selectedCategories,
          seriesKey: selectedSeriesKey || null,
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

      router.replace(`/${siteName}/manage/contents/posts/${createResult.slug}`);
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
    return null;
  }

  if (!hasBoard) {
    return (
      <Stack spacing={2}>
        <Alert severity="error" variant="filled">
          최초 글은 스텝만 작성 가능합니다
        </Alert>

        <Box>
          <Button component={Link} href={`/${siteName}/manage/contents/posts`} underline="none" variant="outlined">
            목록으로 이동
          </Button>
        </Box>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {isNotMobile ? (
        <Typography variant="h5" component="h1">
          블로그 글쓰기
        </Typography>
      ) : null}

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField label="제목 (필수)" value={subject} onChange={handleSubjectChange} fullWidth size="small" />
        <TextField label="부제목" value={summary} onChange={handleSummaryChange} fullWidth size="small" />

        <FormControl fullWidth size="small">
          <InputLabel id="post-series-select-label">연재</InputLabel>
          <Select
            labelId="post-series-select-label"
            value={selectedSeriesKey}
            onChange={handleSeriesChange}
            input={<OutlinedInput label="연재" />}
          >
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
            href={`/${siteName}/manage/contents/posts`}
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
    </Stack>
  );
}
