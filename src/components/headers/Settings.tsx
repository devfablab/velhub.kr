/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
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

export default function HeaderSettings() {
  const { isReady } = useAuthState();
  const [isMounted, setIsMounted] = useState(false);
  const [returnPath, setReturnPath] = useState<string | null>(null);

  useEffect(() => {
    setReturnPath(sessionStorage.getItem('route:returnPath'));
  }, []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.gnb}>
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
          </div>
        </div>
      </div>
    </header>
  );
}
