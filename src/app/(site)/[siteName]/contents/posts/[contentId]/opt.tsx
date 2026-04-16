'use client';

import { useEffect, useState } from 'react';
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
import { formatDate, normalizeText } from '@/lib/utils';

type StatusResponse = {
  hasBoard: boolean;
  boardName: string | null;
};

type PostResponse = {
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

type DeleteResponse = {
  ok?: boolean;
  error?: string;
};

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const [boardName, setBoardName] = useState('');
  const [post, setPost] = useState<PostResponse['content'] | null>(null);
  const [isAuthor, setIsAuthor] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isStatusSubmitting, setIsStatusSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

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

        const contentResult = (await contentResponse.json()) as PostResponse | { error?: string };

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

        setPost(contentResult.content);
        setIsAuthor(Boolean(contentResult.isAuthor));
        setIsStaff(Boolean(contentResult.isStaff));
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

  function handleMoveToEdit() {
    router.push(`/${siteName}/contents/posts/${contentId}/edit`);
  }

  function handleMoveToList() {
    router.push(`/${siteName}/contents/posts`);
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
    if (!boardName) {
      return;
    }

    try {
      setErrorMessage('');
      setIsDeleting(true);

      const response = await fetch(`/api/boards/${boardName}/${contentId}/delete?siteName=${siteName}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = (await response.json()) as DeleteResponse;

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

  async function handleToggleClosed() {
    if (!boardName || !post) {
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
          isClosed: !post.is_closed,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '공개 상태 변경에 실패했습니다.');
      }

      setPost((previousPost) =>
        previousPost
          ? {
              ...previousPost,
              is_closed: !previousPost.is_closed,
            }
          : previousPost,
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

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Stack spacing={3}>
        {isNotMobile && (
          <Typography variant="h4" component="h1">
            블로그 글 보기
          </Typography>
        )}

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

        {post ? (
          <Paper elevation={0} sx={{ p: 3 }}>
            <Stack spacing={2.5}>
              <Box>
                <Typography variant="body2">제목</Typography>
                <Typography>{post.subject}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">부제목</Typography>
                <Typography>{post.summary || '-'}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">작성일</Typography>
                <Typography>{formatDate(post.created_at)}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">수정일</Typography>
                <Typography>{formatDate(post.edited_at)}</Typography>
              </Box>

              <Box>
                <Typography variant="body2">작성자</Typography>
                <Typography>{post.author_name}</Typography>
              </Box>

              {post.thumbnail_image ? (
                <Box>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    오픈그래프 이미지
                  </Typography>
                  <Box
                    component="img"
                    src={post.thumbnail_image}
                    alt="오픈그래프 이미지"
                    sx={{ width: '100%', maxWidth: 480, display: 'block' }}
                  />
                </Box>
              ) : null}

              <Box>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  내용
                </Typography>
                <Box dangerouslySetInnerHTML={{ __html: post.content_html }} />
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
                    {post.is_closed ? '공개 전환' : '비공개 전환'}
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </Paper>
        ) : null}
      </Stack>

      <Dialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog}>
        <DialogTitle>블로그 글 삭제</DialogTitle>
        <DialogContent>
          <Typography>이 블로그 글을 삭제하시겠습니까?</Typography>
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
