'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/board.module.sass';

type PostItem = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  created_at: string;
  author_name: string;
  post_count: number;
  is_pin: boolean;
  board_key: string;
  board_label: string;
  prefix_label: string | null;
};

type BoardListResponse = {
  contents?: PostItem[];
  page?: number;
  size?: number;
  totalCount?: number;
  totalPage?: number;
  error?: string;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [contents, setContents] = useState<PostItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadContents() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/boards/all?siteName=${siteName}&page=1&size=20`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as BoardListResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '전체 게시글을 불러오지 못했습니다.');
        }

        setContents(Array.isArray(result.contents) ? result.contents : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '전체 게시글을 불러오지 못했습니다.');
        } else {
          setErrorMessage('전체 게시글을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadContents();
  }, [siteName]);

  if (isLoading) {
    return <p>불러오는 중...</p>;
  }

  if (errorMessage) {
    return <p>{errorMessage}</p>;
  }

  if (contents.length === 0) {
    return <p>등록된 게시글이 없습니다.</p>;
  }

  return (
    <div className={`${styles.content} content`}>
      <h2>
        <ListAltOutlinedIcon />
        <span>최신글 보기</span>
      </h2>

      <div className="paper">
        <table>
          <caption>게시글 목록</caption>
          <thead>
            <tr>
              <th>제목</th>
              <th>작성자</th>
              <th>작성일</th>
              <th>조회수</th>
            </tr>
          </thead>

          <tbody>
            {contents.map((content) => (
              <tr key={content.id} className={content.is_pin ? styles.pinned : undefined}>
                <td>
                  {content.is_pin ? <PushPinRoundedIcon /> : null}
                  <small className={styles['board-name']}>{content.board_label}</small>
                  {content.prefix_label ? (
                    <small className={styles['prefix-name']}>{content.prefix_label}</small>
                  ) : null}
                  <Anchor href={`/${siteName}/${content.board_key}/${content.slug}`}>{content.subject}</Anchor>
                </td>
                <td>{content.author_name}</td>
                <td>{formatDate(content.created_at)}</td>
                <td>{content.post_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
