'use client';

import { useEffect, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import FormErrorDialog from '@/components/FormErrorDialog';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type ManagedHashtag = { id: string; label: string; postCount: number };
type HashtagsResponse = {
  canManage?: boolean;
  hashtags?: ManagedHashtag[];
  error?: string;
};
type DraftHashtag = { key: string; id: string | null; original: string; value: string; postCount: number };

const IN_USE_MESSAGE = '이 해시태그를 사용하는 글이 존재합니다.';

function toDraftHashtags(hashtags: ManagedHashtag[]): DraftHashtag[] {
  return hashtags.map((item) => ({
    key: item.id,
    id: item.id,
    original: item.label,
    value: item.label,
    postCount: item.postCount,
  }));
}

export default function HashtagSettingsDialog({ siteName }: { siteName: string }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [canManage, setCanManage] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [items, setItems] = useState<DraftHashtag[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [popupMessage, setPopupMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    fetch(`/api/manage/blog-hashtags?siteName=${encodeURIComponent(siteName)}`, { credentials: 'include' })
      .then((response) => response.json() as Promise<HashtagsResponse>)
      .then((result) => {
        if (isActive) setCanManage(result.canManage === true);
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [siteName]);

  const isDirty =
    deletedIds.length > 0 || items.some((item) => item.id === null || item.value.trim() !== item.original);

  async function openDialog() {
    setIsOpen(true);
    setIsLoading(true);
    setItems([]);
    setDeletedIds([]);
    setNewLabel('');

    try {
      const response = await fetch(`/api/manage/blog-hashtags?siteName=${encodeURIComponent(siteName)}`, {
        credentials: 'include',
      });
      const result = (await response.json()) as HashtagsResponse;

      if (!response.ok) throw new Error(result.error ?? '해시태그 목록을 불러오지 못했습니다.');

      setItems(toDraftHashtags(result.hashtags ?? []));
    } catch (unknownError) {
      setPopupMessage(unknownError instanceof Error ? unknownError.message : '해시태그 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  function closeDialog() {
    if (isSaving) return;

    setIsOpen(false);
  }

  function addHashtag() {
    const label = newLabel.trim();

    if (!label) return;

    setItems((current) => [
      ...current,
      { key: `new-${Date.now()}-${current.length}`, id: null, original: '', value: label, postCount: 0 },
    ]);
    setNewLabel('');
  }

  function changeHashtag(key: string, value: string) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, value } : item)));
  }

  function removeHashtag(target: DraftHashtag) {
    if (target.postCount > 0) {
      setPopupMessage(IN_USE_MESSAGE);
      return;
    }

    if (target.id) {
      const deletedId = target.id;
      setDeletedIds((current) => [...current, deletedId]);
    }

    setItems((current) => current.filter((item) => item.key !== target.key));
  }

  async function saveHashtags() {
    if (isSaving || !isDirty) return;

    if (items.some((item) => !item.value.trim())) {
      setPopupMessage('해시태그를 입력해 주세요.');
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch('/api/manage/blog-hashtags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          creates: items.filter((item) => item.id === null).map((item) => item.value.trim()),
          updates: items
            .filter((item) => item.id !== null && item.value.trim() !== item.original)
            .map((item) => ({ id: item.id, label: item.value.trim() })),
          deletes: deletedIds,
        }),
      });
      const result = (await response.json()) as HashtagsResponse;

      if (!response.ok) throw new Error(result.error ?? '해시태그를 저장하지 못했습니다.');

      setItems(toDraftHashtags(result.hashtags ?? []));
      setDeletedIds([]);
      setIsOpen(false);
    } catch (unknownError) {
      setPopupMessage(unknownError instanceof Error ? unknownError.message : '해시태그를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!canManage) {
    return null;
  }

  const content = (
    <Stack gap={2} sx={{ p: 0.5 }}>
      {isLoading ? (
        <Stack alignItems="center" justifyContent="center">
          <LoadingIndicator size={18} />
        </Stack>
      ) : null}

      {items.map((item) => {
        const isInUse = item.postCount > 0;

        return (
          <Stack key={item.key} direction="row" alignItems="flex-start" gap={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="해시태그"
              value={item.value}
              disabled={isSaving}
              onChange={(event) => changeHashtag(item.key, event.target.value)}
              helperText={item.id ? `글 ${item.postCount.toLocaleString()}개` : undefined}
            />
            <IconButton
              size="small"
              aria-label="해시태그 삭제"
              aria-disabled={isInUse}
              disabled={isSaving}
              sx={{ opacity: isInUse ? 0.38 : undefined, mt: 0.5 }}
              onClick={() => removeHashtag(item)}
            >
              <RemoveCircleOutlineRoundedIcon />
            </IconButton>
          </Stack>
        );
      })}

      <TextField
        fullWidth
        size="small"
        placeholder="추가할 해시태그"
        value={newLabel}
        onChange={(event) => setNewLabel(event.target.value)}
        disabled={isSaving}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            addHashtag();
          }
        }}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <button
                  type="button"
                  className="button small action"
                  disabled={!newLabel.trim() || isSaving}
                  onClick={addHashtag}
                >
                  추가
                </button>
              </InputAdornment>
            ),
          },
        }}
      />
    </Stack>
  );

  return (
    <>
      <button type="button" className="button small cancel" onClick={() => void openDialog()}>
        해시태그 관리
      </button>

      {isMobile ? (
        <Drawer anchor="bottom" open={isOpen} onClose={closeDialog} className="VhiDrawer-bottom">
          <h2>해시태그 관리</h2>
          <button type="button" className="close-button" onClick={closeDialog} disabled={isSaving} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{content}</div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={closeDialog} disabled={isSaving}>
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void saveHashtags()}
              disabled={!isDirty || isSaving}
            >
              저장
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog open={isOpen} onClose={closeDialog} fullWidth maxWidth="sm" className="VhiDialog">
          <DialogTitle>해시태그 관리</DialogTitle>
          <button type="button" className="close-button" onClick={closeDialog} disabled={isSaving} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>{content}</DialogContent>
          <DialogActions>
            <button type="button" className="button medium cancel" onClick={closeDialog} disabled={isSaving}>
              취소
            </button>
            <button
              type="button"
              className="button medium submit"
              onClick={() => void saveHashtags()}
              disabled={!isDirty || isSaving}
            >
              저장
            </button>
          </DialogActions>
        </Dialog>
      )}

      <FormErrorDialog
        open={Boolean(popupMessage)}
        title="해시태그 관리"
        messages={popupMessage ? popupMessage.split('\n') : []}
        onClose={() => setPopupMessage('')}
      />
    </>
  );
}
