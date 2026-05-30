'use client';

import { Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Anchor from '@/components/Anchor';
import styles from '@/app/settings.module.sass';

export default function Headline() {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-end">
      {isMobile ? (
        <i />
      ) : (
        <Typography variant="h6" component="h1">
          개인 설정
        </Typography>
      )}
      <Anchor href="/settings/advanced" className={styles['headline-link']}>
        <span>추가설정</span>
        <ArrowForwardRoundedIcon />
      </Anchor>
    </Stack>
  );
}
