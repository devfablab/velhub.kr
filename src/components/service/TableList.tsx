'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
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

  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const shouldShowWriteLink = useMemo(() => !isWritePath(pathname, siteName), [pathname, siteName]);

  useEffect(() => {
    async function loadBoards() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/boards?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as BoardsResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '게시판 목록을 불러오지 못했습니다.');
        }

        const nextBoards = Array.isArray(result.boards) ? result.boards : [];

        setBoards(nextBoards.filter((board) => board.is_active === true && board.board_type !== 'page'));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판 목록을 불러오지 못했습니다.');
        }
      }
    }

    if (!siteName) {
      return;
    }

    void loadBoards();
  }, [siteName]);

  return (
    <div className={`${styles['table-list']} paper`}>
      {errorMessage ? <p>{errorMessage}</p> : null}

      {shouldShowWriteLink ? (
        <p className={styles.button}>
          <Anchor href={`/${siteName}/board/new`} className="button">
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
    </div>
  );
}
