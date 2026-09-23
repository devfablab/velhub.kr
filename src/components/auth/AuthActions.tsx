'use client';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import { Avatar } from '@mui/material';
import Anchor from '../Anchor';
import styles from '@/app/aside.module.sass';

export type AuthActionsProfile = {
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
};

export default function AuthActions({ initialProfile }: { initialProfile: AuthActionsProfile | null }) {
  if (initialProfile?.isLoggedIn) {
    return (
      <>
        <div className={`${styles['user-info']} paper`}>
          <div className={styles.avatar}>
            <Avatar src={initialProfile.avatar || '/broken-image.jpg'} alt={initialProfile.userName ?? ''} />
          </div>

          <div className={styles.info}>
            <div className={styles['info-detail']}>
              <em>{initialProfile.userName}</em>
              <cite>{initialProfile.email}</cite>
            </div>
            <div className={styles.button}>
              <Anchor href="/settings" className="button small cancel">
                프로필 설정
              </Anchor>
            </div>
          </div>
        </div>
        <div className={styles['new-paper']}>
          <div className={`${styles['new']} paper`}>
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
          <div className={`${styles['new']} paper`}>
            <div className={styles.buttons}>
              <Anchor href="/creator" className="button medium action">
                <span>작가 신청하기</span>
                <AddRoundedIcon />
              </Anchor>
              <Anchor href="/memberships/creator" className="button medium action">
                <span>창작자 멤버십</span>
                <AddRoundedIcon />
              </Anchor>
              <Anchor href="/memberships/user" className="button medium action">
                <span>독자 멤버십</span>
                <AddRoundedIcon />
              </Anchor>
            </div>
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
