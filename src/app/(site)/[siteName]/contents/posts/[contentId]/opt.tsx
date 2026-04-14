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
import { formatDateTimeFull } from '@/lib/utils';

type ContentRow = {
  id: string;
  user_id: string;
  slug: string;
  content_html: string;
  content_markdown: string | null;
  subject: string;
  summary: string | null;
  edited_at: string;
  thumbnail_image: string | null;
  thumbnail_image_url: string | null;
  thumbnail_width: number | null;
  thumbnail_height: number | null;
  idx: number;
  board_id: string;
  site_id: string;
  created_at: string;
  author_name: string;
};

type Props = {
  siteName: string;
  contentId: string;
};

export default function Opt({ siteName, contentId }: Props) {
  const router = useRouter();

  const [content, setContent] = useState<ContentRow | null>(null);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadContent() {
      try {
        const statusResponse = await fetch(`/api/posts/status?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const statusResult = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(statusResult.error ?? '블로그 상태를 확인하지 못했습니다.');
        }

        if (!statusResult.hasBoard || !statusResult.boardName) {
          throw new Error('블로그 게시판을 찾을 수 없습니다.');
        }

        setBoardName(statusResult.boardName);

        const contentResponse = await fetch(`/api/boards/${statusResult.boardName}/${contentId}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const contentResult = await contentResponse.json();

        if (!contentResponse.ok) {
          throw new Error(contentResult.error ?? '블로그 글 정보를 불러오지 못했습니다.');
        }

        setContent(contentResult.content ?? null);
        setThumbnailImageUrl(contentResult.content?.thumbnail_image_url ?? '');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '블로그 글 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('블로그 글 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadContent();
  }, [contentId, siteName]);

  function handleMoveToEdit() {
    router.push(`/${siteName}/contents/posts/${contentId}/edit`);
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

  async function handleDelete() {
    if (!boardName || isDeleting) {
      return;
    }

    setErrorMessage('');
    setIsDeleting(true);

    try {
      const response = await fetch(`/api/boards/${boardName}/${contentId}/delete?siteName=${siteName}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '블로그 글 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '블로그 글 삭제에 실패했습니다.');
      } else {
        setErrorMessage('블로그 글 삭제에 실패했습니다.');
      }
    } finally {
      setIsDeleting(false);
      setIsDeleteDialogOpen(false);
    }
  }

  if (isLoading) {
    return null;
  }

  if (!content) {
    return errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null;
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography>제목</Typography>
            <Typography>{content.subject}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>부제목</Typography>
            <Typography>{content.summary ?? ''}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>작성자</Typography>
            <Typography>{content.author_name}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>개설일자</Typography>
            <Typography>{formatDateTimeFull(content.created_at)}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>수정일자</Typography>
            <Typography>{formatDateTimeFull(content.edited_at)}</Typography>
          </Stack>

          {thumbnailImageUrl && (
            <Stack spacing={0.5}>
              <Typography>오픈그래프 이미지</Typography>
              <Box
                component="img"
                src={thumbnailImageUrl}
                alt="오픈그래프 이미지"
                sx={{ width: '100%', maxWidth: 480, display: 'block' }}
              />
            </Stack>
          )}

          <Stack spacing={0.5}>
            <Typography>내용</Typography>
            <Box
              dangerouslySetInnerHTML={{
                __html: content.content_html,
              }}
            />
          </Stack>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1.5}>
        <Button component={Link} href={`/${siteName}/contents/posts`} underline="none" variant="outlined">
          목록으로 이동
        </Button>

        <Button type="button" variant="contained" onClick={handleMoveToEdit} disabled={!boardName}>
          수정하기
        </Button>

        <Button type="button" color="error" variant="outlined" onClick={handleOpenDeleteDialog} disabled={!boardName}>
          삭제하기
        </Button>
      </Stack>

      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Dialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog} fullWidth maxWidth="xs">
        <DialogTitle>블로그 글을 삭제합니다</DialogTitle>
        <DialogContent>
          <Typography>삭제 후 되돌릴 수 없습니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            취소
          </Button>
          <Button type="button" color="error" variant="contained" onClick={handleDelete} disabled={isDeleting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
