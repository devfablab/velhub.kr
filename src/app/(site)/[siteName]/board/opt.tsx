'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SearchIcon from '@mui/icons-material/Search';
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
  published_at: string | null;
  published_status: 'draft' | 'published';
  comment_count: number;
  search_title_matched: boolean;
  search_content_matched: boolean;
  search_content: string;
};

type BoardListResponse = {
  contents?: PostItem[];
  page?: number;
  size?: number;
  totalCount?: number;
  totalPage?: number;
  keyword?: string;
  error?: string;
};

function renderHighlightedText(value: string, keyword: string) {
  const normalizedKeyword = normalizeText(keyword);

  if (!normalizedKeyword) {
    return value;
  }

  const result: ReactNode[] = [];
  const lowerValue = value.toLowerCase();
  const lowerKeyword = normalizedKeyword.toLowerCase();
  let currentIndex = 0;
  let matchedIndex = lowerValue.indexOf(lowerKeyword);

  while (matchedIndex !== -1) {
    if (matchedIndex > currentIndex) {
      result.push(value.slice(currentIndex, matchedIndex));
    }

    result.push(
      <strong key={`${matchedIndex}-${currentIndex}`}>
        {value.slice(matchedIndex, matchedIndex + normalizedKeyword.length)}
      </strong>,
    );

    currentIndex = matchedIndex + normalizedKeyword.length;
    matchedIndex = lowerValue.indexOf(lowerKeyword, currentIndex);
  }

  if (currentIndex < value.length) {
    result.push(value.slice(currentIndex));
  }

  return result;
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [contents, setContents] = useState<PostItem[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadContents(nextKeyword = '') {
    try {
      setErrorMessage('');

      const keywordQuery = nextKeyword ? `&keyword=${nextKeyword}` : '';
      const response = await fetch(`/api/boards/all?siteName=${siteName}&page=1&size=20${keywordQuery}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as BoardListResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '전체 게시글을 불러오지 못했습니다.');
      }

      setContents(Array.isArray(result.contents) ? result.contents : []);
      setTotalCount(typeof result.totalCount === 'number' ? result.totalCount : 0);
      setSearchKeyword(nextKeyword);
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

  useEffect(() => {
    void loadContents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteName]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextKeyword = normalizeText(keywordInput);

    setIsLoading(true);
    void loadContents(nextKeyword);
  }

  const isSearchMode = Boolean(searchKeyword);

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

  return (
    <div className={`${styles.content} content`}>
      <h2>
        {isSearchMode ? <ManageSearchIcon /> : <ListAltOutlinedIcon />}
        {isSearchMode ? (
          <span>
            <strong>{searchKeyword}</strong>
            {` 검색 결과 (${totalCount}건)`}
          </span>
        ) : (
          <span>최신글 보기</span>
        )}
      </h2>

      <div className={styles['board-search-container']}>
        <form onSubmit={handleSearchSubmit} className="form">
          <fieldset>
            <legend>게시글 검색</legend>
            <div className={styles['form-group']}>
              <div className={styles['form-control']}>
                <input
                  type="search"
                  value={keywordInput}
                  placeholder="검색어를 입력해주세요"
                  onChange={(event) => setKeywordInput(event.currentTarget.value)}
                />
              </div>
              <button type="submit" aria-label="검색">
                <SearchIcon />
              </button>
            </div>
          </fieldset>
        </form>
      </div>

      {contents.length === 0 ? (
        <div className="paper paper-error">{isSearchMode ? '검색 결과가 없습니다.' : '등록된 게시글이 없습니다.'}</div>
      ) : isSearchMode ? (
        <div className="paper">
          <table>
            <caption>게시글 검색 결과</caption>
            <colgroup>
              <col />
              <col style={{ width: 127 }} />
              <col style={{ width: 77 }} />
            </colgroup>
            <thead>
              <tr>
                <th className="long-cell">제목</th>
                <th className="long-cell">작성자</th>
                <th>작성일</th>
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
                        {renderHighlightedText(content.subject, content.search_title_matched ? searchKeyword : '')}
                      </Anchor>
                      {content.comment_count > 0 ? (
                        <strong aria-label="댓글 수">{`(${content.comment_count})`}</strong>
                      ) : null}
                    </div>
                    {content.search_content_matched ? (
                      <div className="board-content">
                        {renderHighlightedText(content.search_content, searchKeyword)}
                      </div>
                    ) : null}
                  </td>
                  <td className="long-cell">
                    <cite>{content.author_name}</cite>
                  </td>
                  <td>{formatTimeAgo(content.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
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
                      {content.published_status === 'draft' ? <em>(임시글)</em> : null}
                      <Anchor
                        href={`/${siteName}/board/content?boardName=${content.board_key}&contentId=${content.slug}`}
                      >
                        {content.subject}
                      </Anchor>
                      {content.comment_count > 0 ? (
                        <strong aria-label="댓글 수">{`(${content.comment_count})`}</strong>
                      ) : null}
                    </div>
                  </td>
                  <td className="long-cell">
                    <cite>{content.author_name}</cite>
                  </td>
                  <td>
                    {formatTimeAgo(
                      content.published_status === 'published' ? content.published_at : content.created_at,
                    )}
                  </td>
                  <td>{content.post_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles['button-group']}>
        <Anchor href={`/${siteName}/board/new`} className={`${styles.submit} button`}>
          글쓰기
        </Anchor>
      </div>
    </div>
  );
}
