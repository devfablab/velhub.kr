'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuItem from '@/components/SelectMenuItem';
import Select from '@/components/SelectWithCheck';

type Mode = 'prefix' | 'series' | 'close' | 'restore';
type Settings = {
  prefixId: string;
  seriesKey: string;
  hasSeries: boolean;
  prefixes: { id: string; prefix_label: string }[];
  series: { id: string; series_key: string; series_label: string }[];
};

export default function ManagePostActions({
  siteName,
  boardName,
  contentId,
  postType,
  boardType,
  isClosed,
  isLocked,
  canEdit,
  canDelete,
  canRestore,
  isAuthor,
}: {
  siteName: string;
  boardName: string;
  contentId: string;
  postType: string;
  boardType: string;
  isClosed: boolean;
  isLocked: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canRestore: boolean;
  isAuthor: boolean;
}) {
  const router = useRouter();
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const [mode, setMode] = useState<Mode | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const baseUrl = `/api/boards/${boardName}/${contentId}`;
  const canConfigure = canEdit && !isClosed && !isLocked && !['youtube', 'page'].includes(boardType);
  const title =
    mode === 'prefix'
      ? '말머리 설정'
      : mode === 'series'
        ? '연재 설정'
        : mode === 'restore'
          ? '게시물 복구'
          : '게시물 삭제';

  function close() {
    if (busy) return;
    setMode(null);
    setError('');
  }

  async function open(nextMode: Mode) {
    setMode(nextMode);
    setError('');
    setReason('');
    setSettings(null);
    setValue('');
    if (nextMode !== 'prefix' && nextMode !== 'series') return;
    setBusy(true);
    try {
      const response = await fetch(`${baseUrl}/settings?siteName=${siteName}`, { credentials: 'include' });
      const result = (await response.json()) as Settings & { error?: string };
      if (!response.ok) throw new Error(result.error || '설정 목록을 불러오지 못했습니다.');
      setSettings(result);
      setValue(nextMode === 'prefix' ? result.prefixId : result.seriesKey);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '설정 목록을 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!mode || busy) return;
    if (mode === 'close' && !isAuthor && reason.trim().length < 10)
      return setError('삭제 사유를 10자 이상 입력해주세요.');
    setBusy(true);
    setError('');
    try {
      const configuring = mode === 'prefix' || mode === 'series';
      const response = await fetch(`${baseUrl}/${configuring ? 'settings' : 'delete'}?siteName=${siteName}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configuring ? { kind: mode, value } : { action: mode, closedMessage: reason.trim() }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || '처리하지 못했습니다.');
      setMode(null);
      if (mode === 'close') router.replace(`/${siteName}/manage/contents/posts/c/${boardName}`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '처리하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const content = (
    <Stack gap={2} sx={{ pt: 1 }}>
      {mode === 'prefix' || mode === 'series' ? (
        <FormControl fullWidth size="small">
          <Select
            displayEmpty
            value={value}
            disabled={busy || !settings}
            onChange={(event) => {
              setValue(event.target.value);
              setError('');
            }}
          >
            <MenuItem value="" disabled={mode === 'series' && settings?.hasSeries}>
              <ListItemText primary="선택 안함" />
            </MenuItem>
            {mode === 'prefix'
              ? settings?.prefixes.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    <ListItemText primary={item.prefix_label} />
                  </MenuItem>
                ))
              : settings?.series.map((item) => (
                  <MenuItem key={item.id} value={item.series_key}>
                    <ListItemText primary={item.series_label} />
                  </MenuItem>
                ))}
          </Select>
        </FormControl>
      ) : mode === 'close' ? (
        <>
          <p>게시물을 삭제하시겠어요? 삭제 후 복구할 수 있습니다.</p>
          {!isAuthor ? (
            <TextField
              size="small"
              fullWidth
              multiline
              minRows={3}
              required
              placeholder="삭제 사유"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={busy}
            />
          ) : null}
        </>
      ) : (
        <p>게시물을 복구하시겠습니까?</p>
      )}
      {error ? <p className="alert error">{error}</p> : null}
    </Stack>
  );
  const submitDisabled = busy || ((mode === 'prefix' || mode === 'series') && !settings);
  const submitLabel = mode === 'close' ? '삭제' : mode === 'restore' ? '복구' : '저장';

  return (
    <>
      <Stack direction="row" justifyContent="space-between" sx={{ p: 1 }}>
        <Stack direction="row" gap={1}>
          {canConfigure && postType === 'prefix' ? (
            <button type="button" className="button small cancel" onClick={() => void open('prefix')}>
              말머리 설정
            </button>
          ) : null}
          {canConfigure && ['series', 'both'].includes(postType) ? (
            <button type="button" className="button small cancel" onClick={() => void open('series')}>
              연재 설정
            </button>
          ) : null}
        </Stack>
        {isClosed ? (
          canRestore ? (
            <button
              type="button"
              className="button small action"
              disabled={isLocked}
              onClick={() => void open('restore')}
            >
              {isLocked ? '복구 불가' : '복구'}
            </button>
          ) : null
        ) : canDelete ? (
          <button type="button" className="button small danger" onClick={() => void open('close')}>
            삭제
          </button>
        ) : null}
      </Stack>
      {!isNotMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(mode)}
          onClose={close}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>{title}</h2>
          <button type="button" className="close-button" onClick={close} disabled={busy} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{content}</div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={close} disabled={busy}>
              취소
            </button>
            <button
              type="button"
              className={`button medium ${mode === 'close' ? 'danger' : 'submit'}`}
              disabled={submitDisabled}
              onClick={() => void save()}
            >
              {submitLabel}
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog open={Boolean(mode)} onClose={close} fullWidth maxWidth="sm" className="vh-dialog vh-alert-dialog">
          <DialogTitle>{title}</DialogTitle>
          <button type="button" className="close-button" onClick={close} disabled={busy} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>{content}</DialogContent>
          <DialogActions>
            <button type="button" className="cancel-button" onClick={close} disabled={busy}>
              취소
            </button>
            <button type="button" disabled={submitDisabled} onClick={() => void save()}>
              {submitLabel}
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
