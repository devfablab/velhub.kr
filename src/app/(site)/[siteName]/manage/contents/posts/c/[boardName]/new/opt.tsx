'use client';

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from '@mui/material/Link';
import {
  Alert,
  Box,
  Button,
  FormControl,
  FormControlLabel,
  InputLabel,
  ListItemText,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  styled,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import ToastEditor from '@/components/editor/ToastEditor';
import { normalizeText } from '@/lib/utils';
import Container from '../../../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type CreateResponse = {
  ok?: boolean;
  slug?: string;
  contentId?: string;
  publishedStatus?: 'draft' | 'published';
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

type PrefixRow = {
  id: string;
  created_at: string;
  prefix_key: number;
  prefix_label: string;
  board_id: string;
  site_id: string;
};

type BoardInfoResponse = {
  board?: {
    board_type: 'basic' | 'gallery' | 'youtube' | 'feed';
    post_type: 'none' | 'prefix' | 'series';
    markdown_status: string | null;
  };
  error?: string;
};

type SeriesListResponse = {
  series?: SeriesRow[];
  error?: string;
};

type PrefixListResponse = {
  prefixes?: PrefixRow[];
  error?: string;
};

type PostImageRow = {
  path: string;
  url: string;
  width: number | null;
  height: number | null;
};

type EditorBlobImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type UploadResponse = {
  ok?: boolean;
  path?: string;
  url?: string;
  width?: number | null;
  height?: number | null;
  error?: string;
};

type PollState = {
  question: string;
  options: string[];
};

const MAX_EDITOR_IMAGE_FILE_SIZE = 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지 정보를 불러오지 못했습니다.'));
    };

    image.src = objectUrl;
  });
}

function canvasToWebpBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 변환에 실패했습니다.'));
          return;
        }

        resolve(blob);
      },
      'image/webp',
      quality,
    );
  });
}

function createWebpFile(blob: Blob, originalFile: File) {
  const baseName = originalFile.name.replace(/\.[^.]+$/, '') || `editor-${Date.now()}`;

  return new File([blob], `${baseName}.webp`, {
    type: 'image/webp',
  });
}

async function convertImageToWebpFile(file: File, maxSizeMessage: string) {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    throw new Error('png, jpeg, webp 이미지만 등록할 수 있습니다.');
  }

  if (file.size > MAX_EDITOR_IMAGE_FILE_SIZE) {
    throw new Error(maxSizeMessage);
  }

  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지 변환에 실패했습니다.');
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  const qualities = [0.92, 0.86, 0.8, 0.74, 0.68];

  for (const quality of qualities) {
    const nextBlob = await canvasToWebpBlob(canvas, quality);

    if (nextBlob.size <= MAX_EDITOR_IMAGE_FILE_SIZE) {
      return createWebpFile(nextBlob, file);
    }
  }

  throw new Error(maxSizeMessage);
}

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

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
  const boardName = normalizeText(params.boardName).toLowerCase();

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));

  const thumbnailInputReference = useRef<HTMLInputElement | null>(null);
  const galleryInputReference = useRef<HTMLInputElement | null>(null);
  const editorBlobImagesReference = useRef<EditorBlobImage[]>([]);

  const [boardType, setBoardType] = useState<'basic' | 'gallery' | 'youtube' | 'feed'>('basic');
  const [postType, setPostType] = useState<'none' | 'prefix' | 'series'>('none');
  const [markdownStatus, setMarkdownStatus] = useState<string | null>('markdown_default');
  const [seriesList, setSeriesList] = useState<SeriesRow[]>([]);
  const [prefixList, setPrefixList] = useState<PrefixRow[]>([]);
  const [selectedSeriesKey, setSelectedSeriesKey] = useState('');
  const [selectedPrefixId, setSelectedPrefixId] = useState('');
  const [subject, setSubject] = useState('');
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [contentSimple, setContentSimple] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeCreatedAt, setYoutubeCreatedAt] = useState<Date | null>(null);
  const [thumbnailImage, setThumbnailImage] = useState('');
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState('');
  const [thumbnailWidth, setThumbnailWidth] = useState<number | null>(null);
  const [thumbnailHeight, setThumbnailHeight] = useState<number | null>(null);
  const [images, setImages] = useState<PostImageRow[]>([]);
  const [editorBlobImages, setEditorBlobImages] = useState<EditorBlobImage[]>([]);
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [poll, setPoll] = useState<PollState>(EMPTY_POLL);
  const [isComment, setIsComment] = useState(true);
  const [isPin, setIsPin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isSubmittingPublish, setIsSubmittingPublish] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isBasicBoard = boardType === 'basic';
  const isGalleryBoard = boardType === 'gallery';
  const isYoutubeBoard = boardType === 'youtube';
  const isFeedBoard = boardType === 'feed';

  const youtubeId = useMemo(() => getYoutubeId(youtubeUrl), [youtubeUrl]);

  useEffect(() => {
    editorBlobImagesReference.current = editorBlobImages;
  }, [editorBlobImages]);

  useEffect(() => {
    return () => {
      editorBlobImagesReference.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      editorBlobImagesReference.current = [];
    };
  }, []);

  useEffect(() => {
    async function loadBoardData() {
      try {
        setErrorMessage('');

        const boardResponse = await fetch(`/api/boards/${boardName}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const boardResult = (await boardResponse.json()) as BoardInfoResponse;

        if (!boardResponse.ok) {
          throw new Error(boardResult.error ?? '게시판 정보를 불러오지 못했습니다.');
        }

        const nextBoardType = boardResult.board?.board_type ?? 'basic';
        const nextPostType = boardResult.board?.post_type ?? 'none';
        const nextMarkdownStatus = boardResult.board?.markdown_status ?? 'markdown_default';

        setBoardType(nextBoardType);
        setPostType(nextPostType);
        setMarkdownStatus(nextMarkdownStatus);

        if (nextPostType === 'series') {
          const seriesResponse = await fetch(`/api/boards/${boardName}/series?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          });

          const seriesResult = (await seriesResponse.json()) as SeriesListResponse;

          if (!seriesResponse.ok) {
            throw new Error(seriesResult.error ?? '연재 목록을 불러오지 못했습니다.');
          }

          setSeriesList(Array.isArray(seriesResult.series) ? seriesResult.series : []);
        }

        if (nextPostType === 'prefix') {
          const prefixResponse = await fetch(`/api/boards/${boardName}/prefix?siteName=${siteName}`, {
            method: 'GET',
            credentials: 'include',
          });

          const prefixResult = (await prefixResponse.json()) as PrefixListResponse;

          if (!prefixResponse.ok) {
            throw new Error(prefixResult.error ?? '말머리 목록을 불러오지 못했습니다.');
          }

          setPrefixList(Array.isArray(prefixResult.prefixes) ? prefixResult.prefixes : []);
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '게시판 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('게시판 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadBoardData();
  }, [boardName, siteName]);

  function handleSubjectChange(event: InputChangeEvent) {
    setSubject(event.currentTarget.value);
  }

  function handleSummaryChange(event: InputChangeEvent) {
    setSummary(event.currentTarget.value);
  }

  function handleContentSimpleChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setContentSimple(event.currentTarget.value);
  }

  function handleYoutubeUrlChange(event: InputChangeEvent) {
    setYoutubeUrl(event.currentTarget.value);
  }

  function handleSeriesChange(event: SelectChangeEvent<string>) {
    setSelectedSeriesKey(event.target.value);
  }

  function handlePrefixChange(event: SelectChangeEvent<string>) {
    setSelectedPrefixId(event.target.value);
  }

  function handlePollQuestionChange(event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setPoll((previousPoll) => ({
      ...previousPoll,
      question: event.currentTarget.value,
    }));
  }

  function handlePollOptionChange(index: number, event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const nextValue = event.currentTarget.value;

    setPoll((previousPoll) => ({
      ...previousPoll,
      options: previousPoll.options.map((option, optionIndex) => (optionIndex === index ? nextValue : option)),
    }));
  }

  function handleEnablePoll() {
    setIsPollEnabled(true);
    setPoll(EMPTY_POLL);
  }

  function handleDisablePoll() {
    setIsPollEnabled(false);
    setPoll(EMPTY_POLL);
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

  function handleClickThumbnailUpload() {
    if (isUploadingThumbnail) {
      return;
    }

    thumbnailInputReference.current?.click();
  }

  async function handleThumbnailFileChange(event: InputChangeEvent) {
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

  function handleClickGalleryUpload() {
    if (isUploadingImages) {
      return;
    }

    galleryInputReference.current?.click();
  }

  async function handleGalleryFileChange(event: InputChangeEvent) {
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

    if (!ACCEPTED_IMAGE_TYPES.includes(editorFile.type)) {
      throw new Error('png, jpeg, webp 이미지만 등록할 수 있습니다.');
    }

    if (editorFile.size > MAX_EDITOR_IMAGE_FILE_SIZE) {
      throw new Error('이미지는 1MB 이하로 등록해주세요.');
    }

    const previewUrl = URL.createObjectURL(editorFile);

    const nextImage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      file: editorFile,
      previewUrl,
    };

    editorBlobImagesReference.current = [...editorBlobImagesReference.current, nextImage];
    setEditorBlobImages(editorBlobImagesReference.current);

    return previewUrl;
  }

  function replaceAllImageUrl(value: string, fromUrl: string, toUrl: string) {
    return value.split(fromUrl).join(toUrl);
  }

  async function uploadEditorImagesIfNeeded() {
    const currentEditorBlobImages = editorBlobImagesReference.current;

    if (currentEditorBlobImages.length === 0) {
      return {
        contentHtml,
        contentMarkdown,
      };
    }

    let nextContentHtml = contentHtml;
    let nextContentMarkdown = contentMarkdown;
    const usedPreviewUrls = new Set<string>();

    for (const image of currentEditorBlobImages) {
      const isUsedInHtml = nextContentHtml.includes(image.previewUrl);
      const isUsedInMarkdown = nextContentMarkdown.includes(image.previewUrl);

      if (!isUsedInHtml && !isUsedInMarkdown) {
        URL.revokeObjectURL(image.previewUrl);
        continue;
      }

      const webpFile = await convertImageToWebpFile(image.file, '이미지는 1MB 이하로 등록해주세요.');
      const uploadedImage = await uploadPostImage(webpFile, 'editor');

      nextContentHtml = replaceAllImageUrl(nextContentHtml, image.previewUrl, uploadedImage.url);
      nextContentMarkdown = replaceAllImageUrl(nextContentMarkdown, image.previewUrl, uploadedImage.url);
      usedPreviewUrls.add(image.previewUrl);

      URL.revokeObjectURL(image.previewUrl);
    }

    const remainingEditorBlobImages = currentEditorBlobImages.filter((image) => !usedPreviewUrls.has(image.previewUrl));

    editorBlobImagesReference.current = remainingEditorBlobImages;
    setContentHtml(nextContentHtml);
    setContentMarkdown(nextContentMarkdown);
    setEditorBlobImages(remainingEditorBlobImages);

    return {
      contentHtml: nextContentHtml,
      contentMarkdown: nextContentMarkdown,
    };
  }

  async function handleSubmit(action: 'draft' | 'publish', event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmittingDraft || isSubmittingPublish || isLoading || isUploadingThumbnail || isUploadingImages) {
      return;
    }

    try {
      setErrorMessage('');

      if (action === 'draft') {
        setIsSubmittingDraft(true);
      } else {
        setIsSubmittingPublish(true);
      }

      const uploadedEditorContent = await uploadEditorImagesIfNeeded();

      const response = await fetch(`/api/boards/${boardName}/new`, {
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
          contentHtml: isBasicBoard || isGalleryBoard ? uploadedEditorContent.contentHtml : null,
          contentMarkdown: isBasicBoard || isGalleryBoard ? uploadedEditorContent.contentMarkdown : null,
          contentSimple: isFeedBoard ? contentSimple : null,
          thumbnailImage: thumbnailImage || null,
          thumbnailWidth,
          thumbnailHeight,
          youtubeUrl: isYoutubeBoard ? youtubeUrl : null,
          youtubeCreatedAt: isYoutubeBoard && youtubeCreatedAt ? youtubeCreatedAt.toISOString().slice(0, 10) : null,
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
        router.replace(`/${siteName}/manage/contents/posts/c/${boardName}/${result.contentId}/edit`);
        return;
      }

      if (!result.slug) {
        throw new Error('글 작성에 실패했습니다.');
      }

      router.replace(`/${siteName}/manage/contents/posts/c/${boardName}/${result.slug}`);
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

  if (isLoading) {
    return null;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Container pageTitle="새 글 쓰기" menu="contents">
        <div className="container">
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <Stack component="form" spacing={2.5} onSubmit={(event) => void handleSubmit('publish', event)}>
              {!isFeedBoard ? (
                <TextField label="제목 (필수)" value={subject} onChange={handleSubjectChange} fullWidth size="small" />
              ) : null}

              {isGalleryBoard ? (
                <TextField label="부제목" value={summary} onChange={handleSummaryChange} fullWidth size="small" />
              ) : null}

              {isYoutubeBoard ? (
                <>
                  <TextField
                    label="간단 설명 (필수)"
                    value={summary}
                    onChange={handleSummaryChange}
                    fullWidth
                    multiline
                    rows={5}
                    size="small"
                  />
                  <TextField
                    label="유튜브 영상 주소 (필수)"
                    value={youtubeUrl}
                    onChange={handleYoutubeUrlChange}
                    fullWidth
                    size="small"
                  />
                  <TextField
                    label="유튜브 영상 ID"
                    value={youtubeId}
                    fullWidth
                    size="small"
                    slotProps={{ input: { readOnly: true, disabled: true } }}
                  />
                  <DatePicker
                    label="유튜브 업로드 날짜 (필수)"
                    value={youtubeCreatedAt}
                    onChange={(value) => setYoutubeCreatedAt(value)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        size: 'small',
                      },
                    }}
                  />
                </>
              ) : null}

              {postType === 'prefix' ? (
                <FormControl fullWidth size="small">
                  <InputLabel id="community-post-prefix-select-label">말머리</InputLabel>
                  <Select
                    labelId="community-post-prefix-select-label"
                    value={selectedPrefixId}
                    onChange={handlePrefixChange}
                    input={<OutlinedInput label="말머리" />}
                  >
                    <MenuItem value="">
                      <ListItemText primary="선택 안함" />
                    </MenuItem>
                    {prefixList.map((prefix) => (
                      <MenuItem key={prefix.id} value={prefix.id}>
                        <ListItemText primary={prefix.prefix_label} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}

              {postType === 'series' ? (
                <>
                  <FormControl fullWidth size="small">
                    <InputLabel id="community-post-series-select-label">연재</InputLabel>
                    <Select
                      labelId="community-post-series-select-label"
                      value={selectedSeriesKey}
                      onChange={handleSeriesChange}
                      input={<OutlinedInput label="연재" />}
                    >
                      {seriesList
                        .filter((series) => !series.is_completed)
                        .map((series) => (
                          <MenuItem key={series.id} value={series.series_key}>
                            <ListItemText primary={series.series_label} />
                          </MenuItem>
                        ))}
                    </Select>
                  </FormControl>
                  <Alert variant="outlined" severity="warning">
                    연재는 한번 설정되면 변경하실 수 없습니다. 주의하세요.
                  </Alert>
                </>
              ) : null}

              {!isFeedBoard ? (
                <Box>
                  <Typography sx={{ mb: 1 }}>{isBasicBoard ? '썸네일 이미지' : '오픈 그래프 이미지'}</Typography>

                  {isGalleryBoard ? (
                    <Alert severity="info" variant="outlined" sx={{ mb: 1.5 }}>
                      검색엔진이나 소셜 미디어에 링크를 올릴 때 미리보기 이미지로 사용됩니다.
                    </Alert>
                  ) : null}

                  {thumbnailImageUrl ? (
                    <Box
                      component="img"
                      src={thumbnailImageUrl}
                      alt="썸네일 이미지"
                      sx={{ width: '100%', maxWidth: 480, display: 'block', mb: 1.5 }}
                    />
                  ) : null}

                  <VisuallyHiddenInput
                    ref={thumbnailInputReference}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleThumbnailFileChange}
                  />

                  <Button
                    type="button"
                    variant="outlined"
                    onClick={handleClickThumbnailUpload}
                    disabled={isUploadingThumbnail}
                  >
                    {thumbnailImageUrl ? '이미지 교체' : '이미지 추가'}
                  </Button>
                </Box>
              ) : null}

              {isGalleryBoard || isFeedBoard ? (
                <Box>
                  <ul>
                    <Typography variant="body2" component="li">
                      이미지는 최대 6개까지 등록할 수 있습니다.
                    </Typography>
                    <Typography variant="body2" component="li">
                      1개 이상 등록해야 하며, 순서 변경은 불가능합니다.
                    </Typography>
                    <Typography variant="body2" component="li">
                      이미지는 업로드한 순서대로 정렬되고, 마지막에 등록한 이미지가 가장 앞에 표시됩니다.
                    </Typography>
                  </ul>

                  <VisuallyHiddenInput
                    ref={galleryInputReference}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    onChange={handleGalleryFileChange}
                  />

                  <Button
                    type="button"
                    variant="outlined"
                    onClick={handleClickGalleryUpload}
                    disabled={isUploadingImages}
                  >
                    이미지 업로드
                  </Button>

                  {images.length > 0 ? (
                    <Stack spacing={1.5} sx={{ mt: 1.5 }}>
                      {images.map((image, index) => (
                        <Stack key={image.path} spacing={1}>
                          <Typography variant="body2">{`이미지 ${index + 1}`}</Typography>
                          <Box
                            component="img"
                            src={image.url}
                            alt={`업로드 이미지 ${index + 1}`}
                            sx={{ width: '100%', maxWidth: 480, display: 'block' }}
                          />
                          <Stack direction="row">
                            <Button
                              type="button"
                              variant="outlined"
                              color="error"
                              onClick={() => void handleDeleteGalleryImage(image.path)}
                            >
                              삭제
                            </Button>
                          </Stack>
                        </Stack>
                      ))}
                    </Stack>
                  ) : null}
                </Box>
              ) : null}

              {isFeedBoard ? (
                <TextField
                  label="내용 (필수)"
                  value={contentSimple}
                  onChange={handleContentSimpleChange}
                  fullWidth
                  multiline
                  minRows={6}
                  size="small"
                />
              ) : null}

              {isBasicBoard || isGalleryBoard ? (
                <Box>
                  <Typography sx={{ mb: 1 }}>{isGalleryBoard ? '내용' : '내용 (필수)'}</Typography>
                  <ToastEditor
                    initialValue={contentHtml}
                    initialMarkdown={contentMarkdown}
                    initialEditType="wysiwyg"
                    themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                    markdownStatus={markdownStatus}
                    hideModeSwitch
                    onHtmlChange={setContentHtml}
                    onMarkdownChange={setContentMarkdown}
                    onUploadImage={handleUploadEditorImage}
                  />
                </Box>
              ) : null}

              <FormControlLabel
                control={<Switch checked={isComment} onChange={(event) => setIsComment(event.target.checked)} />}
                label={isComment ? '댓글 허용' : '댓글 차단'}
              />

              <FormControlLabel
                control={<Switch checked={isPin} onChange={(event) => setIsPin(event.target.checked)} />}
                label={isPin ? '상단고정글 등록' : '상단고정글 미등록'}
              />

              {isBasicBoard ? (
                <Stack spacing={1.5}>
                  <Stack direction="row" spacing={1}>
                    <Button
                      type="button"
                      variant="outlined"
                      onClick={isPollEnabled ? handleDisablePoll : handleEnablePoll}
                    >
                      {isPollEnabled ? '투표 취소' : '투표 설정'}
                    </Button>
                  </Stack>

                  {isPollEnabled ? (
                    <>
                      <TextField
                        label="투표 질문"
                        value={poll.question}
                        onChange={handlePollQuestionChange}
                        fullWidth
                        size="small"
                      />

                      {poll.options.map((option, index) => (
                        <TextField
                          key={index}
                          label={`선택지 ${index + 1}`}
                          value={option}
                          onChange={(event) => handlePollOptionChange(index, event)}
                          fullWidth
                          size="small"
                        />
                      ))}

                      <Alert severity="warning" variant="outlined">
                        글이 게시된 이후에는 투표를 수정하실 수 없습니다. 유의하세요.
                      </Alert>
                    </>
                  ) : null}
                </Stack>
              ) : null}

              <Stack direction="row" spacing={1.5}>
                <Button
                  component={Link}
                  href={`/${siteName}/manage/contents/posts/c/${boardName}`}
                  underline="none"
                  variant="outlined"
                  size="large"
                >
                  취소
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  disabled={isSubmittingDraft || isSubmittingPublish}
                  size="large"
                  onClick={(event) => void handleSubmit('draft', event as unknown as FormSubmitEvent)}
                >
                  임시 저장
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmittingDraft || isSubmittingPublish}
                  size="large"
                >
                  저장
                </Button>
              </Stack>

              {errorMessage ? (
                <Alert severity="error" variant="filled">
                  {errorMessage}
                </Alert>
              ) : null}
            </Stack>
          </div>
        </div>
      </Container>
    </LocalizationProvider>
  );
}
