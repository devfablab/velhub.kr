'use client';

import { useEffect, useState } from 'react';
import { InputAdornment, Stack, TextField, Typography } from '@mui/material';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import Anchor from '@/components/Anchor';
import { ThemeMode, useThemeMode } from '@/app/themeProvider';
import styles from '@/app/new.module.sass';

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

function getStoredThemeMode() {
  if (typeof window === 'undefined') {
    return 'system' as ThemeMode;
  }

  const storedThemeMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (isThemeMode(storedThemeMode)) {
    return storedThemeMode;
  }

  return 'system' as ThemeMode;
}

function getResolvedThemeMode(themeMode: ThemeMode) {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeMode(themeMode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', `yellow-${getResolvedThemeMode(themeMode)}`);
}

export default function Opt() {
  const [handleName, setHandleName] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const { themeMode, setThemeMode } = useThemeMode();

  useEffect(() => {
    fetch('/api/creator/profile')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? '작가 정보를 불러오지 못했습니다.');
        if (payload.creator?.handleName) window.location.replace(`/creator/${payload.creator.handleName}`);
        setReady(true);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '작가 정보를 불러오지 못했습니다.'));
  }, []);

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  useEffect(() => {
    setThemeMode(getStoredThemeMode());
    setIsMounted(true);
  }, [setThemeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    applyThemeMode(themeMode);

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    function handleSystemThemeModeChange() {
      if (themeMode === 'system') {
        applyThemeMode('system');
      }
    }

    mediaQueryList.addEventListener('change', handleSystemThemeModeChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleSystemThemeModeChange);
    };
  }, [isMounted, themeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
  }, [isMounted]);

  if (message)
    return (
      <main className={styles['new-generation']}>
        <div className={styles.container}>
          <div className={`content ${styles.content}`}>
            <h1>작가 핸들네임 설정</h1>
            <div className="paper page-error">
              <NearbyErrorRoundedIcon />
              <Typography variant="h6" component="h2" sx={{ marginBottom: 2 }}>
                작가 핸들네임 설정
              </Typography>
              <p>{message}</p>
            </div>
          </div>
        </div>
      </main>
    );
  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/creator/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handleName, introduction: '', coverImage: '', links: [] }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? '핸들네임을 저장하지 못했습니다.');
      window.location.assign(`/creator/${payload.creator.handleName}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '핸들네임을 저장하지 못했습니다.');
      setSaving(false);
    }
  };
  if (!ready) return null;
  return (
    <main className={styles['new-generation']}>
      <div className={styles.container}>
        <div className={`content ${styles.content}`}>
          <h1>작가 핸들네임 설정</h1>
          <Stack gap={1}>
            <Typography variant="subtitle2">핸들네임</Typography>
            <TextField
              size="small"
              value={handleName}
              onChange={(event) => setHandleName(event.target.value)}
              slotProps={{
                htmlInput: { maxLength: 15 },
                input: {
                  startAdornment: <InputAdornment position="start">{baseUrl}/creator/</InputAdornment>,
                },
              }}
              helperText="영문 소문자, 숫자, 하이픈으로 3~15자 입력해 주세요."
            />
          </Stack>
          {message ? (
            <p className="alert error">
              <ErrorOutlineRoundedIcon />
              <span>{message}</span>
            </p>
          ) : null}
          <div className={styles.actions}>
            <Anchor href="/" className="button medium close">
              설정 취소
            </Anchor>
            <button type="button" className="button medium submit" onClick={save} disabled={saving}>
              {saving ? '저장 중' : '설정 완료'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
