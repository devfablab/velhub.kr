'use client';

import { useEffect, useState } from 'react';
import { Chip, Stack, TextField, Typography } from '@mui/material';

type SiteHashtag = { id: string; label: string };

const MAX_POST_HASHTAGS = 10;
const MAX_HASHTAG_LENGTH = 27;
const HASHTAG_PATTERN = /^[\p{L}\p{M}\p{N}_-]+$/u;

function normalizeLabel(value: string) {
  return value.trim().replace(/^#+/, '').normalize('NFC');
}

function getLabelError(label: string) {
  if ([...label].length > MAX_HASHTAG_LENGTH) return `해시태그는 ${MAX_HASHTAG_LENGTH}자 이하로 입력해 주세요.`;
  if (!HASHTAG_PATTERN.test(label)) return '해시태그에는 문자, 숫자, -, _만 쓸 수 있습니다.';

  return '';
}

type HashtagInputProps = {
  siteName: string;
  value: string[];
  onChange: (value: string[]) => void;
};

export default function HashtagInput({ siteName, value, onChange }: HashtagInputProps) {
  const [siteHashtags, setSiteHashtags] = useState<SiteHashtag[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isActive = true;

    fetch(`/api/manage/blog-hashtags?siteName=${encodeURIComponent(siteName)}`, { credentials: 'include' })
      .then((response) => response.json() as Promise<{ hashtags?: SiteHashtag[] }>)
      .then((result) => {
        if (isActive) setSiteHashtags(result.hashtags ?? []);
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [siteName]);

  const selectedKeys = new Set(value.map((label) => label.toLocaleLowerCase()));
  const keyword = normalizeLabel(inputValue).toLocaleLowerCase();
  const suggestions = keyword
    ? siteHashtags
        .filter(
          (hashtag) =>
            hashtag.label.toLocaleLowerCase().includes(keyword) && !selectedKeys.has(hashtag.label.toLocaleLowerCase()),
        )
        .slice(0, 10)
    : [];

  function addLabels(rawLabels: string[]) {
    let nextValue = value;
    let nextError = '';
    const rejected: string[] = [];

    for (const rawLabel of rawLabels) {
      const label = normalizeLabel(rawLabel);

      if (!label) continue;

      const labelError = getLabelError(label);

      if (labelError) {
        nextError = labelError;
        rejected.push(rawLabel.trim());
        continue;
      }

      const existing = siteHashtags.find((hashtag) => hashtag.label.toLocaleLowerCase() === label.toLocaleLowerCase());
      const resolvedLabel = existing?.label ?? label;

      if (nextValue.some((item) => item.toLocaleLowerCase() === resolvedLabel.toLocaleLowerCase())) continue;

      if (nextValue.length >= MAX_POST_HASHTAGS) {
        nextError = `해시태그는 글 하나에 ${MAX_POST_HASHTAGS}개까지 넣을 수 있습니다.`;
        rejected.push(rawLabel.trim());
        continue;
      }

      nextValue = [...nextValue, resolvedLabel];
    }

    if (nextValue !== value) onChange(nextValue);
    setErrorMessage(nextError);

    return rejected;
  }

  function commitInput(rawInput: string) {
    setInputValue(addLabels([rawInput]).join(' '));
  }

  function handleInputChange(nextInput: string) {
    if (!/\s/.test(nextInput)) {
      setInputValue(nextInput);
      return;
    }

    const parts = nextInput.split(/\s+/);
    const rest = parts.pop() ?? '';
    const rejected = addLabels(parts);
    setInputValue([...rejected, rest].filter(Boolean).join(' '));
  }

  function selectSuggestion(label: string) {
    addLabels([label]);
    setInputValue('');
  }

  function removeLabel(label: string) {
    onChange(value.filter((item) => item !== label));
    setErrorMessage('');
  }

  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">해시태그</Typography>
      {suggestions.length > 0 ? (
        <Stack direction="row" gap={0.5} flexWrap="wrap">
          {suggestions.map((hashtag) => (
            <Chip
              key={hashtag.id}
              label={`#${hashtag.label}`}
              size="small"
              className="chip success outlined"
              clickable
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(hashtag.label)}
            />
          ))}
        </Stack>
      ) : null}
      <TextField
        fullWidth
        size="small"
        placeholder={value.length >= MAX_POST_HASHTAGS ? '' : '해시태그 입력 후 스페이스바'}
        value={inputValue}
        error={Boolean(errorMessage)}
        helperText={errorMessage || `${value.length} / ${MAX_POST_HASHTAGS}`}
        onChange={(event) => handleInputChange(event.target.value)}
        onBlur={() => {
          if (inputValue.trim()) commitInput(inputValue);
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;

          if (event.key === 'Enter') {
            event.preventDefault();
            commitInput(inputValue);
          }

          if (event.key === 'Backspace' && !inputValue && value.length > 0) {
            removeLabel(value[value.length - 1]);
          }
        }}
        sx={{
          '& .MuiInputBase-root': { flexWrap: 'wrap', gap: 0.5, py: value.length > 0 ? 0.75 : undefined },
          '& .MuiInputBase-input': { flex: '1 1 120px', minWidth: 120, py: value.length > 0 ? 0.25 : undefined },
        }}
        slotProps={{
          htmlInput: { readOnly: value.length >= MAX_POST_HASHTAGS },
          input: {
            startAdornment:
              value.length > 0
                ? value.map((label) => (
                    <Chip
                      key={label}
                      label={`#${label}`}
                      size="small"
                      className="chip"
                      onMouseDown={(event) => event.preventDefault()}
                      onDelete={() => removeLabel(label)}
                    />
                  ))
                : undefined,
          },
        }}
      />
    </Stack>
  );
}
