'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import { formatTimeAgo, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
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
  series_label: string | null;
  is_poll: boolean;
  comment_count: number;
};

type BoardListResponse = {
  contents?: PostItem[];
  page?: number;
  size?: number;
  totalCount?: number;
  totalPage?: number;
  error?: string;
};

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
    return (
      <div className={`${styles.content} content`}>
        <h2>
          <ListAltOutlinedIcon />
          <span>최신글 보기</span>
        </h2>
        <div className="paper">
          <div className="loading-container">
            <LoadingIndicator />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className={`${styles.content} content`}>
        <h2>
          <ListAltOutlinedIcon />
          <span>최신글 보기</span>
        </h2>
        <div className="paper paper-error">{errorMessage}</div>
      </div>
    );
  }

  if (contents.length === 0) {
    return (
      <div className={`${styles.content} content`}>
        <h2>
          <ListAltOutlinedIcon />
          <span>최신글 보기</span>
        </h2>
        <div className="paper paper-error">등록된 게시글이 없습니다.</div>
      </div>
    );
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
          <colgroup>
            <col />
            <col style={{ width: 127 }} />
            <col style={{ width: 77 }} />
            <col style={{ width: 67 }} />
          </colgroup>
          <thead>
            <tr>
              <th className="long-cell">제목</th>
              <th className="long-cell">작성자</th>
              <th>작성일</th>
              <th>조회수</th>
            </tr>
          </thead>

          <tbody>
            {contents.map((content) => (
              <tr key={content.id} className={content.is_pin ? 'pinned' : undefined}>
                <td className="long-cell">
                  <div className="board-subject">
                    {content.is_pin ? (
                      <i className="pin-icon" aria-label="상단고정글">
                        <PushPinRoundedIcon />
                      </i>
                    ) : null}
                    <small className="board-name board-chip" aria-label="게시판명">
                      {content.board_label}
                    </small>
                    {content.prefix_label ? (
                      <small className="prefix-name board-chip" aria-label="말머리">
                        {content.prefix_label}
                      </small>
                    ) : null}
                    {content.series_label ? (
                      <small className="series-name board-chip" aria-label="연재명">
                        {content.series_label}
                      </small>
                    ) : null}
                    {content.is_poll ? (
                      <i className="poll-icon" aria-label="투표글">
                        <HowToVoteIcon />
                      </i>
                    ) : null}
                    <Anchor
                      href={`/${siteName}/board/content?boardName=${content.board_key}&contentId=${content.slug}`}
                    >
                      {content.subject}
                    </Anchor>
                    {content.comment_count > 0 ? (
                      <span aria-label="댓글 수">{`(${content.comment_count})`}</span>
                    ) : null}
                  </div>
                </td>
                <td className="long-cell">
                  <cite>{content.author_name}</cite>
                </td>
                <td>{formatTimeAgo(content.created_at)}</td>
                <td>{content.post_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={styles['button-group']}>
        <Anchor href={`/${siteName}/board/new`} className={`${styles.submit} button`}>
          글쓰기
        </Anchor>
      </div>
    </div>
  );
}
