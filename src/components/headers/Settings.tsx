/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '../Anchor';
import styles from '@/app/header.module.sass';

type HeaderResponse = {
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  themeMode: ThemeMode | null;
};

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

export default function HeaderSettings() {
  const { isReady } = useAuthState();
  const [isMounted, setIsMounted] = useState(false);
  const [returnPath, setReturnPath] = useState<string | null>(null);
  const { themeMode, setThemeMode } = useThemeMode();
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    setReturnPath(sessionStorage.getItem('route:returnPath'));
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

  useEffect(() => {
    async function loadHeader() {
      const response = await fetch('/api/header/settings', {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HeaderResponse | { error?: string };

      if (!response.ok || !('isLoggedIn' in result)) {
        window.location.href = '/auth/sign-in';
        return;
      }
    }

    if (!isReady) {
      return;
    }

    void loadHeader();
  }, [isReady]);

  if (!isMounted || !isReady) {
    return null;
  }

  return (
    <header className={`${styles.header} ${styles['settings-header']}`}>
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.settings}>
            {returnPath ? (
              <Anchor href={returnPath} className={styles.backlink} aria-label="이전 페이지로 돌아가기">
                <ArrowBackRoundedIcon />
                <span>이전화면</span>
              </Anchor>
            ) : (
              <Anchor href="/" className={styles.backlink} aria-label="홈으로 돌아가기">
                <ArrowBackRoundedIcon />
                <span>홈</span>
              </Anchor>
            )}
            {isMobile ? <h1>개인 설정</h1> : null}
            <i />
          </div>
        </div>
      </div>
    </header>
  );
}
