'use client';

import { useEffect, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Drawer,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import type { SelectChangeEvent } from '@mui/material/Select';
import { formatDate, getOgImageUrl, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

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
    series_idx: number | null;
    board_id: string;
    site_id: string;
    user_id: string;
    thumbnail_image: string | null;
    thumbnail_width: number | null;
    thumbnail_height: number | null;
    author_name: string;
    is_closed: boolean;
  };
  categories?: CategoryRow[];
  series?: SeriesRow | null;
  isAuthor?: boolean;
  isStaff?: boolean;
  error?: string;
};

type CategoryListResponse = {
  categories?: CategoryRow[];
  error?: string;
};

type SeriesListResponse = {
  series?: SeriesRow[];
  error?: string;
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
  const isMobile = !isNotMobile;

  const [boardName, setBoardName] = useState('');
  const [post, setPost] = useState<PostResponse['content'] | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [series, setSeries] = useState<SeriesRow | null>(null);
  const [seriesList, setSeriesList] = useState<SeriesRow[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState('');
  const [isSeriesLocked, setIsSeriesLocked] = useState(false);
  const [isAuthor, setIsAuthor] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);
  const [isSeriesSubmitting, setIsSeriesSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSeriesDialogOpen, setIsSeriesDialogOpen] = useState(false);
  const [closedMessage, setClosedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');

  useEffect(() => {
    async function loadContent() {
      try {
        setErrorMessage('');

        const statusResponse = await fetch(`/api/manage/contents/blog-posts/status?siteName=${siteName}`, {
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

        const [contentResponse, categoryResponse, seriesResponse] = await Promise.all([
          fetch(`/api/boards/${statusResult.boardName}/${contentId}?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          }),
          fetch(`/api/boards/${statusResult.boardName}/category?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          }),
          fetch(`/api/boards/${statusResult.boardName}/series?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          }),
        ]);

        const contentResult = (await contentResponse.json()) as PostResponse;
        const categoryResult = (await categoryResponse.json()) as CategoryListResponse;
        const seriesResult = (await seriesResponse.json()) as SeriesListResponse;

        if (!contentResponse.ok) {
          throw new Error(contentResult.error ?? '블로그 글을 불러오지 못했습니다.');
        }

        if (!contentResult.content) {
          throw new Error('블로그 글을 불러오지 못했습니다.');
        }

        if (!categoryResponse.ok) {
          throw new Error(categoryResult.error ?? '카테고리 목록을 불러오지 못했습니다.');
        }

        if (!seriesResponse.ok) {
          throw new Error(seriesResult.error ?? '연재 목록을 불러오지 못했습니다.');
        }

        setPost(contentResult.content);
        setSeries(contentResult.series || null);
        setSeriesList(Array.isArray(seriesResult.series) ? seriesResult.series : []);
        setSelectedSeriesKey(contentResult.series?.series_key || '');
        setIsSeriesLocked(Boolean(contentResult.series?.series_key));
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

  function handleOpenSeriesDialog() {
    setDialogErrorMessage('');
    setIsSeriesDialogOpen(true);
  }

  function handleCloseSeriesDialog() {
    if (isSeriesSubmitting) {
      return;
    }

    setDialogErrorMessage('');
    setIsSeriesDialogOpen(false);
  }

  function handleCategoryChange(event: SelectChangeEvent<string[]>) {
    const value = event.target.value;
    setSelectedCategories(typeof value === 'string' ? value.split(',') : value);
  }

  function handleSeriesChange(event: SelectChangeEvent<string>) {
    if (isSeriesLocked) {
      return;
    }

    setSelectedSeriesKey(event.target.value);
  }

  function handleClosedMessageChange(event: InputChangeEvent) {
    setClosedMessage(event.currentTarget.value);
    setDialogErrorMessage('');
  }

  async function handleDelete() {
    if (!boardName) {
      return;
    }

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
        throw new Error(result.error ?? '블로그 글 삭제에 실패했습니다.');
      }

      router.replace(`/${siteName}/manage/contents/posts`);
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
          seriesKey: series?.series_key || null,
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

  async function handleSaveSeries() {
    if (!boardName || !post) {
      return;
    }

    try {
      setDialogErrorMessage('');
      setIsSeriesSubmitting(true);

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
          seriesKey: selectedSeriesKey || null,
        }),
      });

      const result = (await response.json()) as ActionResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '연재 설정 저장에 실패했습니다.');
      }

      const nextSeries = seriesList.find((seriesItem) => seriesItem.series_key === selectedSeriesKey) ?? null;

      setSeries(nextSeries);
      setIsSeriesLocked(Boolean(nextSeries?.series_key));
      setIsSeriesDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '연재 설정 저장에 실패했습니다.');
      } else {
        setDialogErrorMessage('연재 설정 저장에 실패했습니다.');
      }
    } finally {
      setIsSeriesSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts`} menu="contents">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          {post ? (
            <>
              <Stack direction="row" justifyContent="space-between" sx={{ p: 1 }}>
                <Stack direction="row" gap={1}>
                  {isAuthor || isStaff ? (
                    <button type="button" className="button small cancel" onClick={handleOpenCategoryDialog}>
                      카테고리 설정
                    </button>
                  ) : null}

                  {isAuthor || isStaff ? (
                    <button type="button" className="button small cancel" onClick={handleOpenSeriesDialog}>
                      연재 설정
                    </button>
                  ) : null}
                </Stack>

                {post.is_closed ? (
                  <button type="button" className="button small action" onClick={handleOpenRestoreDialog}>
                    복구
                  </button>
                ) : (
                  <button type="button" className="button small danger" onClick={handleOpenDeleteDialog}>
                    삭제
                  </button>
                )}
              </Stack>

              <div className={`paper ${styles.paper}`}>
                <Stack gap={1}>
                  <Typography variant="h6" component="h3">
                    {series ? `[${series.series_label}] ` : null}
                    {post.subject}
                  </Typography>

                  {post.summary ? <Typography variant="subtitle2">{post.summary}</Typography> : null}

                  <Typography variant="subtitle2">{post.author_name}</Typography>

                  <Stack direction="row" gap={3}>
                    <Stack direction="row" gap={1}>
                      <Typography variant="subtitle2">작성</Typography>
                      <Typography variant="body2">{formatDate(post.created_at)}</Typography>
                    </Stack>

                    {post.edited_at ? (
                      <Stack direction="row" gap={1}>
                        <Typography variant="subtitle2">수정</Typography>
                        <Typography variant="body2">{formatDate(post.edited_at)}</Typography>
                      </Stack>
                    ) : null}
                  </Stack>

                  {categories.filter((category) => selectedCategories.includes(category.category_key)).length > 0 ? (
                    <Stack direction="row" gap={1}>
                      <Typography variant="subtitle2">카테고리</Typography>
                      <Typography variant="body2">
                        {categories
                          .filter((category) => selectedCategories.includes(category.category_key))
                          .map((category) => category.category_label)
                          .join(', ')}
                      </Typography>
                    </Stack>
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

                  <Box sx={{ p: 3, pr: 0, pl: 0 }}>
                    <Box dangerouslySetInnerHTML={{ __html: post.content_html }} />
                  </Box>

                  <Stack direction="row" justifyContent="space-between">
                    <Anchor href={`/${siteName}/manage/contents/posts`} className="button medium cancel">
                      목록
                    </Anchor>

                    {!post.is_closed && isAuthor ? (
                      <>
                        {isMobile ? (
                          <div className={styles['button-top']}>
                            <Anchor
                              href={`/${siteName}/manage/contents/posts/${contentId}/edit`}
                              className={`button ${styles.button}`}
                            >
                              수정
                            </Anchor>
                          </div>
                        ) : (
                          <Anchor
                            href={`/${siteName}/manage/contents/posts/${contentId}/edit`}
                            className="button medium action"
                          >
                            수정
                          </Anchor>
                        )}
                      </>
                    ) : null}
                  </Stack>
                </Stack>
              </div>
            </>
          ) : null}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isDeleteDialogOpen}
              onClose={handleCloseDeleteDialog}
              className="VhiDrawer-bottom"
            >
              <h2>게시물 삭제</h2>
              <button
                className="close-button"
                onClick={handleCloseDeleteDialog}
                aria-label="닫기"
                disabled={isDeleting}
              >
                <CloseRoundedIcon />
              </button>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>
                      삭제시 언제든 복구가 가능합니다.
                      <br />
                      삭제사유를 입력해 주세요. (필수)
                    </span>
                  </p>

                  <TextField
                    placeholder="삭제 사유"
                    value={closedMessage}
                    onChange={handleClosedMessageChange}
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                  />

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>

                <Stack direction="column" spacing={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseDeleteDialog}
                    disabled={isDeleting}
                  >
                    취소
                  </button>
                  <button type="button" className="button medium warning" onClick={handleDelete} disabled={isDeleting}>
                    삭제
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={isDeleteDialogOpen}
              onClose={handleCloseDeleteDialog}
              fullWidth
              maxWidth="sm"
              className="VhiDialog"
            >
              <DialogTitle>게시물 삭제</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseDeleteDialog}
                aria-label="닫기"
                disabled={isDeleting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <p className="alert info">
                    <InfoOutlineRoundedIcon />
                    <span>
                      삭제시 언제든 복구가 가능합니다.
                      <br />
                      삭제사유를 입력해 주세요. (필수)
                    </span>
                  </p>

                  <TextField
                    placeholder="삭제 사유"
                    value={closedMessage}
                    onChange={handleClosedMessageChange}
                    fullWidth
                    multiline
                    minRows={3}
                    size="small"
                  />

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseDeleteDialog}
                  disabled={isDeleting}
                >
                  취소
                </button>
                <button type="button" className="button medium warning" onClick={handleDelete} disabled={isDeleting}>
                  삭제
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isRestoreDialogOpen}
              onClose={handleCloseRestoreDialog}
              className="VhiDrawer-bottom"
            >
              <h2>게시물 복구</h2>
              <button
                className="close-button"
                onClick={handleCloseRestoreDialog}
                aria-label="닫기"
                disabled={isRestoring}
              >
                <CloseRoundedIcon />
              </button>

              <Stack spacing={2} sx={{ pt: 1 }}>
                <Typography variant="body2">
                  해당 게시물을 복구하시겠습니까? 복구하시면 해당 게시물을 모두가 볼 수 있게 됩니다.
                </Typography>
                {dialogErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{dialogErrorMessage}</span>
                  </p>
                ) : null}
                <Stack direction="column" spacing={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseRestoreDialog}
                    disabled={isRestoring}
                  >
                    취소
                  </button>
                  <button type="button" className="button medium submit" onClick={handleRestore} disabled={isRestoring}>
                    확인
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={isRestoreDialogOpen}
              onClose={handleCloseRestoreDialog}
              fullWidth
              maxWidth="xs"
              className="VhiDialog"
            >
              <DialogTitle>게시물 복구</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseRestoreDialog}
                aria-label="닫기"
                disabled={isRestoring}
              >
                <CloseRoundedIcon />
              </button>

              <DialogContent>
                <Typography variant="body2">
                  해당 게시물을 복구하시겠습니까? 복구하시면 해당 게시물을 모두가 볼 수 있게 됩니다.
                </Typography>
                {dialogErrorMessage ? (
                  <p className="alert error">
                    <ErrorOutlineRoundedIcon />
                    <span>{dialogErrorMessage}</span>
                  </p>
                ) : null}
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseRestoreDialog}
                  disabled={isRestoring}
                >
                  취소
                </button>
                <button type="button" className="button medium submit" onClick={handleRestore} disabled={isRestoring}>
                  확인
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isCategoryDialogOpen}
              onClose={handleCloseCategoryDialog}
              className="VhiDrawer-bottom"
            >
              <h2>카테고리 설정</h2>
              <button
                className="close-button"
                onClick={handleCloseCategoryDialog}
                aria-label="닫기"
                disabled={isCategorySubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <FormControl fullWidth size="small">
                    <Select
                      labelId="detail-post-category-select-label"
                      multiple
                      value={selectedCategories}
                      onChange={handleCategoryChange}
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
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
                <Stack direction="column" spacing={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseCategoryDialog}
                    disabled={isCategorySubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={handleSaveCategories}
                    disabled={isCategorySubmitting}
                  >
                    저장
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={isCategoryDialogOpen}
              onClose={handleCloseCategoryDialog}
              fullWidth
              maxWidth="sm"
              className="VhiDialog"
            >
              <DialogTitle>카테고리 설정</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseCategoryDialog}
                aria-label="닫기"
                disabled={isCategorySubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <FormControl fullWidth size="small">
                    <Select
                      labelId="detail-post-category-select-label"
                      multiple
                      value={selectedCategories}
                      onChange={handleCategoryChange}
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
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseCategoryDialog}
                  disabled={isCategorySubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={handleSaveCategories}
                  disabled={isCategorySubmitting}
                >
                  저장
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isSeriesDialogOpen}
              onClose={handleCloseSeriesDialog}
              className="VhiDrawer-bottom"
            >
              <h2>연재 설정</h2>
              <button
                className="close-button"
                onClick={handleCloseSeriesDialog}
                aria-label="닫기"
                disabled={isSeriesSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <FormControl fullWidth size="small">
                    <Select
                      labelId="detail-post-series-select-label"
                      value={selectedSeriesKey}
                      onChange={handleSeriesChange}
                      disabled={isSeriesLocked}
                    >
                      <MenuItem value="">
                        <ListItemText primary="선택 안함" />
                      </MenuItem>

                      {seriesList
                        .filter((seriesItem) => !seriesItem.is_completed || seriesItem.series_key === selectedSeriesKey)
                        .map((seriesItem) => (
                          <MenuItem key={seriesItem.id} value={seriesItem.series_key}>
                            <ListItemText primary={seriesItem.series_label} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>

                  {isSeriesLocked ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>연재가 설정된 글은 연재를 변경할 수 없습니다.</span>
                    </p>
                  ) : null}

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
                <Stack direction="column" spacing={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseSeriesDialog}
                    disabled={isSeriesSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={handleSaveSeries}
                    disabled={isSeriesSubmitting}
                  >
                    저장
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={isSeriesDialogOpen}
              onClose={handleCloseSeriesDialog}
              fullWidth
              maxWidth="sm"
              className="VhiDialog"
            >
              <DialogTitle>연재 설정</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseSeriesDialog}
                aria-label="닫기"
                disabled={isSeriesSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <FormControl fullWidth size="small">
                    <Select
                      labelId="detail-post-series-select-label"
                      value={selectedSeriesKey}
                      onChange={handleSeriesChange}
                      disabled={isSeriesLocked}
                    >
                      <MenuItem value="">
                        <ListItemText primary="선택 안함" />
                      </MenuItem>

                      {seriesList
                        .filter((seriesItem) => !seriesItem.is_completed || seriesItem.series_key === selectedSeriesKey)
                        .map((seriesItem) => (
                          <MenuItem key={seriesItem.id} value={seriesItem.series_key}>
                            <ListItemText primary={seriesItem.series_label} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>

                  {isSeriesLocked ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>연재가 설정된 글은 연재를 변경할 수 없습니다.</span>
                    </p>
                  ) : null}

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseSeriesDialog}
                  disabled={isSeriesSubmitting}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={handleSaveSeries}
                  disabled={isSeriesSubmitting}
                >
                  저장
                </button>
              </DialogActions>
            </Dialog>
          )}
        </div>
      </div>
    </Container>
  );
}
