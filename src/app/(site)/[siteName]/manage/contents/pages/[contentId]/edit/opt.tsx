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
  Paper,
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

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

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
  const isMobile = !isNotMobile;

  const fileInputReference = useRef<HTMLInputElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [slug, setSlug] = useState('');
  const [initialSlug, setInitialSlug] = useState('');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
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
      if (ogImage && isSupabaseOgImageValue(ogImage)) {
        await fetch('/api/attachment/delete/og-image/page', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: getSupabaseOgImagePath(ogImage),
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
          contentHtml,
          contentMarkdown,
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
    return null;
  }

  return (
    <Paper elevation={0} sx={{ p: 3, pl: 0, pr: 0 }}>
      {isNotMobile && (
        <Typography variant="h4" component="h1" sx={{ mb: 2.5 }}>
          페이지 수정
        </Typography>
      )}

      <Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
        <Stack spacing={1}>
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
          {slugMessage ? <Alert severity={isSlugAvailable ? 'success' : 'error'}>{slugMessage}</Alert> : null}
        </Stack>

        <TextField label="페이지 제목 (필수)" value={subject} onChange={handleSubjectChange} fullWidth size="small" />
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
          />
        </Box>

        <Stack direction="row" spacing={1.5} justifyContent="flex-end">
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
    </Paper>
  );
}
