'use client';

import { useEffect, useState, type JSX } from 'react';
import Link from '@mui/material/Link';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Button, Paper, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import ToastEditor from '@/components/editor/ToastEditor';
import { normalizeText } from '@/lib/utils';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

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

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const [slug, setSlug] = useState('');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadContent() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/boards/${boardName}/${contentId}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as ContentResponse | { error?: string };

        if (!response.ok) {
          throw new Error(
            'error' in result ? result.error || '글을 불러오지 못했습니다.' : '글을 불러오지 못했습니다.',
          );
        }

        if (!('content' in result) || !result.content) {
          throw new Error('글을 불러오지 못했습니다.');
        }

        if (!result.isAuthor) {
          throw new Error('접근 권한이 없습니다.');
        }

        setSlug(result.content.slug);
        setSubject(result.content.subject ?? '');
        setSummary(result.content.summary ?? '');
        setContentHtml(result.content.content_html ?? '');
        setContentMarkdown(result.content.content_markdown ?? '');
        setIsClosed(Boolean(result.content.is_closed));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '글을 불러오지 못했습니다.');
        } else {
          setErrorMessage('글을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadContent();
  }, [boardName, contentId, siteName]);

  function handleSubjectChange(event: InputChangeEvent) {
    setSubject(event.currentTarget.value);
  }

  function handleSummaryChange(event: InputChangeEvent) {
    setSummary(event.currentTarget.value);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

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
          isClosed,
        }),
      });

      const result = (await response.json()) as EditResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '글 수정에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts/c/${boardName}/${slug}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '글 수정에 실패했습니다.');
      } else {
        setErrorMessage('글 수정에 실패했습니다.');
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
          글 수정
        </Typography>
      )}

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <TextField label="제목 (필수)" value={subject} onChange={handleSubjectChange} fullWidth size="small" />
        <TextField label="부제목" value={summary} onChange={handleSummaryChange} fullWidth size="small" />

        <Stack spacing={1}>
          <Typography>내용 (필수)</Typography>
          <ToastEditor
            initialValue={contentHtml}
            initialMarkdown={contentMarkdown}
            initialEditType="markdown"
            onHtmlChange={setContentHtml}
            onMarkdownChange={setContentMarkdown}
          />
        </Stack>

        <Stack direction="row" spacing={1.5}>
          <Button
            component={Link}
            href={`/${siteName}/contents/posts/c/${boardName}/${contentId}`}
            size="large"
            underline="none"
            variant="outlined"
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
