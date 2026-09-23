'use client';

import { useMediaQuery, useTheme } from '@mui/material';
import AuthActions from '@/components/auth/AuthActions';
import { useConciergeHeader } from '../ConciergeHeaderContext';

export default function Aside() {
  const header = useConciergeHeader();
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  return (
    <>
      {isMobile ? null : (
        <aside>
          <AuthActions initialProfile={header} />
        </aside>
      )}
    </>
  );
}
