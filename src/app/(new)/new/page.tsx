/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery, useTheme } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import InterestsRoundedIcon from '@mui/icons-material/InterestsRounded';
import EastRoundedIcon from '@mui/icons-material/EastRounded';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '@/components/Anchor';
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

export default function Page() {
  const { isReady } = useAuthState();
  const pathname = usePathname();
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

  if (!isMounted || !isReady) {
    return null;
  }

  return (
    <>
      <header className={`${styles.header} ${styles['new-header']}`}>
        <div className={styles.container}>
          <div className={styles.top}>
            <div className={styles.new}>
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
              {isMobile ? <h1>사이트 개설하기 😎</h1> : null}
              <i />
            </div>
          </div>
        </div>
      </header>
      <main className={styles['new-generation']}>
        <div className={styles.container}>
          <div className={`content ${styles.content}`}>
            {isMobile ? null : <h1>사이트 개설하기 😎</h1>}
            <div className={styles['service-select']}>
              <div className={styles.item}>
                <Anchor href="/new/blog">
                  <i>
                    <ArticleOutlinedIcon />
                  </i>
                  <div>
                    <strong>
                      <span>콘텐츠를 발행하고</span> 공유하는 공간
                    </strong>
                    <p>프로젝트 진행 과정, 전문 지식, 노하우, 칼럼까지 다양한 경험을 글로 발행해 보세요.</p>
                  </div>
                  <em>
                    블로그 개설하기 <EastRoundedIcon />
                  </em>
                </Anchor>
              </div>
              <div className={styles.item}>
                <Anchor href="/new/community">
                  <i>
                    <InterestsRoundedIcon />
                  </i>
                  <div>
                    <strong>
                      <span>함께 이야기할</span> 사람이 모이는 공간
                    </strong>
                    <p>
                      <span>관심사가 같은 사람들과 함께 이야기를 나누고 정보를 공유해 보세요.</span> 작은 모임부터 큰
                      커뮤니티까지 직접 운영할 수 있습니다.
                    </p>
                  </div>
                  <em>
                    커뮤니티 개설하기 <EastRoundedIcon />
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
