'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { IconButton, Stack, TextField, Typography } from '@mui/material';
import Container from '../menu';
import styles from '@/app/manage.module.sass';

type SiteType = 'blog' | 'community';
type Word = { id: string; word: string };
export type DenywordsResponse = { siteType?: SiteType; words?: Word[]; error?: string };

function normalizeWord(value: string) {
  return value.replace(/\s+/g, '').replace(/[^\p{L}]/gu, '');
}

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: DenywordsResponse | null;
  initialError: string;
}) {
  const params = useParams();
  const siteName = String(params.siteName ?? '');
  const [words, setWords] = useState(() => (initialData?.words ?? []).map((item) => item.word));
  const [savedWords, setSavedWords] = useState(() => (initialData?.words ?? []).map((item) => item.word));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(initialError);
  const siteType = initialData?.siteType ?? 'community';
  const normalizedWords = useMemo(() => words.map(normalizeWord).filter(Boolean), [words]);
  const hasInvalidWord = normalizedWords.some((word) => word.length < 2 || word.length > 10);
  const hasChanges = JSON.stringify(normalizedWords) !== JSON.stringify(savedWords);
  const canSave = !isSubmitting && hasChanges && !hasInvalidWord;

  function updateWord(index: number, value: string) {
    setWords((previous) => previous.map((word, itemIndex) => (itemIndex === index ? normalizeWord(value) : word)));
    setError('');
  }

  function removeWord(index: number) {
    setWords((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    setError('');
  }

  async function save() {
    if (!canSave) return;
    try {
      setIsSubmitting(true);
      setError('');
      const response = await fetch('/api/manage/denywords', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName, words: normalizedWords }),
      });
      const result = (await response.json()) as DenywordsResponse;
      if (!response.ok) throw new Error(result.error ?? '차단 단어 저장에 실패했습니다.');
      const nextWords = (result.words ?? []).map((item) => item.word);
      setWords(nextWords);
      setSavedWords(nextWords);
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '차단 단어 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Container pageTitle="단어차단 필터링" pageBack={`/${siteName}/manage`}>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Stack
            component="form"
            gap={3}
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <section className="paper">
              <Typography variant="subtitle2">워딩 프로파일러</Typography>
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>
                  {siteType === 'blog' ? '데브허브 댓글 사용 중일 때만 동작합니다.' : '게시글과 댓글에 적용됩니다.'}
                </span>
              </p>
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>단어로만 등록할 수 있으며 숫자, 특수문자는 입력하실 수 없습니다.</span>
              </p>

              {words.map((word, index) => (
                <Stack key={`${index}:${word}`} direction="row" alignItems="flex-start" gap={1}>
                  <TextField
                    fullWidth
                    placeholder="차단 단어"
                    size="small"
                    value={word}
                    error={Boolean(word) && (word.length < 2 || word.length > 10)}
                    helperText={
                      word && (word.length < 2 || word.length > 10)
                        ? '단어는 2자 이상 10자 이하로 입력해주세요.'
                        : undefined
                    }
                    onChange={(event) => updateWord(index, event.target.value)}
                  />
                  <IconButton aria-label="단어 삭제" onClick={() => removeWord(index)}>
                    <RemoveCircleOutlineRoundedIcon />
                  </IconButton>
                </Stack>
              ))}

              {error ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>{error}</span>
                </p>
              ) : null}

              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
                <button
                  type="button"
                  className="button medium action"
                  onClick={() => setWords((previous) => [...previous, ''])}
                >
                  <AddRoundedIcon />
                  단어 추가
                </button>
                <button type="submit" className="button medium submit" disabled={!canSave}>
                  저장
                </button>
              </Stack>
            </section>
          </Stack>
        </div>
      </div>
    </Container>
  );
}
