'use client';

import { MouseEvent, useEffect, useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
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
import styles from '@/app/aside.module.sass';

type BoardItem = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'blog' | 'page' | 'basic' | 'gallery' | 'youtube' | 'feed';
  is_active: boolean;
};

type BoardsResponse = {
  boards?: BoardItem[];
  error?: string;
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

export default function TableListMobile() {
  const params = useParams();
  const pathname = usePathname();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);

  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [writeBoards, setWriteBoards] = useState<BoardItem[]>([]);
  const [alertMessage, setAlertMessage] = useState('');
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const isMenuOpen = Boolean(menuAnchorEl);

  const shouldShowWriteLink = useMemo(() => !isWritePath(pathname, siteName), [pathname, siteName]);

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

  useEffect(() => {
    async function loadBoards() {
      try {
        setAlertMessage('');

        const response = await fetch(`/api/boards?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as BoardsResponse;

        if (!response.ok) {
          const message = result.error ?? '게시판 목록을 불러오지 못했습니다.';
          throw new Error(message);
        }

        const nextBoards = Array.isArray(result.boards) ? result.boards : [];

        setBoards(nextBoards.filter((board) => board.is_active === true && board.board_type !== 'page'));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setAlertMessage(unknownError.message || '게시판 목록을 불러오지 못했습니다.');
        } else {
          setAlertMessage('게시판 목록을 불러오지 못했습니다.');
        }
      }
    }

    async function loadWriteBoards() {
      try {
        const response = await fetch(`/api/boards/write?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as BoardsResponse;

        if (!response.ok) {
          setWriteBoards([]);
          return;
        }

        setWriteBoards(Array.isArray(result.boards) ? result.boards : []);
      } catch {
        setWriteBoards([]);
      }
    }

    if (!siteName) {
      return;
    }

    void loadBoards();
    void loadWriteBoards();
  }, [siteName]);

  return (
    <div className={`${styles['table-list-header']} paper`}>
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
      {shouldRenderWriteLink ? (
        <div className={styles['board-post']}>
          <Anchor href={boardName ? `/${siteName}/${boardName}/new` : `/${siteName}/board/new`} aria-label="글쓰기">
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
          <div className={styles['drawer-dialog-actions']}>
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
