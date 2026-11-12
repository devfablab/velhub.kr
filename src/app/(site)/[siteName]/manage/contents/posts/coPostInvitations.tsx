'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import MenuItem from '@/components/SelectMenuItem';
import Select from '@/components/SelectWithCheck';
import styles from '@/app/manage.module.sass';

type CoPostItem = {
  id: string;
  role: 'inviter' | 'partner';
  status: 'invited' | 'active';
  createdAt: string;
  post: { subject: string; slug: string; publishedStatus: string; publishedAt: string | null } | null;
  other: { siteKey: string; siteLabel: string; ownerName: string };
};

export type CoPostListResponse = {
  boardName?: string | null;
  coPosts?: CoPostItem[];
  error?: string;
};

type CategoryRow = { id: string; category_label: string };
type SeriesRow = { id: string; series_label: string };

type AcceptState = {
  coPost: CoPostItem;
  categories: CategoryRow[];
  series: SeriesRow[];
  categoryIds: string[];
  seriesId: string;
};

function getPostState(coPost: CoPostItem) {
  if (coPost.status === 'invited') return '초대 대기';

  const publishedStatus = coPost.post?.publishedStatus;
  const publishedAt = coPost.post?.publishedAt ? new Date(coPost.post.publishedAt).getTime() : null;

  if (publishedStatus === 'published') return '공개됨';
  if (publishedStatus === 'unknown' && publishedAt && publishedAt > Date.now()) return '공개 예약';
  if (publishedStatus === 'unknown') return '공개됨';

  return '작성 중';
}

export default function CoPostInvitations({ initialData }: { initialData: CoPostListResponse | null }) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [acceptState, setAcceptState] = useState<AcceptState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const coPosts = initialData?.coPosts ?? [];
  const received = coPosts.filter((coPost) => coPost.status === 'invited' && coPost.role === 'partner');
  const sent = coPosts.filter((coPost) => coPost.status === 'invited' && coPost.role === 'inviter');

  async function respond(coPostId: string, body: Record<string, unknown>) {
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/co-posts/${coPostId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(result.error ?? '요청을 처리하지 못했습니다.');

      setAcceptState(null);
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '요청을 처리하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function openAccept(coPost: CoPostItem) {
    const boardName = initialData?.boardName;
    let categories: CategoryRow[] = [];
    let series: SeriesRow[] = [];

    if (boardName) {
      const [categoryResponse, seriesResponse] = await Promise.all([
        fetch(`/api/boards/${boardName}/category?siteName=${encodeURIComponent(siteName)}`, {
          credentials: 'include',
        }),
        fetch(`/api/boards/${boardName}/series?siteName=${encodeURIComponent(siteName)}`, {
          credentials: 'include',
        }),
      ]);
      const categoryResult = (await categoryResponse.json().catch(() => ({}))) as { categories?: CategoryRow[] };
      const seriesResult = (await seriesResponse.json().catch(() => ({}))) as { series?: SeriesRow[] };
      categories = categoryResult.categories ?? [];
      series = seriesResult.series ?? [];
    }

    setAcceptState({ coPost, categories, series, categoryIds: [], seriesId: '' });
  }

  function renderCoPost(coPost: CoPostItem, actions: React.ReactNode) {
    return (
      <div key={coPost.id} className={`paper ${styles.paper}`}>
        <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5} justifyContent="space-between">
          <Stack gap={0.5} sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2">{coPost.post?.subject || '(제목 없음)'}</Typography>
            <Typography variant="body2">
              {coPost.other.ownerName} · {coPost.other.siteLabel} · /{coPost.other.siteKey}
            </Typography>
            <Typography variant="body2">{getPostState(coPost)}</Typography>
          </Stack>
          <Stack direction="row" gap={1} alignItems="center" flexShrink={0}>
            {actions}
          </Stack>
        </Stack>
      </div>
    );
  }

  const acceptContent = acceptState ? (
    <Stack gap={2}>
      <Typography variant="body2">
        {`'${acceptState.coPost.post?.subject || '(제목 없음)'}' 글이 내 블로그에 올라갈 카테고리와 연재를 고를 수 있어요. 고르지 않아도 됩니다.`}
      </Typography>
      <FormControl fullWidth size="small">
        <Select<string[]>
          displayEmpty
          multiple
          value={acceptState.categoryIds}
          onChange={(event: SelectChangeEvent<string[]>) => {
            const value = event.target.value;
            setAcceptState((current) =>
              current ? { ...current, categoryIds: typeof value === 'string' ? value.split(',') : value } : current,
            );
          }}
          renderValue={(selected) =>
            selected.length === 0
              ? '카테고리 선택 안함'
              : acceptState.categories
                  .filter((category) => selected.includes(category.id))
                  .map((category) => category.category_label)
                  .join(', ')
          }
        >
          {acceptState.categories.map((category) => (
            <MenuItem key={category.id} value={category.id}>
              <ListItemText primary={category.category_label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth size="small">
        <Select<string>
          displayEmpty
          value={acceptState.seriesId}
          onChange={(event: SelectChangeEvent<string>) =>
            setAcceptState((current) => (current ? { ...current, seriesId: event.target.value } : current))
          }
        >
          <MenuItem value="">
            <ListItemText primary="연재 선택 안함" />
          </MenuItem>
          {acceptState.series.map((series) => (
            <MenuItem key={series.id} value={series.id}>
              <ListItemText primary={series.series_label} />
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  ) : null;

  function submitAccept() {
    if (!acceptState) return;

    void respond(acceptState.coPost.id, {
      action: 'accept',
      categoryIds: acceptState.categoryIds,
      seriesId: acceptState.seriesId || null,
    });
  }

  if (received.length === 0 && sent.length === 0) {
    return null;
  }

  return (
    <>
      {received.length > 0 ? (
        <Stack gap={1}>
          <Typography variant="h6">받은 공동 집필 초대</Typography>
          {received.map((coPost) =>
            renderCoPost(
              coPost,
              <>
                <button
                  type="button"
                  className="button small cancel"
                  disabled={isSubmitting}
                  onClick={() => void respond(coPost.id, { action: 'decline' })}
                >
                  거절
                </button>
                <button
                  type="button"
                  className="button small action"
                  disabled={isSubmitting}
                  onClick={() => void openAccept(coPost)}
                >
                  수락
                </button>
              </>,
            ),
          )}
        </Stack>
      ) : null}

      {sent.length > 0 ? (
        <Stack gap={1}>
          <Typography variant="h6">보낸 공동 집필 초대</Typography>
          {sent.map((coPost) =>
            renderCoPost(
              coPost,
              <button
                type="button"
                className="button small cancel"
                disabled={isSubmitting}
                onClick={() => void respond(coPost.id, { action: 'cancel' })}
              >
                초대 취소
              </button>,
            ),
          )}
        </Stack>
      ) : null}

      <FormErrorDialog
        open={Boolean(errorMessage)}
        title="공동 집필"
        messages={errorMessage ? [errorMessage] : []}
        onClose={() => setErrorMessage('')}
      />

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(acceptState)}
          onClose={() => setAcceptState(null)}
          className="VhiDrawer-bottom"
        >
          <h2>공동 집필 수락</h2>
          <button type="button" className="close-button" onClick={() => setAcceptState(null)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{acceptContent}</div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={() => setAcceptState(null)}>
              취소
            </button>
            <button type="button" className="button medium submit" disabled={isSubmitting} onClick={submitAccept}>
              수락
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(acceptState)}
          onClose={() => setAcceptState(null)}
          fullWidth
          maxWidth="sm"
          className="VhiDialog"
        >
          <DialogTitle>공동 집필 수락</DialogTitle>
          <button type="button" className="close-button" onClick={() => setAcceptState(null)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>{acceptContent}</DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={() => setAcceptState(null)}>
              취소
            </button>
            <button type="button" className="button medium submit" disabled={isSubmitting} onClick={submitAccept}>
              수락
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
