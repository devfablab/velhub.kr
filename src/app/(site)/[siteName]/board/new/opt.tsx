'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import Dialog from '@mui/material/Dialog';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import CropOriginalOutlinedIcon from '@mui/icons-material/CropOriginalOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { Divider, FormControlLabel, FormGroup, MenuItem, Select, SelectChangeEvent, useTheme } from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ko } from 'date-fns/locale';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import ToastEditor from '@/components/editor/ToastEditor';
import styles from '@/app/board.module.sass';

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
  actions?: {
    canPinPost?: boolean;
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

type GalleryBlobImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type PollState = {
  question: string;
  options: string[];
};

type AccessDialogType = 'login' | 'join' | 'pending' | null;

const EMPTY_POLL: PollState = {
  question: '',
  options: ['', '', '', '', ''],
};

const MAX_THUMBNAIL_FILE_SIZE = 1024 * 1024;
const MAX_GALLERY_IMAGE_COUNT = 9;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

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

function formatDateValue(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function parseDateValue(value: string) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  const dateValue = new Date(`${normalizedValue}T00:00:00`);

  if (Number.isNaN(dateValue.getTime())) {
    return null;
  }

  return dateValue;
}

function createLocalId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadImageFromFile(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      reject(new Error('이미지를 불러오지 못했습니다.'));
    };

    image.src = imageUrl;
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

async function convertImageToWebpFile(file: File) {
  const image = await loadImageFromFile(file);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('이미지 변환에 실패했습니다.');
  }

  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  context.drawImage(image, 0, 0);

  const qualitySteps = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5];
  let convertedBlob: Blob | null = null;

  for (const quality of qualitySteps) {
    const nextBlob = await canvasToWebpBlob(canvas, quality);

    if (nextBlob.size <= MAX_THUMBNAIL_FILE_SIZE) {
      convertedBlob = nextBlob;
      break;
    }

    convertedBlob = nextBlob;
  }

  if (!convertedBlob || convertedBlob.size > MAX_THUMBNAIL_FILE_SIZE) {
    throw new Error('썸네일 이미지는 1MB 이하로 등록해주세요.');
  }

  const filename = `${file.name.replace(/\.[^.]+$/, '') || `thumbnail-${Date.now()}`}.webp`;

  return new File([convertedBlob], filename, {
    type: 'image/webp',
  });
}

export default function Opt() {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const theme = useTheme();

  const thumbnailDialogInputReference = useRef<HTMLInputElement | null>(null);
  const galleryDialogInputReference = useRef<HTMLInputElement | null>(null);
  const prefixSelectReference = useRef<HTMLDivElement | null>(null);
  const seriesSelectReference = useRef<HTMLDivElement | null>(null);

  const [accessDialogType, setAccessDialogType] = useState<AccessDialogType>(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [selectedBoardKey, setSelectedBoardKey] = useState('');
  const [boardType, setBoardType] = useState<'basic' | 'gallery' | 'youtube' | 'feed'>('basic');
  const [postType, setPostType] = useState<'none' | 'prefix' | 'series'>('none');
  const [prefixList, setPrefixList] = useState<PrefixRow[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRow[]>([]);
  const [selectedPrefixId, setSelectedPrefixId] = useState('');
  const [selectedSeriesKey, setSelectedSeriesKey] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectPaddingLeft, setSubjectPaddingLeft] = useState(12);
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
  const [thumbnailBlobFile, setThumbnailBlobFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState('');
  const [thumbnailDialogOpen, setThumbnailDialogOpen] = useState(false);
  const [thumbnailDialogFile, setThumbnailDialogFile] = useState<File | null>(null);
  const [thumbnailDialogPreviewUrl, setThumbnailDialogPreviewUrl] = useState('');
  const [thumbnailDialogMessage, setThumbnailDialogMessage] = useState('');
  const [images, setImages] = useState<PostImageRow[]>([]);
  const [galleryBlobImages, setGalleryBlobImages] = useState<GalleryBlobImage[]>([]);
  const [galleryDialogOpen, setGalleryDialogOpen] = useState(false);
  const [galleryDialogImages, setGalleryDialogImages] = useState<PostImageRow[]>([]);
  const [galleryDialogBlobImages, setGalleryDialogBlobImages] = useState<GalleryBlobImage[]>([]);
  const [galleryDialogMessage, setGalleryDialogMessage] = useState('');
  const [isComment, setIsComment] = useState(true);
  const [isPin, setIsPin] = useState(false);
  const [canPinPost, setCanPinPost] = useState(false);
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
  const galleryDialogImageCount = galleryDialogImages.length + galleryDialogBlobImages.length;

  const accessDialog = useMemo(() => {
    if (accessDialogType === 'login') {
      return {
        open: true,
        title: '로그인 필요',
        content: '로그인이 필요한 서비스입니다.',
        cancelLabel: '취소',
        confirmLabel: '로그인',
        onCancel: () => router.replace(`/${siteName}/board`),
        onConfirm: () => router.push('/auth/sign-in'),
      };
    }

    if (accessDialogType === 'join') {
      return {
        open: true,
        title: '커뮤니티 가입 필요',
        content: '커뮤니티 가입 후 이용할 수 있습니다.',
        cancelLabel: '취소',
        confirmLabel: '가입하기',
        onCancel: () => router.replace(`/${siteName}/board`),
        onConfirm: () => router.push(`/${siteName}/join`),
      };
    }

    if (accessDialogType === 'pending') {
      return {
        open: true,
        title: '가입 승인 대기 중',
        content: '가입 신청이 완료되었지만 아직 승인되지 않았습니다.\n운영자 승인 후 글을 작성할 수 있습니다.',
        cancelLabel: null,
        confirmLabel: '확인',
        onCancel: () => router.replace(`/${siteName}/board`),
        onConfirm: () => router.replace(`/${siteName}/board`),
      };
    }

    return {
      open: false,
      title: '',
      content: '',
      cancelLabel: null,
      confirmLabel: '',
      onCancel: () => undefined,
      onConfirm: () => undefined,
    };
  }, [accessDialogType, router, siteName]);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
    };
  }, [thumbnailPreviewUrl]);

  useEffect(() => {
    return () => {
      if (thumbnailDialogPreviewUrl) {
        URL.revokeObjectURL(thumbnailDialogPreviewUrl);
      }
    };
  }, [thumbnailDialogPreviewUrl]);

  useEffect(() => {
    return () => {
      galleryBlobImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      galleryDialogBlobImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          const message = result.error ?? '게시판 목록을 불러오지 못했습니다.';
          throw new Error(message);
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
        setIsPin(false);
        setCanPinPost(false);
        return;
      }

      try {
        setAlertMessage('');
        setAccessDialogType(null);
        setIsLoadingBoardMeta(true);
        setSelectedPrefixId('');
        setSelectedSeriesKey('');

        const boardResponse = await fetch(`/api/boards/${selectedBoardKey}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const boardResult = (await boardResponse.json()) as BoardInfoResponse;

        if (!boardResponse.ok) {
          const message = boardResult.error ?? '게시판 정보를 불러오지 못했습니다.';

          if (message === '로그인이 필요한 서비스입니다.') {
            setAccessDialogType('login');
            return;
          }

          if (message === '커뮤니티 가입 후 이용할 수 있습니다.') {
            setAccessDialogType('join');
            return;
          }

          if (
            message === '가입 신청이 완료되었지만 아직 승인되지 않았습니다.\n운영자 승인 후 글을 작성할 수 있습니다.'
          ) {
            setAccessDialogType('pending');
            return;
          }

          throw new Error(message);
        }

        const nextBoardType = boardResult.board?.board_type ?? 'basic';
        const nextPostType = boardResult.board?.post_type ?? 'none';

        setBoardType(nextBoardType);
        setPostType(nextPostType);
        setCanPinPost(boardResult.actions?.canPinPost === true);
        setIsPin(false);
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
          setAlertMessage(unknownError.message || '게시판 정보를 불러오지 못했습니다.');
        } else {
          setAlertMessage('게시판 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoadingBoardMeta(false);
      }
    }

    void loadBoardMeta();
  }, [selectedBoardKey, siteName]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      if (postType === 'prefix') {
        const width = prefixSelectReference.current?.getBoundingClientRect().width ?? 0;
        setSubjectPaddingLeft(Math.ceil(width) + 12);
        return;
      }

      if (postType === 'series') {
        const width = seriesSelectReference.current?.getBoundingClientRect().width ?? 0;
        setSubjectPaddingLeft(Math.ceil(width) + 12);
        return;
      }

      setSubjectPaddingLeft(12);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [postType, prefixList, seriesList, selectedPrefixId, selectedSeriesKey, selectedBoardKey, isLoadingBoardMeta]);

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
    setThumbnailBlobFile(null);
    setImages([]);
    setGalleryBlobImages([]);
    setIsPin(false);
    setCanPinPost(false);
    setIsPollEnabled(false);
    setPoll(EMPTY_POLL);
    setErrorMessage('');
    setAlertMessage('');
    setAccessDialogType(null);

    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
      setThumbnailPreviewUrl('');
    }
  }

  function openThumbnailDialog() {
    setThumbnailDialogFile(thumbnailBlobFile);
    setThumbnailDialogMessage('');

    if (thumbnailDialogPreviewUrl) {
      URL.revokeObjectURL(thumbnailDialogPreviewUrl);
    }

    if (thumbnailBlobFile) {
      setThumbnailDialogPreviewUrl(URL.createObjectURL(thumbnailBlobFile));
    } else {
      setThumbnailDialogPreviewUrl(thumbnailPreviewUrl || thumbnailImageUrl);
    }

    setThumbnailDialogOpen(true);
  }

  function closeThumbnailDialog() {
    setThumbnailDialogOpen(false);
    setThumbnailDialogFile(null);
    setThumbnailDialogMessage('');

    if (thumbnailDialogPreviewUrl && thumbnailDialogPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(thumbnailDialogPreviewUrl);
    }

    setThumbnailDialogPreviewUrl('');

    if (thumbnailDialogInputReference.current) {
      thumbnailDialogInputReference.current.value = '';
    }
  }

  function applyThumbnailDialogImage() {
    if (!thumbnailDialogFile) {
      setThumbnailDialogMessage('업로드할 이미지를 선택해주세요.');
      return;
    }

    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
    }

    setThumbnailBlobFile(thumbnailDialogFile);
    setThumbnailPreviewUrl(URL.createObjectURL(thumbnailDialogFile));
    setThumbnailDialogOpen(false);
    setThumbnailDialogFile(null);
    setThumbnailDialogMessage('');

    if (thumbnailDialogPreviewUrl && thumbnailDialogPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(thumbnailDialogPreviewUrl);
    }

    setThumbnailDialogPreviewUrl('');

    if (thumbnailDialogInputReference.current) {
      thumbnailDialogInputReference.current.value = '';
    }
  }

  function handleThumbnailDialogFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (selectedFile.size > MAX_THUMBNAIL_FILE_SIZE) {
      setThumbnailDialogMessage('썸네일 이미지는 1MB 이하로 등록해주세요.');
      event.currentTarget.value = '';
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(selectedFile.type)) {
      setThumbnailDialogMessage('png, jpg, webp 이미지만 등록할 수 있습니다.');
      event.currentTarget.value = '';
      return;
    }

    if (thumbnailDialogPreviewUrl && thumbnailDialogPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(thumbnailDialogPreviewUrl);
    }

    setThumbnailDialogFile(selectedFile);
    setThumbnailDialogPreviewUrl(URL.createObjectURL(selectedFile));
    setThumbnailDialogMessage('');
  }

  function openGalleryDialog() {
    setGalleryDialogImages(images);
    setGalleryDialogBlobImages(galleryBlobImages);
    setGalleryDialogMessage('');
    setGalleryDialogOpen(true);

    if (galleryDialogInputReference.current) {
      galleryDialogInputReference.current.value = '';
    }
  }

  function closeGalleryDialog() {
    galleryDialogBlobImages.forEach((image) => {
      const isCommitted = galleryBlobImages.some((committedImage) => committedImage.id === image.id);

      if (!isCommitted) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });

    setGalleryDialogOpen(false);
    setGalleryDialogImages([]);
    setGalleryDialogBlobImages([]);
    setGalleryDialogMessage('');

    if (galleryDialogInputReference.current) {
      galleryDialogInputReference.current.value = '';
    }
  }

  function applyGalleryDialogImages() {
    const totalCount = galleryDialogImages.length + galleryDialogBlobImages.length;

    if (totalCount === 0) {
      setGalleryDialogMessage('이미지를 추가해주세요.');
      return;
    }

    galleryBlobImages.forEach((image) => {
      const isStillSelected = galleryDialogBlobImages.some((dialogImage) => dialogImage.id === image.id);

      if (!isStillSelected) {
        URL.revokeObjectURL(image.previewUrl);
      }
    });

    setImages(galleryDialogImages);
    setGalleryBlobImages(galleryDialogBlobImages);
    setGalleryDialogOpen(false);
    setGalleryDialogImages([]);
    setGalleryDialogBlobImages([]);
    setGalleryDialogMessage('');

    if (galleryDialogInputReference.current) {
      galleryDialogInputReference.current.value = '';
    }
  }

  function handleGalleryDialogFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.currentTarget.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    const currentCount = galleryDialogImages.length + galleryDialogBlobImages.length;

    if (currentCount + selectedFiles.length > MAX_GALLERY_IMAGE_COUNT) {
      setGalleryDialogMessage('이미지는 9개를 초과할 수 없습니다');
      event.currentTarget.value = '';
      return;
    }

    const invalidFile = selectedFiles.find((file) => !ACCEPTED_IMAGE_TYPES.includes(file.type));

    if (invalidFile) {
      setGalleryDialogMessage('png, jpg, webp 이미지만 등록할 수 있습니다.');
      event.currentTarget.value = '';
      return;
    }

    const nextImages = selectedFiles.map((file) => ({
      id: createLocalId(),
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setGalleryDialogBlobImages((previousImages) => [...nextImages, ...previousImages]);
    setGalleryDialogMessage('');
    event.currentTarget.value = '';
  }

  function removeGalleryDialogServerImage(path: string) {
    setGalleryDialogImages((previousImages) => previousImages.filter((image) => image.path !== path));
    setGalleryDialogMessage('');
  }

  function removeGalleryDialogBlobImage(id: string) {
    setGalleryDialogBlobImages((previousImages) => {
      const targetImage = previousImages.find((image) => image.id === id);
      const isCommitted = galleryBlobImages.some((image) => image.id === id);

      if (targetImage && !isCommitted) {
        URL.revokeObjectURL(targetImage.previewUrl);
      }

      return previousImages.filter((image) => image.id !== id);
    });

    setGalleryDialogMessage('');
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

  async function uploadThumbnailIfNeeded() {
    if (!thumbnailBlobFile) {
      return {
        thumbnailImage,
        thumbnailImageUrl,
        thumbnailWidth,
        thumbnailHeight,
      };
    }

    const webpThumbnailFile = await convertImageToWebpFile(thumbnailBlobFile);
    const uploadedThumbnail = await uploadPostImage(webpThumbnailFile, 'thumbnail');

    if (thumbnailImage) {
      await deletePostImage(thumbnailImage);
    }

    setThumbnailImage(uploadedThumbnail.path);
    setThumbnailImageUrl(uploadedThumbnail.url);
    setThumbnailWidth(uploadedThumbnail.width);
    setThumbnailHeight(uploadedThumbnail.height);
    setThumbnailBlobFile(null);

    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
      setThumbnailPreviewUrl('');
    }

    return {
      thumbnailImage: uploadedThumbnail.path,
      thumbnailImageUrl: uploadedThumbnail.url,
      thumbnailWidth: uploadedThumbnail.width,
      thumbnailHeight: uploadedThumbnail.height,
    };
  }

  async function uploadGalleryImagesIfNeeded() {
    if (galleryBlobImages.length === 0) {
      return images;
    }

    setIsUploadingImages(true);

    try {
      const uploadedImages: PostImageRow[] = [];

      for (const image of galleryBlobImages) {
        const uploadedImage = await uploadPostImage(image.file, 'images');

        uploadedImages.push({
          path: uploadedImage.path,
          url: uploadedImage.url,
          width: uploadedImage.width,
          height: uploadedImage.height,
        });
      }

      const nextImages = [...uploadedImages, ...images];

      setImages(nextImages);
      galleryBlobImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      setGalleryBlobImages([]);

      return nextImages;
    } finally {
      setIsUploadingImages(false);
    }
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

      const uploadedThumbnail = await uploadThumbnailIfNeeded();
      const uploadedImages = await uploadGalleryImagesIfNeeded();

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
          thumbnailImage: uploadedThumbnail.thumbnailImage || null,
          thumbnailWidth: uploadedThumbnail.thumbnailWidth,
          thumbnailHeight: uploadedThumbnail.thumbnailHeight,
          youtubeUrl: isYoutubeBoard ? youtubeUrl : null,
          youtubeCreatedAt: isYoutubeBoard && youtubeCreatedAt ? youtubeCreatedAt : null,
          images: isGalleryBoard || isFeedBoard ? uploadedImages : [],
          poll: isBasicBoard && isPollEnabled ? poll : null,
          seriesKey: selectedSeriesKey || null,
          prefixId: selectedPrefixId || null,
          isComment,
          isPin: canPinPost ? isPin : false,
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
    return (
      <div className={`${styles.content} content`}>
        <h2>
          <ListAltOutlinedIcon />
          <span>글쓰기</span>
        </h2>
        <div className="paper">
          <div className="loading-container">
            <LoadingIndicator />
          </div>
        </div>
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className={`${styles.content} content`}>
        <h2>
          <ListAltOutlinedIcon />
          <span>글쓰기</span>
        </h2>
        <div className="paper">글을 작성할 수 있는 게시판이 없습니다.</div>
      </div>
    );
  }

  return (
    <div className={`${styles.content} content`}>
      <h2>
        <ListAltOutlinedIcon />
        <span>글쓰기</span>
      </h2>

      {errorMessage ? <div className="paper paper-error">{errorMessage}</div> : null}

      <form onSubmit={(event) => void handleSubmit('publish', event)} className={`${styles.form} form`}>
        <fieldset>
          <legend>글쓰기 폼</legend>
          <div className="paper">
            <div className={styles['board-select']}>
              <div className={styles['form-select']}>
                <Select
                  displayEmpty
                  value={selectedBoardKey}
                  onChange={(event: SelectChangeEvent) => resetBoardSpecificFields(event.target.value)}
                  className={styles['MuiInputBase-root']}
                >
                  <MenuItem value="">게시판을 선택하세요</MenuItem>
                  {boards.map((board) => (
                    <MenuItem key={board.id} value={board.board_key}>
                      {board.board_label}
                    </MenuItem>
                  ))}
                </Select>
              </div>
              <p>게시판 선택시 입력했던 내용들이 초기화됩니다.</p>
            </div>

            {isLoadingBoardMeta ? (
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            ) : selectedBoard ? (
              <>
                {!isFeedBoard ? (
                  <div className={styles['post-info']}>
                    <div className={styles['form-group']}>
                      {postType === 'prefix' ? (
                        <div ref={prefixSelectReference} className={styles['form-select']}>
                          <Select
                            displayEmpty
                            value={selectedPrefixId}
                            onChange={(event: SelectChangeEvent) => setSelectedPrefixId(event.target.value)}
                            className={styles['MuiInputBase-root']}
                          >
                            <MenuItem value="">말머리 선택</MenuItem>
                            {prefixList.map((prefix) => (
                              <MenuItem key={prefix.id} value={prefix.id}>
                                {prefix.prefix_label}
                              </MenuItem>
                            ))}
                          </Select>
                        </div>
                      ) : null}

                      {postType === 'series' ? (
                        <div ref={seriesSelectReference} className={styles['form-select']}>
                          <Select
                            displayEmpty
                            value={selectedSeriesKey}
                            onChange={(event: SelectChangeEvent) => setSelectedSeriesKey(event.target.value)}
                            className={styles['MuiInputBase-root']}
                          >
                            <MenuItem value="">연재 선택</MenuItem>
                            {seriesList
                              .filter((series) => !series.is_completed)
                              .map((series) => (
                                <MenuItem key={series.id} value={series.series_key}>
                                  {series.series_label}
                                </MenuItem>
                              ))}
                          </Select>
                        </div>
                      ) : null}

                      <div className={styles['form-control']}>
                        <input
                          type="text"
                          value={subject}
                          placeholder="제목을 입력해 주세요"
                          style={{ paddingLeft: subjectPaddingLeft }}
                          onChange={(event) => setSubject(event.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
                {isGalleryBoard ? (
                  <div className={styles['post-info']}>
                    <div className={styles['form-group']}>
                      <div className={styles['form-control']}>
                        <input
                          type="text"
                          value={summary}
                          placeholder="부제목을 입력해 해주세요"
                          style={{ paddingLeft: 12 }}
                          onChange={(event) => setSummary(event.currentTarget.value)}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
                {isYoutubeBoard ? (
                  <div className={`${styles['post-info']} ${styles['post-row']}`}>
                    <input id="youtube-id" type="hidden" value={youtubeId} />
                    <div className={styles['form-group']}>
                      <div className={styles['form-control']}>
                        <input
                          id="youtube-url"
                          type="text"
                          value={youtubeUrl}
                          placeholder="유튜브 영상 주소를 입력해주세요"
                          style={{ paddingLeft: 12 }}
                          onChange={(event) => setYoutubeUrl(event.currentTarget.value)}
                        />
                      </div>
                    </div>
                    <div className={styles['form-group']}>
                      <label htmlFor="youtube-created-at">유튜브 업로드 날짜</label>
                      <div className={styles['form-control']}>
                        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                          <DatePicker
                            value={parseDateValue(youtubeCreatedAt)}
                            onChange={(value) => setYoutubeCreatedAt(formatDateValue(value))}
                            className={styles['MuiFormControl-root']}
                            slotProps={{
                              textField: {
                                fullWidth: true,
                                size: 'small',
                              },
                            }}
                          />
                        </LocalizationProvider>
                      </div>
                    </div>
                  </div>
                ) : null}
                <div className={`${styles['post-info']} ${styles['post-row']}`}>
                  {!isFeedBoard ? (
                    <div className={styles.image}>
                      <button type="button" onClick={openThumbnailDialog}>
                        <CropOriginalOutlinedIcon />
                        <span>썸네일 이미지</span>
                      </button>
                    </div>
                  ) : null}

                  {isGalleryBoard || isFeedBoard ? (
                    <div className={styles.image}>
                      <button type="button" onClick={openGalleryDialog}>
                        <CollectionsOutlinedIcon />
                        <span>갤러리 이미지</span>
                      </button>
                    </div>
                  ) : null}

                  {isBasicBoard ? (
                    <div className={styles.image}>
                      <button type="button">
                        <HowToVoteOutlinedIcon />
                        <span>투표</span>
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
                </div>
              </>
            ) : null}
          </div>

          {isLoadingBoardMeta ? null : selectedBoard ? (
            <>
              {isFeedBoard ? (
                <div className="paper paper-p0">
                  <textarea
                    className={styles['content-simple']}
                    value={contentSimple}
                    placeholder="당신의 이야기에 모두가 귀 기울이고 있습니다..."
                    onChange={(event) => setContentSimple(event.currentTarget.value)}
                  />
                </div>
              ) : null}

              {isYoutubeBoard ? (
                <div className="paper paper-p0">
                  <textarea
                    className={styles['content-simple']}
                    value={summary}
                    placeholder="영상설명을 간단히 입력해주세요"
                    onChange={(event) => setSummary(event.currentTarget.value)}
                  />
                </div>
              ) : null}

              {isBasicBoard || isGalleryBoard ? (
                <div className={`${styles.editor} service-editor`}>
                  <ToastEditor
                    initialValue={contentHtml}
                    initialMarkdown={contentMarkdown}
                    initialEditType="wysiwyg"
                    themeMode={theme.palette.mode === 'dark' ? 'dark' : 'light'}
                    hideModeSwitch
                    onHtmlChange={setContentHtml}
                    onMarkdownChange={setContentMarkdown}
                    onUploadImage={handleUploadEditorImage}
                  />
                </div>
              ) : null}

              <div className="paper">
                <div className={styles['post-option']}>
                  <FormGroup row>
                    <FormControlLabel
                      label="댓글 허용"
                      control={
                        <IOSSwitch
                          sx={{ m: 1 }}
                          checked={isComment}
                          onChange={(event) => setIsComment(event.target.checked)}
                        />
                      }
                    />
                    <Divider orientation="vertical" variant="middle" flexItem sx={{ mr: 2 }} />
                    {canPinPost ? (
                      <FormControlLabel
                        label="상단고정글 등록"
                        control={
                          <IOSSwitch
                            sx={{ m: 1 }}
                            checked={isPin}
                            onChange={(event) => setIsPin(event.target.checked)}
                          />
                        }
                      />
                    ) : null}
                  </FormGroup>
                </div>
              </div>
            </>
          ) : null}
          <div className={styles['button-group']}>
            <a href={`/${siteName}/board`} className={`${styles.link} link`}>
              취소
            </a>
            <button
              type="button"
              className={`${styles.button} button`}
              disabled={isSubmittingDraft || isSubmittingPublish}
              onClick={(event) => void handleSubmit('draft', event as unknown as FormEvent<HTMLFormElement>)}
            >
              임시 저장
            </button>
            <button
              type="submit"
              disabled={isSubmittingDraft || isSubmittingPublish}
              className={`${styles.submit} button`}
            >
              저장
            </button>
          </div>
        </fieldset>
      </form>

      <Dialog
        open={thumbnailDialogOpen}
        onClose={closeThumbnailDialog}
        className={`vh-dialog vh-alert-dialog ${styles['thumbnail-dialog']}`}
      >
        <DialogTitle>썸네일 이미지 업로드</DialogTitle>
        <DialogContent className={styles['thumbnail-dialog-content']}>
          {thumbnailDialogMessage ? (
            <DialogContentText className={styles['thumbnail-dialog-message']}>
              {thumbnailDialogMessage}
            </DialogContentText>
          ) : null}

          <div className={styles['thumbnail-uploader']}>
            <button
              type="button"
              onClick={() => thumbnailDialogInputReference.current?.click()}
              className={styles['thumbnail-upload-button']}
            >
              <span>이미지를 선택해주세요</span>
              <CropOriginalOutlinedIcon />
            </button>

            <input
              ref={thumbnailDialogInputReference}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className={styles['thumbnail-file-input']}
              onChange={handleThumbnailDialogFileChange}
            />
          </div>

          {thumbnailDialogPreviewUrl ? (
            <div className={styles['thumbnail-dialog-preview']}>
              <img src={thumbnailDialogPreviewUrl} alt="" />
            </div>
          ) : null}
        </DialogContent>
        <DialogActions className={styles['thumbnail-dialog-actions']}>
          <button type="button" onClick={closeThumbnailDialog} className={styles['thumbnail-dialog-cancel-button']}>
            취소
          </button>
          <button type="button" onClick={applyThumbnailDialogImage} disabled={!thumbnailDialogFile}>
            이미지 업로드
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={galleryDialogOpen}
        onClose={closeGalleryDialog}
        className={`vh-dialog vh-alert-dialog ${styles['thumbnail-dialog']}`}
      >
        <DialogTitle>갤러리 이미지 업로드</DialogTitle>
        <DialogContent className={styles['thumbnail-dialog-content']}>
          {galleryDialogMessage ? (
            <DialogContentText className={styles['thumbnail-dialog-message']}>{galleryDialogMessage}</DialogContentText>
          ) : null}

          <div className={styles['thumbnail-uploader']}>
            <button
              type="button"
              onClick={() => galleryDialogInputReference.current?.click()}
              className={styles['thumbnail-upload-button']}
            >
              <span>{`이미지 추가 ${galleryDialogImageCount}/${MAX_GALLERY_IMAGE_COUNT}`}</span>
              <CollectionsOutlinedIcon />
            </button>

            <input
              ref={galleryDialogInputReference}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className={styles['thumbnail-file-input']}
              onChange={handleGalleryDialogFileChange}
            />
          </div>

          {galleryDialogImages.length > 0 || galleryDialogBlobImages.length > 0 ? (
            <div className={styles['gallery-dialog-preview']}>
              {[...galleryDialogBlobImages, ...galleryDialogImages].map((image) => {
                if ('file' in image) {
                  return (
                    <div key={image.id} className={styles['gallery-dialog-preview-image']}>
                      <button
                        type="button"
                        onClick={() => removeGalleryDialogBlobImage(image.id)}
                        aria-label="이미지 삭제"
                        className={styles['gallery-dialog-remove-button']}
                      >
                        <CloseRoundedIcon />
                      </button>
                      <img src={image.previewUrl} alt="" />
                    </div>
                  );
                }

                return (
                  <div key={image.path}>
                    <button
                      type="button"
                      onClick={() => removeGalleryDialogServerImage(image.path)}
                      aria-label="이미지 삭제"
                      className={styles['gallery-dialog-remove-button']}
                    >
                      ×
                    </button>
                    <img src={image.url} alt="" />
                  </div>
                );
              })}
            </div>
          ) : null}
        </DialogContent>
        <DialogActions className={styles['thumbnail-dialog-actions']}>
          <button type="button" onClick={closeGalleryDialog} className={styles['thumbnail-dialog-cancel-button']}>
            취소
          </button>
          <button type="button" onClick={applyGalleryDialogImages} disabled={galleryDialogImageCount === 0}>
            이미지 업로드
          </button>
        </DialogActions>
      </Dialog>

      <Dialog open={accessDialog.open} onClose={accessDialog.onCancel} className="vh-dialog">
        <DialogTitle>{accessDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ whiteSpace: 'pre-line' }}>{accessDialog.content}</DialogContentText>
        </DialogContent>
        <DialogActions>
          {accessDialog.cancelLabel ? (
            <button type="button" onClick={accessDialog.onCancel}>
              {accessDialog.cancelLabel}
            </button>
          ) : null}

          <button type="button" onClick={accessDialog.onConfirm}>
            {accessDialog.confirmLabel}
          </button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(alertMessage)} onClose={() => setAlertMessage('')} className="vh-dialog">
        <DialogContent>
          <DialogContentText>{alertMessage}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <button type="button" onClick={() => setAlertMessage('')}>
            확인
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
