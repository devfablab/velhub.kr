'use client';

import { useEffect, useState, type JSX } from 'react';
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
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDate, formatDateTimeDetail, normalizeText } from '@/lib/utils';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

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
    closed_by: string | null;
    closed_at: string | null;
    closed_message: string | null;
    closed_by_name: string;
  };
  isAuthor?: boolean;
  isStaff?: boolean;
};

type ActionResponse = {
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

  const [content, setContent] = useState<ContentResponse['content'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [closedMessage, setClosedMessage] = useState('');
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

        setContent(result.content);
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

  function handleMoveToList() {
    router.push(`/${siteName}/contents/posts/c/${boardName}`);
  }

  function handleOpenDeleteDialog() {
    setIsDeleteDialogOpen(true);
    setClosedMessage('');
    setDialogErrorMessage('');
  }

  function handleCloseDeleteDialog() {
    if (isSubmitting) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setClosedMessage('');
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

  function handleClosedMessageChange(event: InputChangeEvent) {
    setClosedMessage(event.currentTarget.value);
    setDialogErrorMessage('');
  }

  async function handleDelete() {
    if (!content) {
      return;
    }

    if (closedMessage.trim().length < 10) {
      setDialogErrorMessage('삭제 사유를 10자 이상 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setDialogErrorMessage('');
      setErrorMessage('');

      const response = await fetch(`/api/boards/${boardName}/${contentId}/delete?siteName=${siteName}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'close',
          closedMessage: closedMessage.trim(),
        }),
      });

      const result = (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '게시물 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts/c/${boardName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '게시물 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('게시물 삭제에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestore() {
    if (!content) {
      return;
    }

    try {
      setIsSubmitting(true);
      setDialogErrorMessage('');
      setErrorMessage('');

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
        throw new Error(result.error ?? '게시물 복구에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts/c/${boardName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '게시물 복구에 실패했습니다.');
      } else {
        setDialogErrorMessage('게시물 복구에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Stack spacing={3}>
        {isNotMobile && (
          <Typography variant="h4" component="h1" sx={{ mb: 2.5 }}>
            글 보기
          </Typography>
        )}

        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}

        {content ? (
          <Paper elevation={0} sx={{ p: 3, pr: 0, pl: 0 }}>
            <Stack spacing={2.5}>
              <Typography variant="h5" component="h2">
                {content.subject}
              </Typography>

              {content.summary ? (
                <Box>
                  <Typography variant="h6" component="h3">
                    {content.summary}
                  </Typography>
                </Box>
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

              <div style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: content.content_html }} />

              <Stack direction="row" spacing={1.5} justifyContent="space-between">
                <Button type="button" variant="contained" onClick={handleMoveToList}>
                  목록
                </Button>

                {content.is_closed ? (
                  <Button type="button" variant="outlined" color="warning" onClick={handleOpenRestoreDialog}>
                    복구
                  </Button>
                ) : (
                  <Button type="button" color="error" variant="outlined" onClick={handleOpenDeleteDialog}>
                    삭제
                  </Button>
                )}
              </Stack>
            </Stack>
          </Paper>
        ) : null}
      </Stack>

      <Dialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog} fullWidth maxWidth="sm">
        <DialogTitle>게시물 삭제</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info" variant="filled">
              삭제시 언제든 복구가 가능합니다.
              <br />
              삭제사유를 입력해 주세요. (필수)
            </Alert>

            <TextField
              label="삭제 사유"
              value={closedMessage}
              onChange={handleClosedMessageChange}
              fullWidth
              multiline
              minRows={3}
              size="small"
            />

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
          <Button type="button" variant="contained" color="primary" onClick={handleDelete} disabled={isSubmitting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isRestoreDialogOpen} onClose={handleCloseRestoreDialog} fullWidth maxWidth="xs">
        <DialogTitle>게시물 복구</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography>해당 게시물을 복구하시겠습니까? 복구하시면 해당 게시물을 모두가 볼 수 있게 됩니다</Typography>

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
          <Button type="button" variant="contained" color="primary" onClick={handleRestore} disabled={isSubmitting}>
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
