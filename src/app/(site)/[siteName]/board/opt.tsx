'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useMediaQuery, useTheme } from '@mui/material';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { formatTimeAgo, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import UserInfo from '@/components/service/community/UserInfo';
import PostCountTableList from '@/components/service/community/PostCountTableList';
import styles from '@/app/board.module.sass';
import FabNew from '@/components/service/common/FabNew';

type Props = {
  isCommunity: boolean;
};

type PostItem = {
  id: string;
  idx: number;
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

const PAGE_SIZE = 20;
const PAGER_SIZE = 10;

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

function parsePage(value: string | null) {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }

  return Math.floor(parsedValue);
}

function getPageNumbers(currentPage: number, totalPage: number) {
  const currentGroup = Math.floor((currentPage - 1) / PAGER_SIZE);
  const startPage = currentGroup * PAGER_SIZE + 1;
  const endPage = Math.min(startPage + PAGER_SIZE - 1, totalPage);

  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
}

export default function Opt({ isCommunity }: Props) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const siteName = normalizeText(params.siteName);

  const initialPage = parsePage(searchParams.get('page'));
  const initialKeyword = normalizeText(searchParams.get('keyword'));

  const [contents, setContents] = useState<PostItem[]>([]);
  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [searchKeyword, setSearchKeyword] = useState(initialKeyword);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPage, setTotalPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  async function loadContents(nextPage = 1, nextKeyword = '') {
    try {
      setErrorMessage('');

      const queryParams = new URLSearchParams({
        siteName,
        page: String(nextPage),
        size: String(PAGE_SIZE),
      });

      if (nextKeyword) {
        queryParams.set('keyword', nextKeyword);
      }

      const response = await fetch(`/api/boards/all?${queryParams.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as BoardListResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '전체 게시글을 불러오지 못했습니다.');
      }

      setContents(Array.isArray(result.contents) ? result.contents : []);
      setCurrentPage(typeof result.page === 'number' ? result.page : nextPage);
      setTotalCount(typeof result.totalCount === 'number' ? result.totalCount : 0);
      setTotalPage(typeof result.totalPage === 'number' ? result.totalPage : 1);
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

  function updateRoute(nextPage: number, nextKeyword: string) {
    const queryParams = new URLSearchParams();

    if (nextPage > 1) {
      queryParams.set('page', String(nextPage));
    }

    if (nextKeyword) {
      queryParams.set('keyword', nextKeyword);
    }

    const queryString = queryParams.toString();

    router.push(queryString ? `/${siteName}/board?${queryString}` : `/${siteName}/board`);
  }

  useEffect(() => {
    const nextPage = parsePage(searchParams.get('page'));
    const nextKeyword = normalizeText(searchParams.get('keyword'));

    setKeywordInput(nextKeyword);
    setIsLoading(true);
    void loadContents(nextPage, nextKeyword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteName, searchParams]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextKeyword = normalizeText(keywordInput);

    updateRoute(1, nextKeyword);
  }

  function handlePageClick(nextPage: number) {
    if (nextPage < 1 || nextPage > totalPage || nextPage === currentPage) {
      return;
    }

    updateRoute(nextPage, searchKeyword);
  }

  const isSearchMode = Boolean(searchKeyword);
  const pageNumbers = getPageNumbers(currentPage, totalPage);
  const hasPreviousPager = pageNumbers[0] > 1;
  const hasNextPager = pageNumbers[pageNumbers.length - 1] < totalPage;

  if (isLoading) {
    return (
      <div className="container">
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
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="container">
        <div className={`${styles.content} content`}>
          <h2>
            <ListAltOutlinedIcon />
            <span>최신글 보기</span>
          </h2>
          <div className="paper paper-error">{errorMessage}</div>
        </div>
      </div>
    );
  }

  if (!isCommunity) {
    return (
      <div className="container">
        <div className={`${styles.content} content`}>
          <div className="paper paper-error">지원하지 않는 경로입니다.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {isCommunity && !isMobile ? (
        <aside>
          <SiteInfo />
          <TableList />
        </aside>
      ) : null}

      <div
        className={`${styles.content} content`}
        style={{
          maxWidth: isMobile ? 992 : 'none',
          flex: isMobile ? 'none' : '1 0',
          width: isMobile ? '100%' : 'auto',
        }}
      >
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
          <div className="paper paper-error">
            {isSearchMode ? '검색 결과가 없습니다.' : '등록된 게시글이 없습니다.'}
          </div>
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
            {isMobile ? (
              <ol className="list">
                {contents.map((content) => (
                  <li key={content.id} className={content.is_pin ? 'pinned' : undefined}>
                    <Anchor
                      href={`/${siteName}/board/content?boardName=${content.board_key}&contentId=${content.slug}`}
                    >
                      <div className="subject">
                        <div className="board-subject">
                          {content.is_pin ? (
                            <i className="pin-icon" aria-label="상단고정글">
                              <PushPinRoundedIcon />
                            </i>
                          ) : null}
                          <small className="board-name board-chip" aria-label="게시판명">
                            {content.board_label} {!content.is_pin ? `/ ${content.idx}번째 글` : null}
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
                          <span>{content.subject}</span>
                          {content.comment_count > 0 ? (
                            <strong aria-label="댓글 수">{`(${content.comment_count})`}</strong>
                          ) : null}
                        </div>
                      </div>
                      <div className="tail">
                        <cite aria-label="작성자">{content.author_name}</cite>
                        <time aria-label="작성일">
                          {formatTimeAgo(
                            content.published_status === 'published' ? content.published_at : content.created_at,
                          )}
                        </time>
                        <span>
                          <VisibilityOutlinedIcon aria-label="조회수" sx={{ width: 14, height: 14 }} />
                          {content.post_count}
                        </span>
                      </div>
                    </Anchor>
                  </li>
                ))}
              </ol>
            ) : (
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
                            {content.board_label} {!content.is_pin ? `/ ${content.idx}번째 글` : null}
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
            )}
          </div>
        )}

        {totalPage > 1 ? (
          <nav className={styles.pagination} aria-label="페이지네이션">
            {hasPreviousPager ? (
              <button
                type="button"
                onClick={() => handlePageClick(pageNumbers[0] - 1)}
                className={styles.pager}
                aria-label="이전 페이지 묶음"
              >
                <ArrowBackIosRoundedIcon />
              </button>
            ) : null}

            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => handlePageClick(pageNumber)}
                className={pageNumber === currentPage ? styles.current : undefined}
                aria-current={pageNumber === currentPage ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}

            {hasNextPager ? (
              <button
                type="button"
                onClick={() => handlePageClick(pageNumbers[pageNumbers.length - 1] + 1)}
                className={styles.pager}
                aria-label="다음 페이지 묶음"
              >
                <ArrowForwardIosRoundedIcon />
              </button>
            ) : null}
          </nav>
        ) : null}
      </div>
      <FabNew />

      {isCommunity && !isMobile ? (
        <aside>
          <UserInfo />
          <PostCountTableList />
        </aside>
      ) : null}
    </div>
  );
}
