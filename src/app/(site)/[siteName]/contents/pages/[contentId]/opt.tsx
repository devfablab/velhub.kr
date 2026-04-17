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
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';

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

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const [content, setContent] = useState<ContentRow | null>(null);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadContent() {
      try {
        const statusResponse = await fetch(`/api/pages/status?siteName=${siteName}`, {
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
    router.push(`/${siteName}/contents/pages/${contentId}/edit`);
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
        throw new Error(result.error ?? '페이지 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/pages`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '페이지 삭제에 실패했습니다.');
      } else {
        setErrorMessage('페이지 삭제에 실패했습니다.');
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
    return errorMessage ? (
      <Alert severity="error" variant="filled">
        {errorMessage}
      </Alert>
    ) : null;
  }

  return (
    <Stack spacing={2}>
      {isNotMobile && (
        <Typography variant="h5" component="h1">
          페이지 보기
        </Typography>
      )}
      <Paper elevation={0} sx={{ p: 3 }}>
        <Stack spacing={1.5}>
          <Stack spacing={0.5}>
            <Typography>페이지 식별자</Typography>
            <Typography>{content.slug}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>페이지 제목</Typography>
            <Typography>{content.subject}</Typography>
          </Stack>

          {content.summary && (
            <Stack spacing={0.5}>
              <Typography>페이지 부제목</Typography>
              <Typography>{content.summary}</Typography>
            </Stack>
          )}

          <Stack spacing={0.5}>
            <Typography>작성자</Typography>
            <Typography>{content.author_name}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>개설일자</Typography>
            <Typography>{formatDateTimeDetail(content.created_at)}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>수정일자</Typography>
            <Typography>{formatDateTimeDetail(content.edited_at)}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>댓글 쓰기 허용</Typography>
            <Typography>{content.is_comment ? '허용' : '불가'}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>오픈그래프 이미지</Typography>
            {profileImageUrl ? (
              <Box
                component="img"
                src={profileImageUrl}
                alt="오픈그래프 이미지"
                sx={{ width: '100%', maxWidth: 480, display: 'block' }}
              />
            ) : (
              <Typography />
            )}
          </Stack>

          <Stack spacing={0.5}>
            <Typography>첨부파일 원본 이름</Typography>
            <Typography>{content.attachment_origin ?? ''}</Typography>
          </Stack>

          <Stack spacing={0.5}>
            <Typography>페이지 내용</Typography>
            <Box
              dangerouslySetInnerHTML={{
                __html: content.content_html,
              }}
            />
          </Stack>
        </Stack>
      </Paper>

      <Stack direction="row" spacing={1.5}>
        <Button component={Link} href={`/${siteName}/contents/pages`} underline="none" variant="outlined">
          목록으로 이동
        </Button>

        <Button type="button" variant="contained" onClick={handleMoveToEdit} disabled={!boardName}>
          수정하기
        </Button>

        <Button type="button" color="error" variant="outlined" onClick={handleOpenDeleteDialog} disabled={!boardName}>
          삭제하기
        </Button>
      </Stack>

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      <Dialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog} fullWidth maxWidth="xs">
        <DialogTitle>페이지를 삭제합니다</DialogTitle>
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
