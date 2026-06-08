'use client';

import AuthActions from '@/components/auth/AuthActions';
import { useMediaQuery, useTheme } from '@mui/material';

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
