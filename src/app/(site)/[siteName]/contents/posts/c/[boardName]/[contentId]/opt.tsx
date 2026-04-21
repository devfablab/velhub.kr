'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
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

type SeriesRow = {
  id: string;
  created_at: string;
  series_key: string;
  series_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  board_id: string;
  site_id: string;
  last_published_at: string | null;
  is_completed: boolean;
  user_id: string | null;
};

type PrefixRow = {
  id: string;
  created_at: string;
  prefix_key: number;
  prefix_label: string;
  board_id: string;
  site_id: string;
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
    prefix_id: string | null;
    prefix_label: string | null;
  };
  board?: {
    post_type: 'none' | 'prefix' | 'series';
  };
  series?: SeriesRow | null;
  isAuthor?: boolean;
  isStaff?: boolean;
  error?: string;
};

type PrefixListResponse = {
  prefixes?: PrefixRow[];
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
  const boardName = normalizeText(params.boardName).toLowerCase();
  const contentId = normalizeText(params.contentId);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

  const [post, setPost] = useState<PostResponse['content'] | null>(null);
  const [series, setSeries] = useState<SeriesRow | null>(null);
  const [prefixes, setPrefixes] = useState<PrefixRow[]>([]);
  const [selectedPrefixId, setSelectedPrefixId] = useState('');
  const [postType, setPostType] = useState<'none' | 'prefix' | 'series'>('none');
  const [isAuthor, setIsAuthor] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isChangingPrefix, setIsChangingPrefix] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isPrefixDialogOpen, setIsPrefixDialogOpen] = useState(false);
  const [closedMessage, setClosedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');

  const selectedPrefixLabel = useMemo(() => {
    if (!selectedPrefixId) {
      return '';
    }

    return prefixes.find((prefix) => prefix.id === selectedPrefixId)?.prefix_label ?? '';
  }, [prefixes, selectedPrefixId]);

  useEffect(() => {
    async function loadContent() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/boards/${boardName}/${contentId}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as PostResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '글을 불러오지 못했습니다.');
        }

        if (!result.content) {
          throw new Error('글을 불러오지 못했습니다.');
        }

        setPost(result.content);
        setSeries(result.series || null);
        setPostType(result.board?.post_type ?? 'none');
        setSelectedPrefixId(result.content.prefix_id ?? '');
        setIsAuthor(Boolean(result.isAuthor));
        setIsStaff(Boolean(result.isStaff));

        if ((result.board?.post_type ?? 'none') === 'prefix') {
          const prefixResponse = await fetch(`/api/boards/${boardName}/prefix?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          });

          const prefixResult = (await prefixResponse.json()) as PrefixListResponse;

          if (!prefixResponse.ok) {
            throw new Error(prefixResult.error ?? '말머리 목록을 불러오지 못했습니다.');
          }

          setPrefixes(Array.isArray(prefixResult.prefixes) ? prefixResult.prefixes : []);
        }
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

  function handleMoveToEdit() {
    router.push(`/${siteName}/contents/posts/c/${boardName}/${contentId}/edit`);
  }

  function handleMoveToList() {
    router.push(`/${siteName}/contents/posts/c/${boardName}`);
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

  function handleOpenPrefixDialog() {
    setDialogErrorMessage('');
    setSelectedPrefixId(post?.prefix_id ?? '');
    setIsPrefixDialogOpen(true);
  }

  function handleClosePrefixDialog() {
    if (isChangingPrefix) {
      return;
    }

    setDialogErrorMessage('');
    setIsPrefixDialogOpen(false);
  }

  function handleClosedMessageChange(event: InputChangeEvent) {
    setClosedMessage(event.currentTarget.value);
    setDialogErrorMessage('');
  }

  function handlePrefixChange(event: SelectChangeEvent<string>) {
    setSelectedPrefixId(event.target.value);
    setDialogErrorMessage('');
  }

  async function handleDelete() {
    if (closedMessage.trim().length < 10) {
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
          closedMessage: closedMessage.trim(),
        }),
      });

      const result = (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '글 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/contents/posts/c/${boardName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '글 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('글 삭제에 실패했습니다.');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleRestore() {
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
        throw new Error(result.error ?? '글 복구에 실패했습니다.');
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
        setDialogErrorMessage(unknownError.message || '글 복구에 실패했습니다.');
      } else {
        setDialogErrorMessage('글 복구에 실패했습니다.');
      }
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleChangePrefix() {
    if (!post) {
      return;
    }

    if (!selectedPrefixId) {
      setDialogErrorMessage('말머리를 선택해주세요.');
      return;
    }

    try {
      setDialogErrorMessage('');
      setIsChangingPrefix(true);

      const response = await fetch(`/api/boards/${boardName}/${contentId}/edit?siteName=${siteName}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          subject: post.subject,
          summary: post.summary,
          contentHtml: post.content_html,
          contentMarkdown: post.content_markdown,
          prefixId: selectedPrefixId,
        }),
      });

      const result = (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '말머리 변경에 실패했습니다.');
      }

      setPost((previousPost) =>
        previousPost
          ? {
              ...previousPost,
              prefix_id: selectedPrefixId,
              prefix_label: selectedPrefixLabel || null,
            }
          : previousPost,
      );
      setIsPrefixDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '말머리 변경에 실패했습니다.');
      } else {
        setDialogErrorMessage('말머리 변경에 실패했습니다.');
      }
    } finally {
      setIsChangingPrefix(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={3}>
      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      {post ? (
        <Stack spacing={2.5}>
          <Box>
            <Typography variant="h5" component="h1">
              {post.prefix_label ? <Box component="span">[{post.prefix_label}] </Box> : null}
              <Box component="span">{post.subject}</Box>
            </Typography>
            {post.summary && (
              <Typography variant="h6" component="h2">
                {post.summary}
              </Typography>
            )}
          </Box>

          {series ? (
            <Box>
              <Typography variant="subtitle2" component="p">
                {series.series_label}
              </Typography>
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

          <Stack direction="row" spacing={1.5}>
            <Button type="button" variant="outlined" onClick={handleMoveToList}>
              목록
            </Button>

            {!post.is_closed && isAuthor ? (
              <Button type="button" variant="contained" onClick={handleMoveToEdit}>
                수정
              </Button>
            ) : null}

            {!post.is_closed && postType === 'prefix' && (isAuthor || isStaff) ? (
              <Button type="button" variant="outlined" onClick={handleOpenPrefixDialog}>
                말머리 변경
              </Button>
            ) : null}

            {post.is_closed ? (
              <Button type="button" variant="outlined" onClick={handleOpenRestoreDialog}>
                복구
              </Button>
            ) : isAuthor || isStaff ? (
              <Button type="button" color="error" variant="outlined" onClick={handleOpenDeleteDialog}>
                삭제
              </Button>
            ) : null}
          </Stack>
        </Stack>
      ) : null}

      <Dialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog} fullWidth maxWidth="sm">
        <DialogTitle>게시물 삭제</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Alert severity="info" variant="outlined">
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
          <Button
            type="button"
            variant="outlined"
            color="inherit"
            onClick={handleCloseDeleteDialog}
            disabled={isDeleting}
          >
            취소
          </Button>
          <Button type="button" variant="contained" color="error" onClick={handleDelete} disabled={isDeleting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isRestoreDialogOpen} onClose={handleCloseRestoreDialog} fullWidth maxWidth="xs">
        <DialogTitle>게시물 복구</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            해당 게시물을 복구하시겠습니까? 복구하시면 해당 게시물을 모두가 볼 수 있게 됩니다.
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
          <Button type="button" variant="contained" color="warning" onClick={handleRestore} disabled={isRestoring}>
            확인
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isPrefixDialogOpen} onClose={handleClosePrefixDialog} fullWidth maxWidth="xs">
        <DialogTitle>말머리 변경</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth size="small">
              <Select value={selectedPrefixId} onChange={handlePrefixChange} displayEmpty>
                <MenuItem value="" disabled>
                  말머리를 선택해주세요.
                </MenuItem>
                {prefixes.map((prefix) => (
                  <MenuItem key={prefix.id} value={prefix.id}>
                    {prefix.prefix_label}
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
          <Button type="button" onClick={handleClosePrefixDialog} disabled={isChangingPrefix}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={handleChangePrefix} disabled={isChangingPrefix}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
