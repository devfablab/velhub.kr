'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import Button from '@mui/material/Button';
import { normalizeText } from '@/lib/utils';
import Anchor from '../Anchor';
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

export default function TableList() {
  const params = useParams();
  const pathname = usePathname();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);

  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [writeBoards, setWriteBoards] = useState<BoardItem[]>([]);
  const [alertMessage, setAlertMessage] = useState('');

  const shouldShowWriteLink = useMemo(() => !isWritePath(pathname, siteName), [pathname, siteName]);

  const canWriteCurrentBoard = useMemo(() => {
    if (!boardName) {
      return true;
    }

    return writeBoards.some((board) => board.board_key === boardName);
  }, [boardName, writeBoards]);

  const shouldRenderWriteLink = shouldShowWriteLink && canWriteCurrentBoard;

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
    <div className={`${styles['table-list']} paper`}>
      {shouldRenderWriteLink ? (
        <p className={styles.button}>
          <Anchor href={boardName ? `/${siteName}/${boardName}/new` : `/${siteName}/board/new`} className="button">
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

      <Dialog open={Boolean(alertMessage)} onClose={() => setAlertMessage('')} className="vh-dialog">
        <DialogContent>
          <DialogContentText>{alertMessage}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAlertMessage('')} variant="contained">
            확인
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
