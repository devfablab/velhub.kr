'use client';

import { useEffect, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  ListItemText,
  OutlinedInput,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { formatDate, normalizeText } from '@/lib/utils';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type StatusResponse = {
  hasBoard: boolean;
  boardName: string | null;
};

type CategoryRow = {
  id: string;
  category_key: string;
  category_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  sort_order: number;
  board_id: string;
  site_id: string;
  created_at?: string;
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
    is_closed: boolean;
    categories?: string[] | null;
  };
  categories?: CategoryRow[];
  isAuthor?: boolean;
  isStaff?: boolean;
  error?: string;
};

type CategoryListResponse = {
  categories?: CategoryRow[];
  error?: string;
};

type ActionResponse = {
  ok?: boolean;
  error?: string;
};

function isSupabaseOgImageValue(value: string) {
  return value.startsWith('supabase:');
}

function getSupabaseOgImagePath(value: string) {
  return value.replace('supabase:', '').trim();
}

function getOgImageUrl(value: string) {
  if (!isSupabaseOgImageValue(value)) {
    return value;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const imagePath = getSupabaseOgImagePath(value);

  if (!supabaseUrl || !imagePath) {
    return '';
  }

  return `${supabaseUrl}/storage/v1/object/public/og-image/${imagePath}`;
}

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

  const [boardName, setBoardName] = useState('');
  const [post, setPost] = useState<PostResponse['content'] | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isAuthor, setIsAuthor] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [closedMessage, setClosedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');

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

        const [contentResponse, categoryResponse] = await Promise.all([
          fetch(`/api/boards/${statusResult.boardName}/${contentId}?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          }),
          fetch(`/api/boards/${statusResult.boardName}/category?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          }),
        ]);

        const contentResult = (await contentResponse.json()) as PostResponse;
        const categoryResult = (await categoryResponse.json()) as CategoryListResponse;

        if (!contentResponse.ok) {
          throw new Error(contentResult.error ?? '블로그 글을 불러오지 못했습니다.');
        }

        if (!contentResult.content) {
          throw new Error('블로그 글을 불러오지 못했습니다.');
        }

        if (!categoryResponse.ok) {
          throw new Error(categoryResult.error ?? '카테고리 목록을 불러오지 못했습니다.');
        }

        setPost(contentResult.content);
        setIsAuthor(Boolean(contentResult.isAuthor));
        setIsStaff(Boolean(contentResult.isStaff));
        setCategories(Array.isArray(categoryResult.categories) ? categoryResult.categories : []);
        setSelectedCategories(
          Array.isArray(contentResult.categories)
            ? contentResult.categories.map((category) => category.category_key)
            : [],
        );
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
    setClosedMessage('');
    setDialogErrorMessage('');
    setIsDeleteDialogOpen(true);
  }

  function handleCloseDeleteDialog() {
    if (isDeleting) {
      return;
    }

    setIsDeleteDialogOpen(false);
    setClosedMessage('');
    setDialogErrorMessage('');
  }

  function handleOpenRestoreDialog() {
    setDialogErrorMessage('');
    setIsRestoreDialogOpen(true);
  }

  function handleCloseRestoreDialog() {
    if (isRestoring) {
      return;
    }

    setIsRestoreDialogOpen(false);
    setDialogErrorMessage('');
  }

  function handleOpenCategoryDialog() {
    setDialogErrorMessage('');
    setIsCategoryDialogOpen(true);
  }

  function handleCloseCategoryDialog() {
    if (isCategorySubmitting) {
      return;
    }

    setDialogErrorMessage('');
    setIsCategoryDialogOpen(false);
  }

  function handleCategoryChange(event: SelectChangeEvent<string[]>) {
    const value = event.target.value;
    setSelectedCategories(typeof value === 'string' ? value.split(',') : value);
  }

  function handleClosedMessageChange(event: InputChangeEvent) {
    setClosedMessage(event.currentTarget.value);
    setDialogErrorMessage('');
  }

  async function handleDelete() {
    if (!boardName) {
      return;
    }

    if (isStaff && closedMessage.trim().length < 10) {
      setDialogErrorMessage('삭제 사유를 10자 이상 입력해주세요.');
      return;
    }

    try {
      setErrorMessage('');
      setDialogErrorMessage('');
      setIsDeleting(true);

      const response = await fetch(`/api/boards/${boardName}/${contentId}/delete?siteName=${siteName}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'close',
          closedMessage: closedMessage.trim() || null,
        }),
      });

      const result = (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '블로그 글 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '블로그 글 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('블로그 글 삭제에 실패했습니다.');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRestore() {
    if (!boardName) {
      return;
    }

    try {
      setErrorMessage('');
      setDialogErrorMessage('');
      setIsRestoring(true);

      const response = await fetch(`/api/boards/${boardName}/${contentId}/delete?siteName=${siteName}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'restore',
        }),
      });

      const result = (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '블로그 글 복구에 실패했습니다.');
      }

      setPost((previousPost) =>
        previousPost
          ? {
              ...previousPost,
              is_closed: false,
            }
          : previousPost,
      );
      setIsRestoreDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '블로그 글 복구에 실패했습니다.');
      } else {
        setDialogErrorMessage('블로그 글 복구에 실패했습니다.');
      }
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleSaveCategories() {
    if (!boardName || !post) {
      return;
    }

    try {
      setDialogErrorMessage('');
      setIsCategorySubmitting(true);

      const response = await fetch(`/api/boards/${boardName}/${contentId}/edit?siteName=${siteName}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          subject: post.subject,
          summary: post.summary,
          contentHtml: post.content_html,
          contentMarkdown: post.content_markdown,
          thumbnailImage: post.thumbnail_image,
          thumbnailWidth: post.thumbnail_width,
          thumbnailHeight: post.thumbnail_height,
          categories: selectedCategories,
        }),
      });

      const result = (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '카테고리 저장에 실패했습니다.');
      }

      setIsCategoryDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '카테고리 저장에 실패했습니다.');
      } else {
        setDialogErrorMessage('카테고리 저장에 실패했습니다.');
      }
    } finally {
      setIsCategorySubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={3}>
      {isNotMobile && (
        <Typography variant="h5" component="h1">
          블로그 글 보기
        </Typography>
      )}

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      {post ? (
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="subtitle2">제목</Typography>
            <Typography variant="body2">{post.subject}</Typography>
          </Box>

          {post.summary ? (
            <Box>
              <Typography variant="subtitle2">부제목</Typography>
              <Typography variant="body2">{post.summary}</Typography>
            </Box>
          ) : null}

          <Box>
            <Typography variant="subtitle2">작성일</Typography>
            <Typography variant="body2">{formatDate(post.created_at)}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">수정일</Typography>
            <Typography variant="body2">{formatDate(post.edited_at)}</Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2">작성자</Typography>
            <Typography variant="body2">{post.author_name}</Typography>
          </Box>

          {categories.filter((category) => selectedCategories.includes(category.category_key)).length > 0 ? (
            <Box>
              <Typography variant="subtitle2">카테고리</Typography>
              <Typography variant="body2">
                {categories
                  .filter((category) => selectedCategories.includes(category.category_key))
                  .map((category) => category.category_label)
                  .join(', ')}
              </Typography>
            </Box>
          ) : null}

          {post.thumbnail_image ? (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                오픈그래프 이미지
              </Typography>
              <Box
                component="img"
                src={getOgImageUrl(post.thumbnail_image)}
                alt="오픈그래프 이미지"
                sx={{ width: '100%', maxWidth: 480, display: 'block' }}
              />
            </Box>
          ) : null}

          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              내용
            </Typography>
            <Box dangerouslySetInnerHTML={{ __html: post.content_html }} />
          </Box>

          <Stack direction="row" spacing={1.5} justifyContent="space-between">
            <Stack direction="row" gap={1}>
              <Button type="button" variant="outlined" color="primary" size="large" onClick={handleMoveToList}>
                목록
              </Button>

              {isAuthor || isStaff ? (
                <Button
                  type="button"
                  variant="outlined"
                  color="inherit"
                  size="large"
                  onClick={handleOpenCategoryDialog}
                >
                  카테고리 설정
                </Button>
              ) : null}
            </Stack>

            {!post.is_closed && isAuthor ? (
              <Button type="button" variant="contained" color="primary" size="large" onClick={handleMoveToEdit}>
                수정
              </Button>
            ) : null}

            {post.is_closed ? (
              <Button type="button" variant="outlined" size="large" color="warning" onClick={handleOpenRestoreDialog}>
                복구
              </Button>
            ) : (
              <Button type="button" color="error" variant="outlined" size="large" onClick={handleOpenDeleteDialog}>
                삭제
              </Button>
            )}
          </Stack>
        </Stack>
      ) : null}
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
          <Button type="button" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            취소
          </Button>
          <Button type="button" variant="contained" color="primary" onClick={handleDelete} disabled={isDeleting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isRestoreDialogOpen} onClose={handleCloseRestoreDialog} fullWidth maxWidth="xs">
        <DialogTitle>게시물 복구</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            해당 게시물을 복구하시겠습니까?
            <br />
            복구하시면 해당 게시물을 모두가 볼 수 있게 됩니다.
          </Typography>
          {dialogErrorMessage ? (
            <Alert severity="error" variant="filled" sx={{ mt: 2 }}>
              {dialogErrorMessage}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseRestoreDialog} disabled={isRestoring}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={handleRestore} disabled={isRestoring}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isCategoryDialogOpen} onClose={handleCloseCategoryDialog} fullWidth maxWidth="sm">
        <DialogTitle>카테고리 설정</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="detail-post-category-select-label">카테고리</InputLabel>
              <Select
                labelId="detail-post-category-select-label"
                multiple
                size="small"
                value={selectedCategories}
                onChange={handleCategoryChange}
                input={<OutlinedInput label="카테고리" />}
                renderValue={(selected) =>
                  categories
                    .filter((category) => selected.includes(category.category_key))
                    .map((category) => category.category_label)
                    .join(', ')
                }
              >
                {categories.map((category) => (
                  <MenuItem key={category.id} value={category.category_key}>
                    <Checkbox checked={selectedCategories.includes(category.category_key)} />
                    <ListItemText primary={category.category_label} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {dialogErrorMessage ? (
              <Alert severity="error" variant="filled">
                {dialogErrorMessage}
              </Alert>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button type="button" onClick={handleCloseCategoryDialog} disabled={isCategorySubmitting}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={handleSaveCategories} disabled={isCategorySubmitting}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
