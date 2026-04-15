'use client';

import { useRef, useState, type JSX } from 'react';
import Link from '@mui/material/Link';
import { useRouter } from 'next/navigation';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import ToastEditor from '@/components/editor/ToastEditor';

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

type Props = {
  siteName: string;
};

function isSupabaseOgImageValue(value: string) {
  return value.startsWith('supabase:');
}

function getSupabaseOgImagePath(value: string) {
  return value.replace('supabase:', '').trim();
}

export default function Opt({ siteName }: Props) {
  const router = useRouter();
  const fileInputReference = useRef<HTMLInputElement | null>(null);

  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [thumbnailImage, setThumbnailImage] = useState('');
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState('');
  const [thumbnailWidth, setThumbnailWidth] = useState<number | null>(null);
  const [thumbnailHeight, setThumbnailHeight] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);

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

    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
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

      const targetUrl =
        statusResult.hasBoard && statusResult.boardName
          ? `/api/boards/${statusResult.boardName}/new`
          : '/api/posts/new';

      const createResponse = await fetch(targetUrl, {
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

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
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

          <input
            ref={fileInputReference}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
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
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            저장
          </Button>

          <Button component={Link} href={`/${siteName}/contents/posts`} underline="none" variant="outlined">
            취소
          </Button>
        </Stack>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      </Stack>
    </Paper>
  );
}
