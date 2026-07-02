'use client';

import UserInfo from '@/components/service/community/UserInfo';
import { useMediaQuery, useTheme } from '@mui/material';

export default function Aside() {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  return (
    <>
      {!isMobile ? (
        <aside>
          <UserInfo />
        </aside>
      ) : null}
    </>
  );
}
