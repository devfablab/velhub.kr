'use client';

import { useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { Avatar, Chip, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import { LoadingIndicator } from '@/components/LoadingIndicator';

export type CoPostPartner = {
  siteId: string;
  siteKey: string;
  siteLabel: string;
  ownerName: string;
  ownerAvatarUrl: string | null;
};

type CoPostPartnerPickerProps = {
  siteName: string;
  value: CoPostPartner | null;
  disabled?: boolean;
  onChange: (value: CoPostPartner | null) => void;
};

function getSiteAddress(siteKey: string) {
  const host = typeof window === 'undefined' ? '' : window.location.host;

  return `${host}/${siteKey}`;
}

export default function CoPostPartnerPicker({ siteName, value, disabled = false, onChange }: CoPostPartnerPickerProps) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<CoPostPartner[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function search() {
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword || isSearching) return;

    setIsSearching(true);
    setErrorMessage('');

    try {
      const response = await fetch(
        `/api/co-posts/partners?siteName=${encodeURIComponent(siteName)}&keyword=${encodeURIComponent(trimmedKeyword)}`,
        { credentials: 'include' },
      );
      const result = (await response.json()) as { partners?: CoPostPartner[]; error?: string };

      if (!response.ok) throw new Error(result.error ?? '운영자를 검색하지 못했습니다.');

      setResults(result.partners ?? []);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '운영자를 검색하지 못했습니다.');
    } finally {
      setIsSearching(false);
    }
  }

  if (value) {
    return (
      <Stack gap={1}>
        <Typography variant="subtitle2">공동 집필 상대</Typography>
        <Stack direction="row" alignItems="center" gap={1.5} className="paper">
          <Avatar
            src={value.ownerAvatarUrl || '/broken-image.jpg'}
            alt={value.ownerName}
            sx={{ width: 36, height: 36 }}
          />
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2">{value.ownerName}</Typography>
            <Typography variant="body2">
              {value.siteLabel} · {getSiteAddress(value.siteKey)}
            </Typography>
          </Stack>
          {disabled ? null : (
            <button type="button" className="button small cancel" onClick={() => onChange(null)}>
              변경
            </button>
          )}
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">공동 집필 상대 *</Typography>
      <TextField
        fullWidth
        size="small"
        placeholder="운영자 이름 검색"
        value={keyword}
        disabled={disabled}
        onChange={(event) => setKeyword(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault();
            void search();
          }
        }}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <button
                  type="button"
                  className="button small action"
                  disabled={disabled || !keyword.trim() || isSearching}
                  onClick={() => void search()}
                >
                  검색
                </button>
              </InputAdornment>
            ),
          },
        }}
      />

      {isSearching ? <LoadingIndicator size={18} /> : null}

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      {results && !isSearching ? (
        results.length > 0 ? (
          <Stack gap={1}>
            {results.map((partner) => (
              <Stack
                key={partner.siteId}
                component="button"
                type="button"
                direction="row"
                alignItems="center"
                gap={1.5}
                className="paper"
                sx={{ textAlign: 'left', cursor: 'pointer', border: 'none', width: '100%' }}
                onClick={() => {
                  onChange(partner);
                  setResults(null);
                  setKeyword('');
                }}
              >
                <Avatar
                  src={partner.ownerAvatarUrl || '/broken-image.jpg'}
                  alt={partner.ownerName}
                  sx={{ width: 36, height: 36 }}
                />
                <Stack sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2">{partner.ownerName}</Typography>
                  <Typography variant="body2">{partner.siteLabel}</Typography>
                </Stack>
                <Chip label={getSiteAddress(partner.siteKey)} size="small" className="chip default outlined" />
              </Stack>
            ))}
          </Stack>
        ) : (
          <Typography variant="body2">검색 결과가 없습니다.</Typography>
        )
      ) : null}
    </Stack>
  );
}
