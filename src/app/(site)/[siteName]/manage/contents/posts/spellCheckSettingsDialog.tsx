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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

type ExclusionWord = { id: string; word: string };
type InfoResponse = { canManageExclusions?: boolean };
type WordsResponse = { words?: ExclusionWord[]; word?: ExclusionWord; error?: string };

export default function SpellCheckSettingsDialog({ siteName }: { siteName: string }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [canManage, setCanManage] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [words, setWords] = useState<ExclusionWord[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newWord, setNewWord] = useState('');
  const [busyId, setBusyId] = useState('');
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

  async function requestWords(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', body?: Record<string, string>) {
    const response = await fetch(
      method === 'GET'
        ? `/api/manage/spell-check-exclusions?siteName=${encodeURIComponent(siteName)}`
        : '/api/manage/spell-check-exclusions',
      {
        method,
        headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: method === 'GET' ? undefined : JSON.stringify({ siteName, ...body }),
      },
    );
    const result = (await response.json()) as WordsResponse;

    if (!response.ok) throw new Error(result.error ?? '검사 제외 목록을 처리하지 못했습니다.');

    return result;
  }

  async function openDialog() {
    setIsOpen(true);
    setIsLoading(true);
    setErrorMessage('');

    try {
      const result = await requestWords('GET');
      const nextWords = result.words ?? [];
      setWords(nextWords);
      setDrafts(Object.fromEntries(nextWords.map((item) => [item.id, item.word])));
    } catch (unknownError) {
      setErrorMessage(unknownError instanceof Error ? unknownError.message : '검사 제외 목록을 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }

  async function runAction(id: string, action: () => Promise<void>) {
    if (busyId) return;

    setBusyId(id);
    setErrorMessage('');

    try {
      await action();
    } catch (unknownError) {
      setErrorMessage(unknownError instanceof Error ? unknownError.message : '검사 제외 목록을 처리하지 못했습니다.');
    } finally {
      setBusyId('');
    }
  }

  function addWord() {
    const word = newWord.trim();

    if (!word) return;

    void runAction('new', async () => {
      const result = await requestWords('POST', { word });

      if (!result.word) return;

      const added = result.word;
      setWords((current) => [...current, added]);
      setDrafts((current) => ({ ...current, [added.id]: added.word }));
      setNewWord('');
    });
  }

  function updateWord(item: ExclusionWord) {
    const word = (drafts[item.id] ?? '').trim();

    if (!word || word === item.word) return;

    void runAction(item.id, async () => {
      const result = await requestWords('PATCH', { id: item.id, word });

      if (!result.word) return;

      const updated = result.word;
      setWords((current) => current.map((currentItem) => (currentItem.id === updated.id ? updated : currentItem)));
      setDrafts((current) => ({ ...current, [updated.id]: updated.word }));
    });
  }

  function deleteWord(item: ExclusionWord) {
    void runAction(item.id, async () => {
      await requestWords('DELETE', { id: item.id });
      setWords((current) => current.filter((currentItem) => currentItem.id !== item.id));
    });
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

      {isLoading ? <Typography variant="body2">불러오는 중이에요.</Typography> : null}

      {!isLoading && words.length === 0 ? <Typography variant="body2">검사 제외 목록이 비어 있어요.</Typography> : null}

      {words.map((item) => {
        const draft = drafts[item.id] ?? item.word;
        const isChanged = draft.trim() !== item.word && Boolean(draft.trim());

        return (
          <Stack key={item.id} direction="row" alignItems="center" gap={1}>
            <TextField
              fullWidth
              size="small"
              placeholder="검사 제외 단어"
              value={draft}
              onChange={(event) => setDrafts((current) => ({ ...current, [item.id]: event.target.value }))}
            />
            <button
              type="button"
              className={isMobile ? 'button medium action' : 'button small action'}
              disabled={!isChanged || Boolean(busyId)}
              onClick={() => updateWord(item)}
            >
              수정
            </button>
            <IconButton size="small" aria-label="단어 삭제" disabled={Boolean(busyId)} onClick={() => deleteWord(item)}>
              <RemoveCircleOutlineRoundedIcon />
            </IconButton>
          </Stack>
        );
      })}

      <Stack direction="row" alignItems="center" gap={1}>
        <TextField
          fullWidth
          size="small"
          placeholder="추가할 단어"
          value={newWord}
          onChange={(event) => setNewWord(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addWord();
            }
          }}
        />
        <button
          type="button"
          className={isMobile ? 'button medium action' : 'button small action'}
          disabled={!newWord.trim() || Boolean(busyId)}
          onClick={addWord}
        >
          추가
        </button>
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
        <Drawer anchor="bottom" open={isOpen} onClose={() => setIsOpen(false)} className="VhiDrawer-bottom">
          <h2>맞춤법 검사 설정</h2>
          <button type="button" className="close-button" onClick={() => setIsOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">{content}</div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium submit" onClick={() => setIsOpen(false)}>
              닫기
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog open={isOpen} onClose={() => setIsOpen(false)} fullWidth maxWidth="sm" className="VhiDialog">
          <DialogTitle>맞춤법 검사 설정</DialogTitle>
          <button type="button" className="close-button" onClick={() => setIsOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>{content}</DialogContent>
          <DialogActions>
            <button type="button" className="button medium submit" onClick={() => setIsOpen(false)}>
              닫기
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
