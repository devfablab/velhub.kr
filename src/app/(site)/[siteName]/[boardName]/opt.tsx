'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import PushPinRoundedIcon from '@mui/icons-material/PushPinRounded';
import HowToVoteIcon from '@mui/icons-material/HowToVote';
import ManageSearchIcon from '@mui/icons-material/ManageSearch';
import SearchIcon from '@mui/icons-material/Search';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { formatTimeAgo, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/board.module.sass';

type Props = {
  isCommunity: boolean;
};

type BoardItem = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'basic' | 'gallery' | 'youtube' | 'feed' | 'page' | 'blog';
  post_type?: 'none' | 'prefix' | 'series' | null;
  is_active?: boolean;
};

type PostImage = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type PostItem = {
  id: string;
  idx: number;
  slug: string;
  subject: string;
  summary: string;
  content_simple: string | null;
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
  thumbnail_image_url: string | null;
  thumbnail_width: number;
  thumbnail_height: number;
  images: PostImage[] | null;
  youtube_id: string | null;
};

type BoardListResponse = {
  board: BoardItem;
  contents?: PostItem[];
  page?: number;
  size?: number;
  totalCount?: number;
  totalPage?: number;
  keyword?: string;
  actions?: {
    canWritePost?: boolean;
  };
  error?: string;
};

type BoardViewType = 'default' | 'list';

const DEFAULT_PAGE_SIZE = 20;
const BOARD_B_PAGE_SIZE = 9;
const PAGER_SIZE = 10;

const YOUTUBE_THUMBNAIL_QUALITIES = ['maxresdefault', 'sddefault', 'hqdefault', 'mqdefault', 'default'];

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

function getGalleryThumbnail(content: PostItem) {
  const firstImage = content.images?.[0] ?? null;

  if (content.thumbnail_image_url) {
    return {
      url: content.thumbnail_image_url,
      width: content.thumbnail_width ?? firstImage?.width ?? 1200,
      height: content.thumbnail_height ?? firstImage?.height ?? 675,
    };
  }

  if (firstImage?.url) {
    return {
      url: firstImage.url,
      width: firstImage.width ?? 1200,
      height: firstImage.height ?? 675,
    };
  }

  return null;
}

function getImageCount(content: PostItem) {
  return Array.isArray(content.images) ? content.images.length : 0;
}

function getYoutubeThumbnailUrl(videoId: string, quality: string) {
  return `https://i.ytimg.com/vi_webp/${videoId}/${quality}.webp`;
}

function truncateText(value: string | null, maxLength: number) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  if (normalizedValue.length <= maxLength) {
    return normalizedValue;
  }

  return `${normalizedValue.slice(0, maxLength)}…`;
}

function YoutubeThumbnailImage({ content }: { content: PostItem }) {
  const [qualityIndex, setQualityIndex] = useState(0);
  const thumbnailUrl = content.thumbnail_image_url
    ? content.thumbnail_image_url
    : content.youtube_id
      ? getYoutubeThumbnailUrl(content.youtube_id, YOUTUBE_THUMBNAIL_QUALITIES[qualityIndex])
      : '';

  if (!thumbnailUrl) {
    return null;
  }

  return (
    <Image
      src={thumbnailUrl}
      width={content.thumbnail_width ?? 1280}
      height={content.thumbnail_height ?? 720}
      alt=""
      onError={() => {
        if (content.thumbnail_image_url) {
          return;
        }

        setQualityIndex((previousIndex) =>
          previousIndex < YOUTUBE_THUMBNAIL_QUALITIES.length - 1 ? previousIndex + 1 : previousIndex,
        );
      }}
    />
  );
}

export default function Opt({ isCommunity }: Props) {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName).toLowerCase();

  const initialPage = parsePage(searchParams.get('page'));
  const initialKeyword = normalizeText(searchParams.get('keyword'));

  const [board, setBoard] = useState<BoardItem | null>(null);
  const [contents, setContents] = useState<PostItem[]>([]);
  const [keywordInput, setKeywordInput] = useState(initialKeyword);
  const [searchKeyword, setSearchKeyword] = useState(initialKeyword);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPage, setTotalPage] = useState(1);
  const [boardViewType, setBoardViewType] = useState<BoardViewType>('default');
  const [canWritePost, setCanWritePost] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  async function loadContents(nextPage = 1, nextKeyword = '') {
    try {
      setErrorMessage('');

      const nextSize = boardName === 'b' ? BOARD_B_PAGE_SIZE : DEFAULT_PAGE_SIZE;

      const queryParams = new URLSearchParams({
        siteName,
        page: String(nextPage),
        size: String(nextSize),
      });

      if (nextKeyword) {
        queryParams.set('keyword', nextKeyword);
      }

      const response = await fetch(`/api/boards/${boardName}?${queryParams.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as BoardListResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '전체 게시글을 불러오지 못했습니다.');
      }

      setBoard(result.board);
      setContents(Array.isArray(result.contents) ? result.contents : []);
      setCurrentPage(typeof result.page === 'number' ? result.page : nextPage);
      setTotalCount(typeof result.totalCount === 'number' ? result.totalCount : 0);
      setTotalPage(typeof result.totalPage === 'number' ? result.totalPage : 1);
      setSearchKeyword(nextKeyword);
      setCanWritePost(Boolean(result.actions?.canWritePost));
    } catch (unknownError) {
      setCanWritePost(false);

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

    router.push(queryString ? `/${siteName}/${boardName}?${queryString}` : `/${siteName}/${boardName}`);
  }

  useEffect(() => {
    const nextPage = parsePage(searchParams.get('page'));
    const nextKeyword = normalizeText(searchParams.get('keyword'));

    setKeywordInput(nextKeyword);
    setIsLoading(true);
    void loadContents(nextPage, nextKeyword);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteName, boardName, searchParams]);

  useEffect(() => {
    setBoardViewType('default');
  }, [boardName]);

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
      <div className={`${styles.content} content`}>
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
        <div className="paper paper-error">{errorMessage}</div>
      </div>
    );
  }

  return (
    <div className={`${styles.content} content`} style={{ maxWidth: isCommunity ? undefined : 807 }}>
      {isCommunity ? (
        <h2>
          {isSearchMode ? (
            <ManageSearchIcon />
          ) : board ? (
            renderBoardTypeIcon(board.board_type)
          ) : (
            <ListAltOutlinedIcon />
          )}
          {isSearchMode ? (
            <span>
              <strong>{searchKeyword}</strong>
              {` 검색 결과 (${totalCount}건)`}
            </span>
          ) : board ? (
            <span>{board.board_label}</span>
          ) : null}
        </h2>
      ) : null}

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

      {!isCommunity && isSearchMode ? <p>{totalCount}개의 포스트를 찾았습니다.</p> : null}

      {!isSearchMode && board?.board_type === 'gallery' ? (
        <div className={styles['select-board-type']}>
          <ul>
            <li>
              <button
                type="button"
                aria-label="갤러리로 보기"
                className={boardViewType === 'default' ? styles.selected : undefined}
                onClick={() => setBoardViewType('default')}
              >
                <CollectionsOutlinedIcon />
              </button>
            </li>
            <li>
              <button
                type="button"
                aria-label="리스트로 보기"
                className={boardViewType === 'list' ? styles.selected : undefined}
                onClick={() => setBoardViewType('list')}
              >
                <FormatListNumberedOutlinedIcon />
              </button>
            </li>
          </ul>
        </div>
      ) : null}

      {!isSearchMode && board?.board_type === 'youtube' ? (
        <div className={styles['select-board-type']}>
          <ul>
            <li>
              <button
                type="button"
                aria-label="유튜브로 보기"
                className={boardViewType === 'default' ? styles.selected : undefined}
                onClick={() => setBoardViewType('default')}
              >
                <OndemandVideoOutlinedIcon />
              </button>
            </li>
            <li>
              <button
                type="button"
                aria-label="리스트로 보기"
                className={boardViewType === 'list' ? styles.selected : undefined}
                onClick={() => setBoardViewType('list')}
              >
                <FormatListNumberedOutlinedIcon />
              </button>
            </li>
          </ul>
        </div>
      ) : null}

      {!isSearchMode && board?.board_type === 'feed' ? (
        <div className={styles['select-board-type']}>
          <ul>
            <li>
              <button
                type="button"
                aria-label="피드로 보기"
                className={boardViewType === 'default' ? styles.selected : undefined}
                onClick={() => setBoardViewType('default')}
              >
                <DynamicFeedOutlinedIcon />
              </button>
            </li>
            <li>
              <button
                type="button"
                aria-label="리스트로 보기"
                className={boardViewType === 'list' ? styles.selected : undefined}
                onClick={() => setBoardViewType('list')}
              >
                <FormatListNumberedOutlinedIcon />
              </button>
            </li>
          </ul>
        </div>
      ) : null}

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
                <th className="long-cell">{isCommunity ? '작성자' : '작가'}</th>
                <th>{isCommunity ? '작성일' : '출간일'}</th>
              </tr>
            </thead>

            <tbody>
              {contents.map((content) => (
                <tr key={content.id} className={content.is_pin ? 'pinned' : undefined}>
                  <td className="long-cell">
                    <div className="board-subject">
                      {isCommunity ? (
                        <>
                          {content.is_pin ? (
                            <i className="pin-icon" aria-label="상단고정글">
                              <PushPinRoundedIcon />
                            </i>
                          ) : (
                            <i className="number">{content.idx}</i>
                          )}
                        </>
                      ) : null}
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
                      <Anchor href={`/${siteName}/${boardName}/${content.slug}`}>
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
      ) : board?.board_type === 'gallery' && boardViewType === 'default' ? (
        <div className="paper">
          <div className={styles['gallery-items']}>
            {contents.map((content) => {
              const thumbnail = getGalleryThumbnail(content);
              const imageCount = getImageCount(content);

              return (
                <Anchor href={`/${siteName}/${boardName}/${content.slug}`} key={content.id}>
                  <div className={styles.thumbnail}>
                    <span>
                      {content.is_pin ? (
                        <i className={styles['pin-icon']} aria-label="상단고정글">
                          <PushPinRoundedIcon />
                        </i>
                      ) : (
                        <i className={styles.number}>{content.idx}</i>
                      )}
                      {content.published_status === 'draft' ? <em>(임시글)</em> : null}
                    </span>
                    <small>{`${imageCount}개 이미지`}</small>
                    {thumbnail ? (
                      <Image src={thumbnail.url} width={thumbnail.width} height={thumbnail.height} alt="" />
                    ) : null}
                  </div>
                  <div className={styles.info}>
                    <div className={styles.subject}>
                      <strong>
                        {content.prefix_label ? `[${content.prefix_label}] ` : null}
                        {content.subject}
                      </strong>
                    </div>
                    <div className={styles.author}>
                      <cite>{content.author_name}</cite>
                    </div>
                    <div className={styles.tail}>
                      <time>
                        {formatTimeAgo(
                          content.published_status === 'published' ? content.published_at : content.created_at,
                        )}
                      </time>
                      {content.comment_count > 0 ? <span>댓글 {content.comment_count}</span> : null}
                      <span>조회 {content.post_count}</span>
                    </div>
                  </div>
                </Anchor>
              );
            })}
          </div>
        </div>
      ) : board?.board_type === 'youtube' && boardViewType === 'default' ? (
        <div className="paper">
          <div className={styles['youtube-items']}>
            {contents.map((content) => (
              <Anchor href={`/${siteName}/${boardName}/${content.slug}`} key={content.id}>
                <div className={styles.thumbnail}>
                  <span>
                    {content.is_pin ? (
                      <i className={styles['pin-icon']} aria-label="상단고정글">
                        <PushPinRoundedIcon />
                      </i>
                    ) : (
                      <i className={styles.number}>{content.idx}</i>
                    )}
                    {content.published_status === 'draft' ? <em>(임시글)</em> : null}
                  </span>
                  <YoutubeThumbnailImage content={content} />
                </div>
                <div className={styles.info}>
                  <div className={styles.subject}>
                    <strong>
                      {content.prefix_label ? `[${content.prefix_label}] ` : null}
                      {content.subject}
                    </strong>
                  </div>
                  <div className={styles.author}>
                    <cite>{content.author_name}</cite>
                  </div>
                  <div className={styles.tail}>
                    <time>
                      {formatTimeAgo(
                        content.published_status === 'published' ? content.published_at : content.created_at,
                      )}
                    </time>
                    {content.comment_count > 0 ? <span>댓글 {content.comment_count}</span> : null}
                    <span>조회 {content.post_count}</span>
                  </div>
                </div>
              </Anchor>
            ))}
          </div>
        </div>
      ) : board?.board_type === 'feed' && boardViewType === 'default' ? (
        <div className="paper">
          <div className={styles['feed-items']}>
            {contents.map((content) => (
              <div className={styles['feed-item']} key={content.id}>
                <div className={styles['content-simple']}>{truncateText(content.content_simple, 140)}</div>
                <div className={styles.info}>
                  <span>
                    {content.is_pin ? (
                      <i className={styles['pin-icon']} aria-label="상단고정글">
                        <PushPinRoundedIcon />
                      </i>
                    ) : (
                      <i className={styles.number}>{content.idx}</i>
                    )}
                    {content.published_status === 'draft' ? <em>(임시글)</em> : null}
                  </span>
                  <cite>{content.author_name}</cite>
                  <time className={styles.item}>
                    {formatTimeAgo(
                      content.published_status === 'published' ? content.published_at : content.created_at,
                    )}
                  </time>
                  {content.comment_count > 0 ? <span className={styles.item}>댓글 {content.comment_count}</span> : null}
                  <span className={styles.item}>조회 {content.post_count}</span>
                  <Anchor href={`/${siteName}/${boardName}/${content.slug}`} className={styles.item}>
                    <span>더보기</span>
                    <ChevronRightRoundedIcon />
                  </Anchor>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : board?.board_type === 'blog' ? (
        <div className="paper">
          <div className={styles['blog-items']}>
            {contents.map((content) => (
              <Anchor href={`/${siteName}/${boardName}/${content.slug}`} key={content.id}>
                <div className={styles.thumbnail}>
                  <span>{content.published_status === 'draft' ? <em>(임시글)</em> : null}</span>
                  {content.thumbnail_image_url ? (
                    <Image
                      src={content.thumbnail_image_url}
                      alt=""
                      width={content.thumbnail_width}
                      height={content.thumbnail_height}
                    />
                  ) : (
                    <div className={styles.dummy}>
                      <MenuBookRoundedIcon />
                    </div>
                  )}
                </div>
                <div className={styles.info}>
                  <div className={styles.subject}>
                    <strong>
                      {content.series_label ? `[${content.series_label}] ` : null}
                      {content.subject}
                    </strong>
                  </div>
                  <div className={styles.author}>
                    <cite>{content.author_name}</cite>
                  </div>
                  <div className={styles.tail}>
                    <time>
                      {formatTimeAgo(
                        content.published_status === 'published' ? content.published_at : content.created_at,
                      )}
                    </time>
                    {content.comment_count > 0 ? <span>댓글 {content.comment_count}</span> : null}
                    <span>조회 {content.post_count}</span>
                  </div>
                </div>
              </Anchor>
            ))}
          </div>
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
                      ) : (
                        <i className="number">{content.idx}</i>
                      )}
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
                      <Anchor href={`/${siteName}/${boardName}/${content.slug}`}>{content.subject}</Anchor>
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

      {canWritePost ? (
        <div className={styles['button-group']}>
          <Anchor href={`/${siteName}/${boardName}/new`} className={`${styles.submit} button`}>
            글쓰기
          </Anchor>
        </div>
      ) : null}
    </div>
  );
}
