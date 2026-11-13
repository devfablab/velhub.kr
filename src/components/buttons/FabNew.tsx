'use client';

import { useParams } from 'next/navigation';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Fab, useMediaQuery, useTheme } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/board.module.sass';

type Props = {
  isCommunity: boolean;
  withDesktopButton?: boolean;
};

export default function FabNew({ isCommunity, withDesktopButton = false }: Props) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const href = !isCommunity
    ? `/${siteName}/manage/contents/posts/new`
    : boardName
      ? `/${siteName}/${boardName}/new`
      : `/${siteName}/board/new`;

  if (!isMobile) {
    return withDesktopButton ? (
      <div className={styles['button-group']}>
        <Anchor href={href} className={`${styles.submit} button`}>
          글쓰기
        </Anchor>
      </div>
    ) : null;
  }

  return (
    <div className="fab">
      <Fab aria-label="새글 쓰기" href={href} size="medium">
        <EditRoundedIcon />
      </Fab>
    </div>
  );
}
