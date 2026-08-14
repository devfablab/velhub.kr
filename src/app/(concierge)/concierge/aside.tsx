'use client';

import { useMediaQuery, useTheme } from '@mui/material';
import AuthActions from '@/components/auth/AuthActions';

export default function Aside() {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  return (
    <>
      {isMobile ? null : (
        <aside>
          <AuthActions />
        </aside>
      )}
    </>
  );
}
