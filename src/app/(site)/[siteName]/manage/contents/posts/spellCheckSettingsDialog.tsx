'use client';

import { useEffect, useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type ExclusionWord = { id: string; word: string };
type InfoResponse = { canManageExclusions?: boolean };
type WordsResponse = { words?: ExclusionWord[]; error?: string };
type DraftWord = { key: string; id: string | null; original: string; value: string };

function toDraftWords(words: ExclusionWord[]): DraftWord[] {
  return words.map((item) => ({ key: item.id, id: item.id, original: item.word, value: item.word }));
}

export default function SpellCheckSettingsDialog({ siteName }: { siteName: string }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [canManage, setCanManage] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [items, setItems] = useState<DraftWord[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [newWord, setNewWord] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    fetch(`/api/manage/spell-check?siteName=${encodeURIComponent(siteName)}`, { credentials: 'include' })
      .then((response) => response.json() as Promise<InfoResponse>)
      .then((result) => {
        if (isActive) setCanManage(result.canManageExclusions === true);
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
    setErrorMessage('');
    setItems([]);
    setDeletedIds([]);
    setNewWord('');

    try {
      const response = await fetch(`/api/manage/spell-check-exclusions?siteName=${encodeURIComponent(siteName)}`, {
        credentials: 'include',
      });
      const result = (await response.json()) as WordsResponse;

      if (!response.ok) throw new Error(result.error ?? '검사 제외 목록을 불러오지 못했습니다.');

      setItems(toDraftWords(result.words ?? []));
    } catch (unknownError) {
      setErrorMessage(unknownError instanceof Error ? unknownError.message : '검사 제외 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  function closeDialog() {
    if (isSaving) return;

    setIsOpen(false);
  }

  function addWord() {
    const word = newWord.trim();

    if (!word) return;

    setItems((current) => [
      ...current,
      { key: `new-${Date.now()}-${current.length}`, id: null, original: '', value: word },
    ]);
    setNewWord('');
    setErrorMessage('');
  }

  function changeWord(key: string, value: string) {
    setItems((current) => current.map((item) => (item.key === key ? { ...item, value } : item)));
    setErrorMessage('');
  }

  function removeWord(target: DraftWord) {
    if (target.id) {
      const deletedId = target.id;
      setDeletedIds((current) => [...current, deletedId]);
    }

    setItems((current) => current.filter((item) => item.key !== target.key));
    setErrorMessage('');
  }

  async function saveWords() {
    if (isSaving || !isDirty) return;

    if (items.some((item) => !item.value.trim())) {
      setErrorMessage('단어를 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/manage/spell-check-exclusions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          creates: items.filter((item) => item.id === null).map((item) => item.value.trim()),
          updates: items
            .filter((item) => item.id !== null && item.value.trim() !== item.original)
            .map((item) => ({ id: item.id, word: item.value.trim() })),
          deletes: deletedIds,
        }),
      });
      const result = (await response.json()) as WordsResponse;

      if (!response.ok) throw new Error(result.error ?? '검사 제외 목록을 저장하지 못했습니다.');

      setItems(toDraftWords(result.words ?? []));
      setDeletedIds([]);
      setIsOpen(false);
    } catch (unknownError) {
      setErrorMessage(unknownError instanceof Error ? unknownError.message : '검사 제외 목록을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!canManage) {
    return null;
  }

  const content = (
    <Stack gap={2}>
      <p className="alert info">
        <InfoOutlineRoundedIcon />
        <span>목록에 있는 단어가 들어간 곳은 맞춤법 검사에서 지적하지 않아요. 블로그 전체에 적용돼요.</span>
      </p>

      {isLoading ? (
        <Stack alignItems="center" justifyContent="center">
          <LoadingIndicator size={18} />
        </Stack>
      ) : null}

      {items.map((item) => (
        <Stack key={item.key} direction="row" alignItems="center" gap={1} sx={{ p: 0.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="검사 제외 단어"
            value={item.value}
            disabled={isSaving}
            onChange={(event) => changeWord(item.key, event.target.value)}
          />
          <IconButton size="small" aria-label="단어 삭제" disabled={isSaving} onClick={() => removeWord(item)}>
            <RemoveCircleOutlineRoundedIcon />
          </IconButton>
        </Stack>
      ))}

      <Stack direction="row" alignItems="center" gap={1} sx={{ p: 0.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="추가할 단어"
          value={newWord}
          onChange={(event) => setNewWord(event.target.value)}
          disabled={isSaving}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault();
              addWord();
            }
          }}
          slotProps={{
            input: {
              endAdornment: (
                <button
                  type="button"
                  className={isMobile ? 'button medium action' : 'button small action'}
                  disabled={!newWord.trim() || isSaving}
                  onClick={addWord}
                >
                  추가
                </button>
              ),
            },
          }}
        />
      </Stack>

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}
    </Stack>
  );

  return (
    <>
      <button type="button" className="button small cancel" onClick={() => void openDialog()}>
        맞춤법 검사 설정
      </button>

      {isMobile ? (
        <Drawer anchor="bottom" open={isOpen} onClose={closeDialog} className="VhiDrawer-bottom">
          <h2>맞춤법 검사 설정</h2>
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
              onClick={() => void saveWords()}
              disabled={!isDirty || isSaving}
            >
              저장
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog open={isOpen} onClose={closeDialog} fullWidth maxWidth="sm" className="VhiDialog">
          <DialogTitle>맞춤법 검사 설정</DialogTitle>
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
              onClick={() => void saveWords()}
              disabled={!isDirty || isSaving}
            >
              저장
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
