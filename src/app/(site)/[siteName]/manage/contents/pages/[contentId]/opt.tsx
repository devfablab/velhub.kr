'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
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
import Anchor from '@/components/Anchor';
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
  const isMobile = !isNotMobile;

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
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/pages`} menu="contents">
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

  if (!content) {
    return errorMessage ? (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/pages`} menu="contents">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div>
            <Stack direction="row" justifyContent="space-between" gap={1} sx={{ p: 2 }}>
              <Anchor href={`/${siteName}/manage/contents/posts/c/${boardName}`} className="button medium cancel">
                목록
              </Anchor>
            </Stack>
          </div>
        </div>
      </Container>
    ) : null;
  }

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/pages`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <div className={`paper ${styles.paper}`}>
            <Stack gap={1}>
              <Typography variant="h6" component="h3">
                {content.subject}
              </Typography>

              {content.summary ? <Typography variant="subtitle2">{content.summary}</Typography> : null}

              <Stack direction="row" gap={3} flexWrap="wrap">
                <Typography variant="subtitle2">
                  {content.author_name} / {formatDateTimeDetail(content.created_at)}
                </Typography>

                <Stack direction="row" gap={1}>
                  <Typography variant="subtitle2">수정</Typography>
                  <Typography variant="body2">{formatDateTimeDetail(content.edited_at)}</Typography>
                </Stack>
              </Stack>
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
                <Stack gap={1}>
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
          </div>

          <Stack direction="row" gap={1.5} justifyContent="space-between" sx={{ p: 2, pt: 0 }}>
            <Anchor href={`/${siteName}/manage/contents/pages`} className="button medium cancel">
              목록으로 이동
            </Anchor>

            <Stack direction="row" gap={1.5}>
              {content.is_closed ? (
                <button
                  type="button"
                  className="button medium action"
                  onClick={handleOpenRestoreDialog}
                  disabled={!boardName}
                >
                  복구
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="button medium danger"
                    onClick={handleOpenDeleteDialog}
                    disabled={!boardName}
                  >
                    삭제하기
                  </button>
                  <button
                    type="button"
                    className="button medium action"
                    onClick={handleMoveToEdit}
                    disabled={!boardName}
                  >
                    수정하기
                  </button>
                </>
              )}
            </Stack>
          </Stack>

          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isDeleteDialogOpen}
              onClose={handleCloseDeleteDialog}
              className="VhiDrawer-bottom"
            >
              <h2>페이지 삭제</h2>
              <button
                className="close-button"
                onClick={handleCloseDeleteDialog}
                aria-label="닫기"
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography>해당 페이지를 삭제하시겠습니까?</Typography>

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
                    disabled={isSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium warning"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
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
              maxWidth="xs"
              className="VhiDialog"
            >
              <DialogTitle>페이지 삭제</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseDeleteDialog}
                disabled={isSubmitting}
                aria-label="닫기"
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography>해당 페이지를 삭제하시겠습니까?</Typography>

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
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button type="button" className="button medium warning" onClick={handleDelete} disabled={isSubmitting}>
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
              <h2>페이지 복구</h2>
              <button
                className="close-button"
                onClick={handleCloseRestoreDialog}
                aria-label="닫기"
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography>해당 페이지를 복구하시겠습니까?</Typography>

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
                    onClick={handleCloseRestoreDialog}
                    disabled={isSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={handleRestore}
                    disabled={isSubmitting}
                  >
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
              <DialogTitle>페이지 복구</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseRestoreDialog}
                disabled={isSubmitting}
                aria-label="닫기"
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography>해당 페이지를 복구하시겠습니까?</Typography>

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
                  onClick={handleCloseRestoreDialog}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button type="button" className="button medium submit" onClick={handleRestore} disabled={isSubmitting}>
                  확인
                </button>
              </DialogActions>
            </Dialog>
          )}
        </div>
      </div>
    </Container>
  );
}
