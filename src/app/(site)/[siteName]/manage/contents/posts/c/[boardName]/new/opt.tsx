'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from '@mui/material/Link';
import {
  Alert,
  Box,
  Button,
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

type CreateResponse = {
  ok?: boolean;
  slug?: string;
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

type PrefixRow = {
  id: string;
  created_at: string;
  prefix_key: number;
  prefix_label: string;
  board_id: string;
  site_id: string;
};

type BoardInfoResponse = {
  board?: {
    post_type: 'none' | 'prefix' | 'series';
  };
  error?: string;
};

type SeriesListResponse = {
  series?: SeriesRow[];
  error?: string;
};

type PrefixListResponse = {
  prefixes?: PrefixRow[];
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
  const boardName = normalizeText(params.boardName).toLowerCase();

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
  const [seriesList, setSeriesList] = useState<SeriesRow[]>([]);
  const [prefixList, setPrefixList] = useState<PrefixRow[]>([]);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState('');
  const [selectedPrefixId, setSelectedPrefixId] = useState('');
  const [postType, setPostType] = useState<'none' | 'prefix' | 'series'>('none');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadBoardData() {
      try {
        setErrorMessage('');

        const boardResponse = await fetch(`/api/boards/${boardName}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const boardResult = (await boardResponse.json()) as BoardInfoResponse;

        if (!boardResponse.ok) {
          throw new Error(boardResult.error ?? '게시판 정보를 불러오지 못했습니다.');
        }

        const nextPostType = boardResult.board?.post_type ?? 'none';
        setPostType(nextPostType);

        if (nextPostType === 'series') {
          const seriesResponse = await fetch(`/api/boards/${boardName}/series?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          });

          const seriesResult = (await seriesResponse.json()) as SeriesListResponse;

          if (!seriesResponse.ok) {
            throw new Error(seriesResult.error ?? '연재 목록을 불러오지 못했습니다.');
          }

          setSeriesList(Array.isArray(seriesResult.series) ? seriesResult.series : []);
        }

        if (nextPostType === 'prefix') {
          const prefixResponse = await fetch(`/api/boards/${boardName}/prefix?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          });

          const prefixResult = (await prefixResponse.json()) as PrefixListResponse;

          if (!prefixResponse.ok) {
            throw new Error(prefixResult.error ?? '말머리 목록을 불러오지 못했습니다.');
          }

          setPrefixList(Array.isArray(prefixResult.prefixes) ? prefixResult.prefixes : []);
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadBoardData();
  }, [boardName, siteName]);

  function handleSubjectChange(event: InputChangeEvent) {
    setSubject(event.currentTarget.value);
  }

  function handleSummaryChange(event: InputChangeEvent) {
    setSummary(event.currentTarget.value);
  }

  function handleSeriesChange(event: SelectChangeEvent<string>) {
    setSelectedSeriesKey(event.target.value);
  }

  function handlePrefixChange(event: SelectChangeEvent<string>) {
    setSelectedPrefixId(event.target.value);
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

    if (isSubmitting || isLoading) {
      return;
    }

    if (postType === 'prefix' && !selectedPrefixId) {
      setErrorMessage('말머리를 선택해주세요.');
      return;
    }

    if (postType === 'series' && !selectedSeriesKey) {
      setErrorMessage('연재를 선택해주세요.');
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/boards/${boardName}/new`, {
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
          seriesKey: selectedSeriesKey || null,
          prefixId: selectedPrefixId || null,
        }),
      });

      const result = (await response.json()) as CreateResponse;

      if (!response.ok) {
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

        throw new Error(result.error ?? '글 작성에 실패했습니다.');
      }

      if (!result.slug) {
        throw new Error('글 작성에 실패했습니다.');
      }

      router.replace(`/${siteName}/manage/contents/posts/c/${boardName}/${result.slug}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '글 작성에 실패했습니다.');
      } else {
        setErrorMessage('글 작성에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={2}>
      {isNotMobile && (
        <Typography variant="h5" component="h1">
          새 글 쓰기
        </Typography>
      )}

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField label="제목 (필수)" value={subject} onChange={handleSubjectChange} fullWidth size="small" />
        <TextField label="부제목" value={summary} onChange={handleSummaryChange} fullWidth size="small" />

        {postType === 'prefix' ? (
          <FormControl fullWidth size="small">
            <InputLabel id="community-post-prefix-select-label">말머리</InputLabel>
            <Select
              labelId="community-post-prefix-select-label"
              value={selectedPrefixId}
              onChange={handlePrefixChange}
              input={<OutlinedInput label="말머리" />}
            >
              {prefixList.map((prefix) => (
                <MenuItem key={prefix.id} value={prefix.id}>
                  <ListItemText primary={prefix.prefix_label} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : null}

        {postType === 'series' ? (
          <>
            <FormControl fullWidth size="small">
              <InputLabel id="community-post-series-select-label">연재</InputLabel>
              <Select
                labelId="community-post-series-select-label"
                value={selectedSeriesKey}
                onChange={handleSeriesChange}
                input={<OutlinedInput label="연재" />}
              >
                {seriesList
                  .filter((series) => !series.is_completed)
                  .map((series) => (
                    <MenuItem key={series.id} value={series.series_key}>
                      <ListItemText primary={series.series_label} />
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <Alert variant="outlined" severity="warning">
              연재는 한번 설정되면 변경하실 수 없습니다. 주의하세요.
            </Alert>
          </>
        ) : null}

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
            href={`/${siteName}/manage/contents/posts/c/${boardName}`}
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
