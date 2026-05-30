'use client';

import { Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Anchor from '@/components/Anchor';
import styles from '@/app/settings.module.sass';

type Props = {
  page: string;
};

export default function Headline({ page }: Props) {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  return (
    <Stack direction="row" justifyContent="space-between">
      {isMobile ? (
        <i />
      ) : (
        <Typography variant="h6" component="h1">
          {page === 'general' ? '일반 설정' : '추가 설정'}
        </Typography>
      )}
      <Anchor href={`/settings/${page === 'general' ? 'advanced' : ''}`} className={styles['headline-link']}>
        <span>{page === 'general' ? '추가 설정' : '일반 설정'}</span>
        <ArrowForwardRoundedIcon />
      </Anchor>
    </Stack>
  );
}
