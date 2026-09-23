'use client';

import { MouseEvent, useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  Drawer,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '../../Anchor';
import DonationButton from '../common/DonationButton';
import type { DonationStatusResponse } from '../common/DonationButton';
import ReportButton from '../common/ReportButton';
import SubscriptionButton from '../common/SubscriptionButton';
import type { SubscriptionStatusResponse } from '../common/SubscriptionButton';
import { useSiteInitialData } from '@/app/(site)/[siteName]/SiteInitialDataContext';
import styles from '@/app/aside.module.sass';

type BoardItem = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'blog' | 'page' | 'basic' | 'gallery' | 'youtube' | 'feed';
  post_type?: 'none' | 'prefix' | 'series' | null;
  is_active?: boolean;
};

type SelectedSeries = {
  series_key: string;
  series_label: string;
};

type Props = {
  board?: BoardItem | null;
  selectedSeries?: SelectedSeries | null;
  isCommunity?: boolean;
  writeHref?: string;
  initialSubscriptionStatus?: SubscriptionStatusResponse | null;
  initialDonationStatus?: DonationStatusResponse | null;
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

export default function TableListMobile({
  board = null,
  selectedSeries = null,
  writeHref,
  initialSubscriptionStatus,
  initialDonationStatus,
}: Props) {
  const params = useParams();
  const pathname = usePathname();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);
  const initialData = useSiteInitialData();

  const boards = (initialData?.boards ?? []).filter(
    (item) => item.is_active === true && item.board_type !== 'page',
  ) as BoardItem[];
  const writeBoards = useMemo(() => (initialData?.writeBoards ?? []) as BoardItem[], [initialData?.writeBoards]);
  const [alertMessage, setAlertMessage] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const isMenuOpen = Boolean(menuAnchorEl);

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

  const selectedBoardLabel = useMemo(() => {
    if (!boardName) {
      return '최신글 보기';
    }

    const selectedBoard = boards.find((board) => board.board_key === boardName);

    return selectedBoard?.board_label ?? '최신글 보기';
  }, [boardName, boards]);

  const handleMenuOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  return (
    <div className={`${styles['table-list-header']} paper`}>
      <div className={styles['board-subject']}>
        <div className={styles['board-selector']}>
          <button type="button" onClick={handleMenuOpen} aria-haspopup="menu" aria-expanded={isMenuOpen}>
            <span>{selectedBoardLabel}</span>
            <KeyboardArrowDownRoundedIcon />
          </button>

          <Menu anchorEl={menuAnchorEl} open={isMenuOpen} onClose={handleMenuClose} className="VhiMenu-popover">
            <MenuItem onClick={handleMenuClose}>
              <Anchor href={`/${siteName}/board`} className={!boardName ? 'current' : undefined}>
                {!boardName ? <CheckRoundedIcon /> : <i />}
                <span>최신글 보기</span>
              </Anchor>
            </MenuItem>

            {boards.map((board) => {
              const isSelected = board.board_key === boardName;

              return (
                <MenuItem key={board.id} onClick={handleMenuClose}>
                  <Anchor href={`/${siteName}/${board.board_key}`} className={isSelected ? 'current' : undefined}>
                    {isSelected ? <CheckRoundedIcon /> : <i />}
                    <span>{board.board_label}</span>
                  </Anchor>
                </MenuItem>
              );
            })}
          </Menu>
        </div>
        {boardName && board ? (
          <>
            {selectedSeries && (board.board_type === 'basic' || board.board_type === 'gallery') ? (
              <>
                <SubscriptionButton
                  siteName={siteName}
                  boardName={boardName}
                  board={board}
                  selectedSeries={selectedSeries}
                  selectedBoard={true}
                  initialStatus={initialSubscriptionStatus}
                />
                <DonationButton
                  siteName={siteName}
                  targetType="series"
                  boardName={boardName}
                  seriesName={selectedSeries.series_key}
                  initialStatus={initialDonationStatus}
                />
              </>
            ) : null}
          </>
        ) : null}
      </div>
      {shouldRenderWriteLink ? (
        <div className={styles['board-post']}>
          <ReportButton targetType="board" siteName={siteName} boardName={boardName} />
          <Anchor href={resolvedWriteHref} aria-label="글쓰기">
            <EditRoundedIcon />
          </Anchor>
        </div>
      ) : (
        <i />
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={Boolean(alertMessage)}
          onClose={() => setAlertMessage('')}
          className={`VhiDrawer-bottom VhiDrawer-bottom-service `}
        >
          <h2>{alertMessage}</h2>
          <button className="close-button" onClick={() => setAlertMessage('')} aria-label={`${alertMessage} 닫기`}>
            <CloseRoundedIcon />
          </button>
          <p>{alertMessage}</p>
          <div className="drawer-dialog-actions">
            <button type="button" onClick={() => setAlertMessage('')} className="button medium cancel">
              확인
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog open={Boolean(alertMessage)} onClose={() => setAlertMessage('')} className="vh-dialog">
          <DialogContent>
            <DialogContentText>{alertMessage}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <button onClick={() => setAlertMessage('')} className="button medium close">
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
