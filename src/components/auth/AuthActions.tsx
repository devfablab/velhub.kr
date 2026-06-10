'use client';

import { useEffect, useState } from 'react';
import { Avatar } from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '../Anchor';
import styles from '@/app/aside.module.sass';

type HeaderResponse = {
  isLoggedIn: boolean;
  email: string;
  userName: string;
  avatar: string | null;
};

type UserProfile = {
  name: string;
  email: string;
  avatarUrl: string | null;
  isLoggedIn: boolean;
};

export default function AuthActions() {
  const { isReady, isAuthenticated } = useAuthState();
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '',
    email: '',
    avatarUrl: null,
    isLoggedIn: false,
  });

  useEffect(() => {
    async function loadHeader() {
      const response = await fetch('/api/header/lounge', {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HeaderResponse | { error?: string };

      if (!response.ok || !('isLoggedIn' in result)) {
        setUserProfile({
          name: '',
          email: '',
          avatarUrl: null,
          isLoggedIn: false,
        });
        return;
      }

      setUserProfile({
        name: result.userName,
        email: result.email,
        avatarUrl: result.avatar,
        isLoggedIn: result.isLoggedIn,
      });
    }

    if (!isReady) {
      return;
    }

    void loadHeader();
  }, [isReady]);

  if (!isReady) {
    return null;
  }

  if (isAuthenticated) {
    return (
      <>
        <div className={`${styles['user-info']} paper`}>
          <div className={styles.avatar}>
            <Avatar src={userProfile.avatarUrl || '/broken-image.jpg'} alt={userProfile.name} />
          </div>

          <div className={styles.info}>
            <div className={styles['info-detail']}>
              <em>{userProfile.name}</em>
              <cite>{userProfile.email}</cite>
            </div>
            <div className={styles.button}>
              <Anchor href="/settings" className="button small cancel">
                프로필 설정
              </Anchor>
            </div>
          </div>
        </div>
        <div className={`${styles['new-sites']} paper`}>
          <div className={styles.buttons}>
            <Anchor href="/new/blog" className="button medium submit">
              <span>블로그 개설하기</span>
              <AddRoundedIcon />
            </Anchor>
            <Anchor href="/new/community" className="button medium submit">
              <span>커뮤니티 개설하기</span>
              <AddRoundedIcon />
            </Anchor>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className={`${styles['user-status']} paper`}>
      <Anchor href="/auth/sign-in" className="button">
        로그인하기
      </Anchor>
    </div>
  );
}
