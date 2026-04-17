'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from '@mui/material/Link';
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

type ContentResponse = {
  content: {
    id: string;
    slug: string;
    subject: string;
    summary: string | null;
    content_html: string;
    content_markdown: string | null;
    edited_at: string;
    created_at: string;
    idx: number;
    board_id: string;
    site_id: string;
    user_id: string;
    thumbnail_image: string | null;
    thumbnail_width: number | null;
    thumbnail_height: number | null;
    author_name: string;
    is_closed?: boolean;
  };
  isAuthor?: boolean;
  isStaff?: boolean;
};

type EditResponse = {
  ok?: boolean;
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
  const fileInputReference = useRef<HTMLInputElement | null>(null);
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const [boardName, setBoardName] = useState('');
  const [slug, setSlug] = useState('');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [thumbnailImage, setThumbnailImage] = useState('');
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState('');
  const [thumbnailWidth, setThumbnailWidth] = useState<number | null>(null);
  const [thumbnailHeight, setThumbnailHeight] = useState<number | null>(null);
  const [originalThumbnailImage, setOriginalThumbnailImage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

  useEffect(() => {
    async function loadContent() {
      try {
        setErrorMessage('');

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

        if (
          !('hasBoard' in statusResult) ||
          !('boardName' in statusResult) ||
          !statusResult.hasBoard ||
          !statusResult.boardName
        ) {
          throw new Error('블로그 상태를 확인하지 못했습니다.');
        }

        setBoardName(statusResult.boardName);

        const contentResponse = await fetch(`/api/boards/${statusResult.boardName}/${contentId}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const contentResult = (await contentResponse.json()) as ContentResponse | { error?: string };

        if (!contentResponse.ok) {
          throw new Error(
            'error' in contentResult
              ? contentResult.error || '블로그 글을 불러오지 못했습니다.'
              : '블로그 글을 불러오지 못했습니다.',
          );
        }

        if (!('content' in contentResult) || !contentResult.content) {
          throw new Error('블로그 글을 불러오지 못했습니다.');
        }

        if (!contentResult.isAuthor) {
          throw new Error('접근 권한이 없습니다.');
        }

        setSlug(contentResult.content.slug);
        setSubject(contentResult.content.subject ?? '');
        setSummary(contentResult.content.summary ?? '');
        setContentHtml(contentResult.content.content_html ?? '');
        setContentMarkdown(contentResult.content.content_markdown ?? '');
        setThumbnailImage(contentResult.content.thumbnail_image ?? '');
        setThumbnailImageUrl(contentResult.content.thumbnail_image ?? '');
        setThumbnailWidth(contentResult.content.thumbnail_width ?? null);
        setThumbnailHeight(contentResult.content.thumbnail_height ?? null);
        setOriginalThumbnailImage(contentResult.content.thumbnail_image ?? '');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '블로그 글을 불러오지 못했습니다.');
        } else {
          setErrorMessage('블로그 글을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadContent();
  }, [contentId, siteName]);

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

  async function handleRemoveThumbnail() {
    if (isUploadingThumbnail) {
      return;
    }

    setThumbnailImage('');
    setThumbnailImageUrl('');
    setThumbnailWidth(null);
    setThumbnailHeight(null);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting || !boardName) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/boards/${boardName}/${contentId}/edit?siteName=${siteName}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          subject,
          summary,
          contentHtml,
          contentMarkdown,
          thumbnailImage: thumbnailImage || null,
          thumbnailWidth,
          thumbnailHeight,
        }),
      });

      const result = (await response.json()) as EditResponse;

      if (!response.ok) {
        if (thumbnailImage && thumbnailImage !== originalThumbnailImage && isSupabaseOgImageValue(thumbnailImage)) {
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

        throw new Error(result.error ?? '블로그 글 수정에 실패했습니다.');
      }

      if (
        originalThumbnailImage &&
        originalThumbnailImage !== thumbnailImage &&
        isSupabaseOgImageValue(originalThumbnailImage)
      ) {
        await fetch('/api/attachment/delete/og-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: getSupabaseOgImagePath(originalThumbnailImage),
          }),
        });
      }

      router.replace(`/${siteName}/contents/posts/${slug}`);
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

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      {isNotMobile && (
        <Typography variant="h4" component="h1" sx={{ mb: 2.5 }}>
          블로그 글 수정
        </Typography>
      )}

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField label="제목 (필수)" value={subject} onChange={handleSubjectChange} fullWidth />
        <TextField label="부제목" value={summary} onChange={handleSummaryChange} fullWidth />

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

          <Stack direction="row" spacing={1.5}>
            <Button
              type="button"
              variant="outlined"
              onClick={handleClickThumbnailUpload}
              disabled={isUploadingThumbnail}
            >
              {thumbnailImageUrl ? '이미지 교체' : '이미지 추가'}
            </Button>

            {thumbnailImageUrl ? (
              <Button type="button" variant="outlined" color="error" onClick={handleRemoveThumbnail}>
                이미지 삭제
              </Button>
            ) : null}
          </Stack>
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
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            저장
          </Button>

          <Button
            component={Link}
            href={`/${siteName}/contents/posts/${contentId}`}
            underline="none"
            variant="outlined"
          >
            취소
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
