'use client';

import { useMediaQuery, useTheme } from '@mui/material';
import AuthActions from '@/components/auth/AuthActions';
import styles from '@/app/page.module.sass';

export default function AuthSection() {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  return (
    <>
      {isMobile ? (
        <section className={styles.auth}>
          <AuthActions />
        </section>
      ) : null}
    </>
  );
}
