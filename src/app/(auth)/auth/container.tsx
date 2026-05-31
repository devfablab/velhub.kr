/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useMediaQuery, useTheme } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import SocialLoginButtons from '@/components/auth/SocialLoginButtons';
import Anchor from '@/components/Anchor';
import styles from '@/app/auth.module.sass';
import { ThemeMode } from '@/app/themeProvider';

type ContainerProps = {
  children: React.ReactNode;
};

function getResolvedThemeMode(themeMode: ThemeMode) {
  return themeMode;
}

function applyThemeMode(themeMode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', `yellow-${getResolvedThemeMode(themeMode)}`);
}

export default function Container({ children }: ContainerProps) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    setIsMounted(true);
    applyThemeMode('dark');
  }, [isMounted]);

  if (!isMounted) {
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

      <main className={styles.main}>
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content}`}>
            <div className={styles.connect}>
              {isMobile ? null : (
                <div className={styles.dummy}>
                  <blockquote>
                    <p>All-out-all-day-all-night</p>
                    <cite>m-flo loves BoA</cite>
                  </blockquote>
                </div>
              )}
              <div className={styles['auth-form']}>
                <div className={styles.headline}>
                  <h1>{pathname === '/auth/sign-in' ? '이어서 시작하기' : '새로운 공간을 만들어보세요'}</h1>
                  <p>
                    {pathname === '/auth/sign-in'
                      ? `이미 계정이 있다면 \n 로그인하고 바로 시작하세요.`
                      : `지금 바로 \n 나만의 서비스를 시작해 보세요.`}
                  </p>
                </div>
                {children}
                <SocialLoginButtons />
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
