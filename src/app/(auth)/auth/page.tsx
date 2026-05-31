/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import EastRoundedIcon from '@mui/icons-material/EastRounded';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '@/components/Anchor';
import styles from '@/app/auth.module.sass';

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

export default function Page() {
  const { isReady } = useAuthState();
  const [isMounted, setIsMounted] = useState(false);
  const { themeMode, setThemeMode } = useThemeMode();
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

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

  if (!isMounted || !isReady) {
    return null;
  }

  return (
    <>
      <header className={`${styles.header} ${styles['auth-header']}`}>
        <div className={styles.container}>
          <div className={styles.top}>
            <div className={styles.backlinks}>
              <Anchor href="/" className={styles.backlink} aria-label="라운지로 돌아가기">
                <ArrowBackRoundedIcon />
                <span>라운지</span>
              </Anchor>
            </div>
          </div>
        </div>
      </header>

      <main className={`${styles.main} ${styles.auth}`}>
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content}`}>
            {isMobile ? null : <h1>회원가입/로그인하기 🥰</h1>}
            <div className={styles['auth-select']}>
              <div className={styles.item}>
                <Anchor href="/auth/sign-up">
                  <i>
                    <CheckOutlinedIcon />
                  </i>
                  <div>
                    <strong>새로운 공간을 만들어보세요</strong>
                    <p>
                      <span>회원가입 후 블로그 또는 커뮤니티를 개설할 수 있습니다.</span> 지금 바로 나만의 서비스를
                      시작해 보세요.
                    </p>
                  </div>
                  <em>
                    회원가입하기 <EastRoundedIcon />
                  </em>
                </Anchor>
              </div>
              <div className={styles.item}>
                <Anchor href="/auth/sign-in">
                  <i>
                    <LoginOutlinedIcon />
                  </i>
                  <div>
                    <strong>이어서 시작하기</strong>
                    <p>
                      <span>이미 계정이 있다면 로그인하고 바로 시작하세요.</span> 내가 운영하는 블로그와 커뮤니티를
                      관리하고, 다양한 서비스를 이용할 수 있습니다.
                    </p>
                  </div>
                  <em>
                    로그인하기 <EastRoundedIcon />
                  </em>
                </Anchor>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
