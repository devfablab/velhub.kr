'use client';

import { useEffect, useState } from 'react';
import Link from '@mui/material/Link';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

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
  is_closed?: boolean;
  closed_by: string | null;
  closed_at: string | null;
  closed_message: string | null;
  closed_by_name: string;
};

type ContentResponse = {
  content?: ContentRow | null;
};

type ActionResponse = {
  ok?: boolean;
  error?: string;
};

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));

  const [content, setContent] = useState<ContentRow | null>(null);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadContent() {
      try {
        setErrorMessage('');

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

        const contentResult = (await contentResponse.json()) as ContentResponse | { error?: string };

        if (!contentResponse.ok) {
          throw new Error(
            'error' in contentResult
              ? (contentResult.error ?? '페이지 정보를 불러오지 못했습니다.')
              : '페이지 정보를 불러오지 못했습니다.',
          );
        }

        if (!('content' in contentResult)) {
          throw new Error('페이지 정보를 불러오지 못했습니다.');
        }

        setContent(contentResult.content ?? null);
        setProfileImageUrl(contentResult.content?.og_image_url ?? '');
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

  function handleMoveToEdit() {
    router.push(`/${siteName}/manage/contents/pages/${contentId}/edit`);
  }

  function handleOpenDeleteDialog() {
    setIsDeleteDialogOpen(true);
    setDialogErrorMessage('');
  }

  function handleCloseDeleteDialog() {
    if (isSubmitting) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setDialogErrorMessage('');
  }

  function handleOpenRestoreDialog() {
    setIsRestoreDialogOpen(true);
    setDialogErrorMessage('');
  }

  function handleCloseRestoreDialog() {
    if (isSubmitting) {
      return;
    }

    setIsRestoreDialogOpen(false);
    setDialogErrorMessage('');
  }

  async function handleDelete() {
    if (!boardName || !content || isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setDialogErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch(`/api/boards/${boardName}/${contentId}/delete?siteName=${siteName}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'close',
        }),
      });

      const result = (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '페이지 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/manage/contents/pages`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '페이지 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('페이지 삭제에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestore() {
    if (!boardName || !content || isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setDialogErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch(`/api/boards/${boardName}/${contentId}/delete?siteName=${siteName}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'restore',
        }),
      });

      const result = (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '페이지 복구에 실패했습니다.');
      }

      router.replace(`/${siteName}/manage/contents/pages`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '페이지 복구에 실패했습니다.');
      } else {
        setDialogErrorMessage('페이지 복구에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  if (!content) {
    return errorMessage ? (
      <Alert severity="error" variant="filled">
        {errorMessage}
      </Alert>
    ) : null;
  }

  return (
    <Container pageTitle="페이지 보기" pageBack={`/${siteName}/manage/contents/pages`} menu="contents">
      <div className="container">
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Paper variant="outlined" sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Typography variant="h5" component="h2">
                {content.subject}
              </Typography>

              {content.summary ? (
                <Typography variant="h6" component="h3">
                  {content.summary}
                </Typography>
              ) : null}

              <Stack direction="row" gap={3} flexWrap="wrap">
                <Stack direction="row" gap={1}>
                  <Typography variant="subtitle2">작성</Typography>
                  <Typography variant="body2">
                    {content.author_name} / {formatDateTimeDetail(content.created_at)}
                  </Typography>
                </Stack>

                <Stack direction="row" gap={1}>
                  <Typography variant="subtitle2">수정</Typography>
                  <Typography variant="body2">{formatDateTimeDetail(content.edited_at)}</Typography>
                </Stack>
              </Stack>
              <Divider />
              {content.is_closed ? (
                <>
                  <Stack gap={1}>
                    <Stack direction="row" gap={1}>
                      <Typography variant="subtitle2">삭제 정보</Typography>
                      <Typography variant="body2">
                        {content.closed_by_name || ''} /{' '}
                        {content.closed_at ? formatDateTimeDetail(content.closed_at) : ''}
                      </Typography>
                    </Stack>
                    <Stack>
                      <Typography variant="subtitle2">삭제 사유</Typography>
                      <Typography component="p" sx={{ whiteSpace: 'pre-wrap' }}>
                        {content.closed_message || ''}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Divider />
                </>
              ) : null}

              {profileImageUrl ? (
                <Stack spacing={1}>
                  <Typography variant="subtitle2">오픈그래프 이미지</Typography>
                  <Box
                    component="img"
                    src={profileImageUrl}
                    alt="오픈그래프 이미지"
                    sx={{ width: '100%', maxWidth: 480, display: 'block' }}
                  />
                </Stack>
              ) : null}

              <div style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: content.content_html }} />
            </Stack>
          </Paper>

          <Stack direction="row" spacing={1.5} justifyContent="space-between">
            <Button component={Link} href={`/${siteName}/manage/contents/pages`} underline="none" variant="outlined">
              목록으로 이동
            </Button>

            <Stack direction="row" spacing={1.5}>
              {content.is_closed ? (
                <Button type="button" variant="outlined" onClick={handleOpenRestoreDialog} disabled={!boardName}>
                  복구
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    color="error"
                    variant="outlined"
                    onClick={handleOpenDeleteDialog}
                    disabled={!boardName}
                  >
                    삭제하기
                  </Button>
                  <Button
                    type="button"
                    variant="contained"
                    color="warning"
                    onClick={handleMoveToEdit}
                    disabled={!boardName}
                  >
                    수정하기
                  </Button>
                </>
              )}
            </Stack>
          </Stack>

          {errorMessage ? (
            <Alert severity="error" variant="filled">
              {errorMessage}
            </Alert>
          ) : null}

          <Dialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog} fullWidth maxWidth="xs">
            <DialogTitle>페이지 삭제</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Typography>해당 페이지를 삭제하시겠습니까?</Typography>

                {dialogErrorMessage ? (
                  <Alert severity="error" variant="filled">
                    {dialogErrorMessage}
                  </Alert>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={handleCloseDeleteDialog} disabled={isSubmitting}>
                취소
              </Button>
              <Button type="button" color="error" variant="contained" onClick={handleDelete} disabled={isSubmitting}>
                삭제
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={isRestoreDialogOpen} onClose={handleCloseRestoreDialog} fullWidth maxWidth="xs">
            <DialogTitle>페이지 복구</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Typography>해당 페이지를 복구하시겠습니까?</Typography>

                {dialogErrorMessage ? (
                  <Alert severity="error" variant="filled">
                    {dialogErrorMessage}
                  </Alert>
                ) : null}
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button type="button" onClick={handleCloseRestoreDialog} disabled={isSubmitting}>
                취소
              </Button>
              <Button type="button" variant="contained" color="warning" onClick={handleRestore} disabled={isSubmitting}>
                확인
              </Button>
            </DialogActions>
          </Dialog>
        </div>
      </div>
    </Container>
  );
}
