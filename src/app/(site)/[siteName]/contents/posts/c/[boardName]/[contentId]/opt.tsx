'use client';

import { useEffect, useState } from 'react';
import Link from '@mui/material/Link';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { formatDate } from '@/lib/utils';

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

type ToggleResponse = {
  ok?: boolean;
  error?: string;
};

type DeleteResponse = {
  ok?: boolean;
  error?: string;
};

type Props = {
  siteName: string;
  boardName: string;
  contentId: string;
};

export default function Opt({ siteName, boardName, contentId }: Props) {
  const router = useRouter();

  const [content, setContent] = useState<ContentResponse['content'] | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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
        setIsAuthor(Boolean(result.isAuthor));
        setIsStaff(Boolean(result.isStaff));
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

  function handleMoveToEdit() {
    router.push(`/${siteName}/contents/posts/c/${boardName}/${contentId}/edit`);
  }

  function handleOpenDeleteDialog() {
    setIsDeleteDialogOpen(true);
  }

  function handleCloseDeleteDialog() {
    if (isDeleting) {
      return;
    }

    setIsDeleteDialogOpen(false);
  }

  async function handleToggleClosed() {
    if (!content) {
      return;
    }

    try {
      setErrorMessage('');
      setIsStatusSubmitting(true);

      const response = await fetch(`/api/boards/${boardName}/${contentId}/edit?siteName=${siteName}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          isClosed: !content.is_closed,
        }),
      });

      const result = (await response.json()) as ToggleResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '공개 상태 변경에 실패했습니다.');
      }

      setContent((previousContent) =>
        previousContent
          ? {
              ...previousContent,
              is_closed: !previousContent.is_closed,
            }
          : previousContent,
      );
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '공개 상태 변경에 실패했습니다.');
      } else {
        setErrorMessage('공개 상태 변경에 실패했습니다.');
      }
    } finally {
      setIsStatusSubmitting(false);
    }
  }

  async function handleDelete() {
    try {
      setErrorMessage('');
      setIsDeleting(true);

      const response = await fetch(`/api/boards/${boardName}/${contentId}/delete?siteName=${siteName}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = (await response.json()) as DeleteResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '글 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts/c/${boardName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '글 삭제에 실패했습니다.');
      } else {
        setErrorMessage('글 삭제에 실패했습니다.');
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Stack spacing={3}>
        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

        {content ? (
          <Paper elevation={0} sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="body2">제목</Typography>
                <Typography>{content.subject}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">부제목</Typography>
                <Typography>{content.summary || '-'}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">작성일</Typography>
                <Typography>{formatDate(content.created_at)}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">수정일</Typography>
                <Typography>{formatDate(content.edited_at)}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">작성자</Typography>
                <Typography>{content.author_name}</Typography>
              </Box>

              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  내용
                </Typography>
                <Box dangerouslySetInnerHTML={{ __html: content.content_html }} />
              </Box>

              <Stack direction="row" spacing={1.5}>
                <Button type="button" variant="outlined" onClick={handleMoveToList}>
                  목록
                </Button>

                {isAuthor ? (
                  <Button type="button" variant="contained" onClick={handleMoveToEdit}>
                    수정
                  </Button>
                ) : null}

                {isAuthor ? (
                  <Button type="button" color="error" variant="outlined" onClick={handleOpenDeleteDialog}>
                    삭제
                  </Button>
                ) : null}

                {isAuthor || isStaff ? (
                  <Button type="button" variant="outlined" onClick={handleToggleClosed} disabled={isStatusSubmitting}>
                    {content.is_closed ? '공개 전환' : '비공개 전환'}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </Paper>
        ) : null}
      </Stack>

      <Dialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>글 삭제</DialogTitle>
        <DialogContent>
          <Typography>이 글을 삭제하시겠습니까?</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            취소
          </Button>
          <Button type="button" color="error" variant="contained" onClick={handleDelete} disabled={isDeleting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
