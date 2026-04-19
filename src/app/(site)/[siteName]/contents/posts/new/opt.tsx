'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import Link from '@mui/material/Link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  styled,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
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

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

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
  const [isStatusLoading, setIsStatusLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      try {
        setErrorMessage('');
        setIsStatusLoading(true);

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
        }),
      });

      const createResult = (await createResponse.json()) as CreateResponse;

      if (!createResponse.ok) {
        if (thumbnailImage && isSupabaseOgImageValue(thumbnailImage)) {
          await fetch('/api/attachment/delete/og-image', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              path: getSupabaseOgImagePath(thumbnailImage),
            }),
          });
        }

        throw new Error(createResult.error ?? '블로그 글 개설에 실패했습니다.');
      }

      if (!createResult.slug) {
        throw new Error('블로그 글 개설에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts/${createResult.slug}`);
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
      <Paper elevation={0} sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Alert severity="error" variant="filled">
            최초 글은 스텝만 작성 가능합니다
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
    <Paper elevation={0} sx={{ p: 3 }}>
      {isNotMobile && (
        <Typography variant="h4" component="h1" sx={{ mb: 2.5 }}>
          블로그 글쓰기
        </Typography>
      )}

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField label="제목 (필수)" value={subject} onChange={handleSubjectChange} fullWidth size="small" />
        <TextField label="부제목" value={summary} onChange={handleSummaryChange} fullWidth size="small" />

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
            href={`/${siteName}/contents/posts`}
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
