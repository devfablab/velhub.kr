'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import { normalizeText } from '@/lib/utils';
import ToastEditor from '@/components/editor/ToastEditor';
import styles from '@/app/board.module.sass';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type BoardItem = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'basic' | 'gallery' | 'youtube' | 'feed' | 'page';
  post_type?: 'none' | 'prefix' | 'series' | null;
  is_active: boolean;
};

type BoardsResponse = {
  boards?: BoardItem[];
  error?: string;
};

type BoardInfoResponse = {
  board?: {
    board_type: 'basic' | 'gallery' | 'youtube' | 'feed';
    post_type: 'none' | 'prefix' | 'series';
  };
  error?: string;
};

type PrefixRow = {
  id: string;
  prefix_key: number;
  prefix_label: string;
  board_id: string;
  site_id: string;
  created_at: string;
};

type PrefixListResponse = {
  prefixes?: PrefixRow[];
  error?: string;
};

type SeriesRow = {
  id: string;
  created_at: string;
  series_key: string;
  series_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  board_id: string;
  site_id: string;
  last_published_at: string | null;
  is_completed: boolean;
  user_id: string | null;
};

type SeriesListResponse = {
  series?: SeriesRow[];
  error?: string;
};

type UploadResponse = {
  ok?: boolean;
  path?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  error?: string;
};

type CreateResponse = {
  ok?: boolean;
  slug?: string;
  contentId?: string;
  publishedStatus?: 'draft' | 'published';
  error?: string;
};

type PostImageRow = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type PollState = {
  question: string;
  options: string[];
};

const EMPTY_POLL: PollState = {
  question: '',
  options: ['', '', '', '', ''],
};

function getYoutubeId(value: string) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  const patterns = [
    /(?:youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/,
    /(?:youtu\.be\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([A-Za-z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const matchedValue = normalizedValue.match(pattern);

    if (matchedValue?.[1]) {
      return matchedValue[1];
    }
  }

  return '';
}

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const thumbnailInputReference = useRef<HTMLInputElement | null>(null);
  const galleryInputReference = useRef<HTMLInputElement | null>(null);

  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [selectedBoardKey, setSelectedBoardKey] = useState('');
  const [boardType, setBoardType] = useState<'basic' | 'gallery' | 'youtube' | 'feed'>('basic');
  const [postType, setPostType] = useState<'none' | 'prefix' | 'series'>('none');
  const [prefixList, setPrefixList] = useState<PrefixRow[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRow[]>([]);
  const [selectedPrefixId, setSelectedPrefixId] = useState('');
  const [selectedSeriesKey, setSelectedSeriesKey] = useState('');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [contentSimple, setContentSimple] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeCreatedAt, setYoutubeCreatedAt] = useState('');
  const [thumbnailImage, setThumbnailImage] = useState('');
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState('');
  const [thumbnailWidth, setThumbnailWidth] = useState<number | null>(null);
  const [thumbnailHeight, setThumbnailHeight] = useState<number | null>(null);
  const [images, setImages] = useState<PostImageRow[]>([]);
  const [isComment, setIsComment] = useState(true);
  const [isPin, setIsPin] = useState(false);
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [poll, setPoll] = useState<PollState>(EMPTY_POLL);
  const [isLoadingBoards, setIsLoadingBoards] = useState(true);
  const [isLoadingBoardMeta, setIsLoadingBoardMeta] = useState(false);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isSubmittingPublish, setIsSubmittingPublish] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const selectedBoard = useMemo(
    () => boards.find((board) => board.board_key === selectedBoardKey) ?? null,
    [boards, selectedBoardKey],
  );

  const isBasicBoard = boardType === 'basic';
  const isGalleryBoard = boardType === 'gallery';
  const isYoutubeBoard = boardType === 'youtube';
  const isFeedBoard = boardType === 'feed';
  const youtubeId = useMemo(() => getYoutubeId(youtubeUrl), [youtubeUrl]);

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

        const nextBoards = (Array.isArray(result.boards) ? result.boards : []).filter(
          (board) => board.is_active === true && board.board_type !== 'page',
        );

        setBoards(nextBoards);
        setSelectedBoardKey('');
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoadingBoards(false);
      }
    }

    void loadBoards();
  }, [siteName]);

  useEffect(() => {
    async function loadBoardMeta() {
      if (!selectedBoardKey) {
        setBoardType('basic');
        setPostType('none');
        setPrefixList([]);
        setSeriesList([]);
        setSelectedPrefixId('');
        setSelectedSeriesKey('');
        return;
      }

      try {
        setErrorMessage('');
        setIsLoadingBoardMeta(true);
        setSelectedPrefixId('');
        setSelectedSeriesKey('');

        const boardResponse = await fetch(`/api/boards/${selectedBoardKey}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const boardResult = (await boardResponse.json()) as BoardInfoResponse;

        if (!boardResponse.ok) {
          throw new Error(boardResult.error ?? '게시판 정보를 불러오지 못했습니다.');
        }

        const nextBoardType = boardResult.board?.board_type ?? 'basic';
        const nextPostType = boardResult.board?.post_type ?? 'none';

        setBoardType(nextBoardType);
        setPostType(nextPostType);
        setPrefixList([]);
        setSeriesList([]);

        if (nextPostType === 'prefix') {
          const prefixResponse = await fetch(`/api/boards/${selectedBoardKey}/prefix?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          });

          const prefixResult = (await prefixResponse.json()) as PrefixListResponse;

          if (!prefixResponse.ok) {
            throw new Error(prefixResult.error ?? '말머리 목록을 불러오지 못했습니다.');
          }

          setPrefixList(Array.isArray(prefixResult.prefixes) ? prefixResult.prefixes : []);
        }

        if (nextPostType === 'series') {
          const seriesResponse = await fetch(`/api/boards/${selectedBoardKey}/series?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          });

          const seriesResult = (await seriesResponse.json()) as SeriesListResponse;

          if (!seriesResponse.ok) {
            throw new Error(seriesResult.error ?? '연재 목록을 불러오지 못했습니다.');
          }

          setSeriesList(Array.isArray(seriesResult.series) ? seriesResult.series : []);
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoadingBoardMeta(false);
      }
    }

    void loadBoardMeta();
  }, [selectedBoardKey, siteName]);

  function resetBoardSpecificFields(nextBoardKey: string) {
    setSelectedBoardKey(nextBoardKey);
    setSelectedPrefixId('');
    setSelectedSeriesKey('');
    setSubject('');
    setSummary('');
    setContentHtml('');
    setContentMarkdown('');
    setContentSimple('');
    setYoutubeUrl('');
    setYoutubeCreatedAt('');
    setThumbnailImage('');
    setThumbnailImageUrl('');
    setThumbnailWidth(null);
    setThumbnailHeight(null);
    setImages([]);
    setIsPollEnabled(false);
    setPoll(EMPTY_POLL);
    setErrorMessage('');
  }

  async function uploadPostImage(file: File, folder: 'thumbnail' | 'images' | 'editor') {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    formData.append('siteName', siteName);

    const response = await fetch('/api/attachment/add/post', {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    const result = (await response.json()) as UploadResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '이미지 업로드에 실패했습니다.');
    }

    if (!result.path || !result.url) {
      throw new Error('이미지 업로드에 실패했습니다.');
    }

    return {
      path: result.path,
      url: result.url,
      width: typeof result.width === 'number' ? result.width : null,
      height: typeof result.height === 'number' ? result.height : null,
    };
  }

  async function deletePostImage(path: string) {
    const response = await fetch('/api/attachment/delete/post', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        siteName,
        path,
      }),
    });

    const result = (await response.json()) as { ok?: boolean; error?: string };

    if (!response.ok) {
      throw new Error(result.error ?? '이미지 삭제에 실패했습니다.');
    }
  }

  async function handleThumbnailFileChange(event: ChangeEvent<HTMLInputElement>) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || isUploadingThumbnail) {
      inputElement.value = '';
      return;
    }

    try {
      setErrorMessage('');
      setIsUploadingThumbnail(true);

      const uploadedImage = await uploadPostImage(selectedFile, 'thumbnail');

      if (thumbnailImage) {
        await deletePostImage(thumbnailImage);
      }

      setThumbnailImage(uploadedImage.path);
      setThumbnailImageUrl(uploadedImage.url);
      setThumbnailWidth(uploadedImage.width);
      setThumbnailHeight(uploadedImage.height);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '이미지 업로드에 실패했습니다.');
      } else {
        setErrorMessage('이미지 업로드에 실패했습니다.');
      }
    } finally {
      setIsUploadingThumbnail(false);
      inputElement.value = '';
    }
  }

  async function handleGalleryFileChange(event: ChangeEvent<HTMLInputElement>) {
    const inputElement = event.currentTarget;
    const selectedFiles = Array.from(inputElement.files ?? []);

    if (selectedFiles.length === 0 || isUploadingImages) {
      inputElement.value = '';
      return;
    }

    const remainCount = 6 - images.length;

    if (remainCount <= 0) {
      setErrorMessage('이미지는 최대 6개까지 등록할 수 있습니다.');
      inputElement.value = '';
      return;
    }

    try {
      setErrorMessage('');
      setIsUploadingImages(true);

      const nextFiles = selectedFiles.slice(0, remainCount);
      const uploadedImages: PostImageRow[] = [];

      for (const file of nextFiles) {
        const uploadedImage = await uploadPostImage(file, 'images');

        uploadedImages.unshift({
          path: uploadedImage.path,
          url: uploadedImage.url,
          width: uploadedImage.width,
          height: uploadedImage.height,
        });
      }

      setImages((previousImages) => [...uploadedImages, ...previousImages]);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '이미지 업로드에 실패했습니다.');
      } else {
        setErrorMessage('이미지 업로드에 실패했습니다.');
      }
    } finally {
      setIsUploadingImages(false);
      inputElement.value = '';
    }
  }

  async function handleDeleteGalleryImage(path: string) {
    try {
      setErrorMessage('');
      await deletePostImage(path);
      setImages((previousImages) => previousImages.filter((image) => image.path !== path));
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '이미지 삭제에 실패했습니다.');
      } else {
        setErrorMessage('이미지 삭제에 실패했습니다.');
      }
    }
  }

  async function handleUploadEditorImage(file: Blob | File) {
    const editorFile =
      file instanceof File
        ? file
        : new File([file], `editor-${Date.now()}.png`, {
            type: file.type || 'image/png',
          });

    const uploadedImage = await uploadPostImage(editorFile, 'editor');
    return uploadedImage.url;
  }

  async function handleSubmit(action: 'draft' | 'publish', event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedBoardKey) {
      setErrorMessage('게시판을 선택해주세요.');
      return;
    }

    if (
      isSubmittingDraft ||
      isSubmittingPublish ||
      isLoadingBoards ||
      isLoadingBoardMeta ||
      isUploadingThumbnail ||
      isUploadingImages
    ) {
      return;
    }

    if (action === 'publish') {
      if (postType === 'prefix' && !selectedPrefixId) {
        setErrorMessage('말머리를 선택해주세요.');
        return;
      }

      if (postType === 'series' && !selectedSeriesKey) {
        setErrorMessage('연재를 선택해주세요.');
        return;
      }
    }

    try {
      setErrorMessage('');

      if (action === 'draft') {
        setIsSubmittingDraft(true);
      } else {
        setIsSubmittingPublish(true);
      }

      const response = await fetch(`/api/boards/${selectedBoardKey}/new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          action,
          subject: isFeedBoard ? null : subject,
          summary: isBasicBoard || isFeedBoard ? null : summary,
          contentHtml: isBasicBoard || isGalleryBoard ? contentHtml : null,
          contentMarkdown: isBasicBoard || isGalleryBoard ? contentMarkdown : null,
          contentSimple: isFeedBoard ? contentSimple : null,
          thumbnailImage: thumbnailImage || null,
          thumbnailWidth,
          thumbnailHeight,
          youtubeUrl: isYoutubeBoard ? youtubeUrl : null,
          youtubeCreatedAt: isYoutubeBoard && youtubeCreatedAt ? youtubeCreatedAt : null,
          images: isGalleryBoard || isFeedBoard ? images : [],
          poll: isBasicBoard && isPollEnabled ? poll : null,
          seriesKey: selectedSeriesKey || null,
          prefixId: selectedPrefixId || null,
          isComment,
          isPin,
        }),
      });

      const result = (await response.json()) as CreateResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '글 작성에 실패했습니다.');
      }

      if (!result.contentId) {
        throw new Error('글 작성에 실패했습니다.');
      }

      if (result.publishedStatus === 'draft') {
        router.replace(`/${siteName}/${selectedBoardKey}/${result.contentId}/edit`);
        return;
      }

      if (!result.slug) {
        throw new Error('글 작성에 실패했습니다.');
      }

      router.replace(`/${siteName}/${selectedBoardKey}/${result.slug}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '글 작성에 실패했습니다.');
      } else {
        setErrorMessage('글 작성에 실패했습니다.');
      }
    } finally {
      setIsSubmittingDraft(false);
      setIsSubmittingPublish(false);
    }
  }

  if (isLoadingBoards) {
    return <p>불러오는 중...</p>;
  }

  if (boards.length === 0) {
    return <p>글을 작성할 수 있는 게시판이 없습니다.</p>;
  }

  return (
    <div className={`${styles.content} content`}>
      <h2>
        <ListAltOutlinedIcon />
        <span>글쓰기</span>
      </h2>

      {errorMessage ? <p>{errorMessage}</p> : null}

      <form onSubmit={(event) => void handleSubmit('publish', event)}>
        <div className="paper paper-p0">
          <div className={styles['board-select']}>
            <div className={styles['form-select']}>
              <select
                id="board"
                value={selectedBoardKey}
                onChange={(event) => resetBoardSpecificFields(event.currentTarget.value)}
              >
                <option value="">게시판을 선택하세요</option>
                {boards.map((board) => (
                  <option key={board.id} value={board.board_key}>
                    {board.board_label}
                  </option>
                ))}
              </select>
            </div>
            <p>게시판 선택시 입력했던 내용들이 초기화됩니다.</p>
          </div>
          <div className={styles['post-info']}>
            {isLoadingBoardMeta ? (
              <LoadingIndicator />
            ) : selectedBoard ? (
              <>
                {postType === 'prefix' ? (
                  <div>
                    <select
                      id="prefix"
                      value={selectedPrefixId}
                      onChange={(event) => setSelectedPrefixId(event.currentTarget.value)}
                    >
                      <option value="">말머리 선택</option>
                      {prefixList.map((prefix) => (
                        <option key={prefix.id} value={prefix.id}>
                          {prefix.prefix_label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}

                {postType === 'series' ? (
                  <div>
                    <select
                      id="series"
                      value={selectedSeriesKey}
                      onChange={(event) => setSelectedSeriesKey(event.currentTarget.value)}
                    >
                      <option value="">연재 선택</option>
                      {seriesList
                        .filter((series) => !series.is_completed)
                        .map((series) => (
                          <option key={series.id} value={series.series_key}>
                            {series.series_label}
                          </option>
                        ))}
                    </select>
                  </div>
                ) : null}

                {!isFeedBoard ? (
                  <div>
                    <input
                      id="subject"
                      type="text"
                      value={subject}
                      placeholder="제목을 입력해 주세요"
                      onChange={(event) => setSubject(event.currentTarget.value)}
                    />
                  </div>
                ) : null}

                {isGalleryBoard ? (
                  <div>
                    <label htmlFor="summary">부제목</label>
                    <input
                      id="summary"
                      type="text"
                      value={summary}
                      placeholder="부제목을 입력해 해주세요"
                      onChange={(event) => setSummary(event.currentTarget.value)}
                    />
                  </div>
                ) : null}

                {isYoutubeBoard ? (
                  <>
                    <div>
                      <textarea
                        id="youtube-summary"
                        value={summary}
                        placeholder="설명을 간단히 입력해주세요"
                        onChange={(event) => setSummary(event.currentTarget.value)}
                      />
                    </div>

                    <div>
                      <input
                        id="youtube-url"
                        type="text"
                        value={youtubeUrl}
                        placeholder="유튜브 영상 주소를 입력해주세요"
                        onChange={(event) => setYoutubeUrl(event.currentTarget.value)}
                      />
                    </div>

                    <input id="youtube-id" type="hidden" value={youtubeId} />

                    <div>
                      <label htmlFor="youtube-created-at">유튜브 업로드 날짜</label>
                      <input
                        id="youtube-created-at"
                        type="date"
                        value={youtubeCreatedAt}
                        onChange={(event) => setYoutubeCreatedAt(event.currentTarget.value)}
                      />
                    </div>
                  </>
                ) : null}

                {!isFeedBoard ? (
                  <div>
                    <label htmlFor="thumbnail">썸네일 이미지</label>
                    <input
                      ref={thumbnailInputReference}
                      id="thumbnail"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleThumbnailFileChange}
                    />
                    {thumbnailImageUrl ? <img src={thumbnailImageUrl} alt="썸네일 이미지" /> : null}
                  </div>
                ) : null}

                {isGalleryBoard || isFeedBoard ? (
                  <div>
                    <label htmlFor="images">이미지 업로드</label>
                    <input
                      ref={galleryInputReference}
                      id="images"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      multiple
                      onChange={handleGalleryFileChange}
                    />

                    {images.length > 0 ? (
                      <ul>
                        {images.map((image, index) => (
                          <li key={image.path}>
                            <span>{`이미지 ${index + 1}`}</span>
                            <button type="button" onClick={() => void handleDeleteGalleryImage(image.path)}>
                              삭제
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {isBasicBoard ? (
                  <div>
                    <button
                      type="button"
                      onClick={() => {
                        if (isPollEnabled) {
                          setIsPollEnabled(false);
                          setPoll(EMPTY_POLL);
                          return;
                        }

                        setIsPollEnabled(true);
                        setPoll(EMPTY_POLL);
                      }}
                    >
                      {isPollEnabled ? '투표 취소' : '투표 설정'}
                    </button>

                    {isPollEnabled ? (
                      <>
                        <div>
                          <label htmlFor="poll-question">투표 질문</label>
                          <input
                            id="poll-question"
                            type="text"
                            value={poll.question}
                            onChange={(event) =>
                              setPoll((previousPoll) => ({
                                ...previousPoll,
                                question: event.currentTarget.value,
                              }))
                            }
                          />
                        </div>

                        {poll.options.map((option, index) => (
                          <div key={index}>
                            <label htmlFor={`poll-option-${index}`}>{`선택지 ${index + 1}`}</label>
                            <input
                              id={`poll-option-${index}`}
                              type="text"
                              value={option}
                              onChange={(event) =>
                                setPoll((previousPoll) => ({
                                  ...previousPoll,
                                  options: previousPoll.options.map((item, itemIndex) =>
                                    itemIndex === index ? event.currentTarget.value : item,
                                  ),
                                }))
                              }
                            />
                          </div>
                        ))}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
          </div>{' '}
        </div>
        {isLoadingBoardMeta ? null : selectedBoard ? (
          <>
            {isFeedBoard ? (
              <div className="paper paper-p0">
                <textarea
                  id="content-simple"
                  value={contentSimple}
                  onChange={(event) => setContentSimple(event.currentTarget.value)}
                />
              </div>
            ) : null}

            {isBasicBoard || isGalleryBoard ? (
              <div className="service-editor">
                <ToastEditor
                  initialValue={contentHtml}
                  initialMarkdown={contentMarkdown}
                  initialEditType="wysiwyg"
                  themeMode="light"
                  hideModeSwitch
                  onHtmlChange={setContentHtml}
                  onMarkdownChange={setContentMarkdown}
                  onUploadImage={handleUploadEditorImage}
                />
              </div>
            ) : null}
            <div className="paper paper-p0">
              <div className={styles['post-option']}>
                <div>
                  <label htmlFor="is-comment">
                    <input
                      id="is-comment"
                      type="checkbox"
                      checked={isComment}
                      onChange={(event) => setIsComment(event.currentTarget.checked)}
                    />
                    댓글 허용
                  </label>
                </div>

                <div>
                  <label htmlFor="is-pin">
                    <input
                      id="is-pin"
                      type="checkbox"
                      checked={isPin}
                      onChange={(event) => setIsPin(event.currentTarget.checked)}
                    />
                    상단고정글 등록
                  </label>
                </div>

                <div>
                  <a href={`/${siteName}/board`}>취소</a>
                  <button
                    type="button"
                    disabled={isSubmittingDraft || isSubmittingPublish}
                    onClick={(event) => void handleSubmit('draft', event as unknown as FormEvent<HTMLFormElement>)}
                  >
                    임시 저장
                  </button>
                  <button type="submit" disabled={isSubmittingDraft || isSubmittingPublish}>
                    저장
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : null}
      </form>
    </div>
  );
}
