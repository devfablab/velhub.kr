'use client';

import { useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '../../Anchor';
import { useSiteInitialData } from '@/app/(site)/[siteName]/SiteInitialDataContext';
import styles from '@/app/aside.module.sass';

type BoardItem = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'blog' | 'page' | 'basic' | 'gallery' | 'youtube' | 'feed';
  is_active: boolean;
};

type Props = {
  writeHref?: string;
};

function isWritePath(pathname: string, siteName: string) {
  const normalizedPathname = normalizeText(pathname);
  const normalizedSiteName = normalizeText(siteName);

  if (!normalizedPathname || !normalizedSiteName) {
    return false;
  }

  const segments = normalizedPathname.split('/').filter(Boolean);

  if (segments.length < 2) {
    return false;
  }

  if (segments[0] !== normalizedSiteName) {
    return false;
  }

  if (segments[1] === 'board' && segments[2] === 'new' && segments.length === 3) {
    return true;
  }

  if (segments[1] !== 'board' && segments[2] === 'new' && segments.length === 3) {
    return true;
  }

  if (segments[1] !== 'board' && segments[3] === 'edit' && segments.length === 4) {
    return true;
  }

  return false;
}

function renderBoardTypeIcon(boardType: BoardItem['board_type']) {
  if (boardType === 'gallery') {
    return <CollectionsOutlinedIcon sx={{ width: 16, height: 16 }} />;
  }

  if (boardType === 'youtube') {
    return <OndemandVideoOutlinedIcon sx={{ width: 16, height: 16 }} />;
  }

  if (boardType === 'feed') {
    return <DynamicFeedOutlinedIcon sx={{ width: 16, height: 16 }} />;
  }

  return <FormatListNumberedOutlinedIcon sx={{ width: 16, height: 16 }} />;
}

export default function TableList({ writeHref }: Props) {
  const params = useParams();
  const pathname = usePathname();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);
  const initialData = useSiteInitialData();
  const boards = (initialData?.boards ?? []).filter((board) => board.is_active === true && board.board_type !== 'page');
  const writeBoards = useMemo(() => initialData?.writeBoards ?? [], [initialData?.writeBoards]);
  const [alertMessage, setAlertMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const resolvedWriteHref = writeHref ?? (boardName ? `/${siteName}/${boardName}/new` : `/${siteName}/board/new`);
  const shouldShowWriteLink = useMemo(
    () => (writeHref ? normalizeText(pathname) !== writeHref : !isWritePath(pathname, siteName)),
    [pathname, siteName, writeHref],
  );

  const canWriteCurrentBoard = useMemo(() => {
    if (!boardName) {
      return true;
    }

    return writeBoards.some((board) => board.board_key === boardName);
  }, [boardName, writeBoards]);

  const shouldRenderWriteLink = shouldShowWriteLink && canWriteCurrentBoard;

  return (
    <div className={`${styles['table-list']} paper`}>
      {shouldRenderWriteLink ? (
        <p className={styles.button}>
          <Anchor href={resolvedWriteHref} className="button">
            글쓰기
          </Anchor>
        </p>
      ) : null}

      <ol>
        <li className={styles.link}>
          <Anchor href={`/${siteName}/board`} className="link">
            <ListAltOutlinedIcon sx={{ width: 16, height: 16 }} />
            <span>최신글 보기</span>
          </Anchor>
        </li>
        {boards.map((board) => (
          <li key={board.id} className={styles.item}>
            <Anchor href={`/${siteName}/${board.board_key}`}>
              {renderBoardTypeIcon(board.board_type)}
              <span>{board.board_label}</span>
            </Anchor>
          </li>
        ))}
      </ol>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(alertMessage)}
          onClose={() => setAlertMessage('')}
          className="VhiDrawer-bottom VhiDrawer-bottom-service"
        >
          <h2>안내</h2>
          <button type="button" className="close-button" onClick={() => setAlertMessage('')} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div className="VhiDrawer-bottom-content">
            <DialogContentText>{alertMessage}</DialogContentText>
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" onClick={() => setAlertMessage('')} className="button small submit">
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={Boolean(alertMessage)}
          onClose={() => setAlertMessage('')}
          fullWidth
          maxWidth="xs"
          className="vh-dialog vh-alert-dialog"
        >
          <DialogTitle>안내</DialogTitle>
          <button type="button" className="close-button" onClick={() => setAlertMessage('')} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <DialogContentText>{alertMessage}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <button type="button" onClick={() => setAlertMessage('')}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
