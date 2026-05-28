'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import CropOriginalOutlinedIcon from '@mui/icons-material/CropOriginalOutlined';
import CollectionsOutlinedIcon from '@mui/icons-material/CollectionsOutlined';
import HowToVoteOutlinedIcon from '@mui/icons-material/HowToVoteOutlined';
import HowToVoteRoundedIcon from '@mui/icons-material/HowToVoteRounded';
import InsertPhotoOutlinedIcon from '@mui/icons-material/InsertPhotoOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import FormatListNumberedOutlinedIcon from '@mui/icons-material/FormatListNumberedOutlined';
import OndemandVideoOutlinedIcon from '@mui/icons-material/OndemandVideoOutlined';
import DynamicFeedOutlinedIcon from '@mui/icons-material/DynamicFeedOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import {
  Checkbox,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  SelectChangeEvent,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ko } from 'date-fns/locale';
import { normalizeText } from '@/lib/utils';
import { normalizeEditorHtml } from '@/lib/editor/normalizeEditorContent';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import ToastEditor from '@/components/editor/ToastEditor';
import NumberField from '@/components/custom-ui/NumberField';
import SiteInfo from '@/components/service/community/SiteInfo';
import TableList from '@/components/service/community/TableList';
import styles from '@/app/board.module.sass';
import Container from '../../menu';

type Props = {
  isCommunity: boolean;
};

type BoardItem = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: 'basic' | 'gallery' | 'youtube' | 'feed' | 'page';
  post_type?: 'none' | 'prefix' | 'series' | 'both' | null;
  is_active: boolean;
};

type BoardsResponse = {
  boards?: BoardItem[];
  error?: string;
};

type BoardInfoResponse = {
  board?: {
    board_type: 'basic' | 'gallery' | 'youtube' | 'feed';
    post_type: 'none' | 'prefix' | 'series' | 'both';
    markdown_status: string | null;
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

type EditorBlobImage = {
  id: string;
  file: File;
  previewUrl: string;
};

type PollEndType = '' | 'absolute' | 'relative';
type PollAnonymity = '' | 'anonymous' | 'named';

type PollOptionState = {
  label: string;
  imagePath: string;
  imageUrl: string;
  imageWidth: number | null;
  imageHeight: number | null;
  imageFile: File | null;
  imagePreviewUrl: string;
};

type PollState = {
  question: string;
  anonymity: PollAnonymity;
  useOptionThumbnail: boolean;
  endType: PollEndType;
  absoluteEndAt: Date | null;
  relativeDays: number;
  relativeTime: Date | null;
  options: PollOptionState[];
};

type PollPayload = {
  question: string;
  anonymity: 'anonymous' | 'named';
  endType: 'absolute' | 'relative';
  endsAt: string;
  options: {
    id?: number;
    label: string;
    image: {
      path: string;
      url: string;
      width: number | null;
      height: number | null;
    } | null;
  }[];
};

type DrawType = '' | 'first_come' | 'random';

type DrawState = {
  type: DrawType;
  limit: number;
  endsAt: Date | null;
};

type DrawPayload = {
  drawType: 'first_come' | 'random' | null;
  drawLimit: number | null;
  drawEndsAt: string | null;
};

type AccessDialogType = 'login' | 'join' | 'pending' | null;

const MAX_THUMBNAIL_FILE_SIZE = 1024 * 1024;
const MAX_EDITOR_IMAGE_FILE_SIZE = 1024 * 1024;
const MAX_GALLERY_IMAGE_COUNT = 9;
const MAX_POLL_OPTION_COUNT = 4;
const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function createEmptyPollOption(): PollOptionState {
  return {
    label: '',
    imagePath: '',
    imageUrl: '',
    imageWidth: null,
    imageHeight: null,
    imageFile: null,
    imagePreviewUrl: '',
  };
}

function createEmptyPoll(): PollState {
  return {
    question: '',
    anonymity: '',
    useOptionThumbnail: false,
    endType: '',
    absoluteEndAt: null,
    relativeDays: 0,
    relativeTime: createRelativeTimeValue(0, 1),
    options: Array.from({ length: MAX_POLL_OPTION_COUNT }, () => createEmptyPollOption()),
  };
}

function createEmptyDraw(): DrawState {
  return {
    type: '',
    limit: 1,
    endsAt: null,
  };
}

function createRelativeTimeValue(hour: number, minute: number) {
  const dateValue = new Date();
  dateValue.setHours(hour, minute, 0, 0);
  return dateValue;
}

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

async function convertImageToWebpFile(file: File, errorMessage = '이미지는 1MB 이하로 등록해주세요.') {
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
    throw new Error(errorMessage);
  }

  const filename = `${file.name.replace(/\.[^.]+$/, '') || `image-${Date.now()}`}.webp`;

  return new File([convertedBlob], filename, {
    type: 'image/webp',
  });
}

function clonePollState(poll: PollState): PollState {
  return {
    ...poll,
    absoluteEndAt: poll.absoluteEndAt ? new Date(poll.absoluteEndAt) : null,
    relativeTime: poll.relativeTime ? new Date(poll.relativeTime) : null,
    options: poll.options.map((option) => ({
      ...option,
    })),
  };
}

function cloneDrawState(draw: DrawState): DrawState {
  return {
    ...draw,
    endsAt: draw.endsAt ? new Date(draw.endsAt) : null,
  };
}

function getPollPreviewUrls(poll: PollState) {
  return poll.options.map((option) => option.imagePreviewUrl).filter((previewUrl) => previewUrl.startsWith('blob:'));
}

function revokeUnusedPollPreviewUrls(previousPoll: PollState, nextPoll: PollState) {
  const nextPreviewUrls = new Set(getPollPreviewUrls(nextPoll));

  previousPoll.options.forEach((option) => {
    if (option.imagePreviewUrl.startsWith('blob:') && !nextPreviewUrls.has(option.imagePreviewUrl)) {
      URL.revokeObjectURL(option.imagePreviewUrl);
    }
  });
}

function getMinimumAbsolutePollEndAt() {
  const dateValue = new Date();
  dateValue.setSeconds(0, 0);
  dateValue.setMinutes(dateValue.getMinutes() + 1);
  return dateValue;
}

function getRelativeHourMinute(value: Date | null) {
  if (!value || Number.isNaN(value.getTime())) {
    return {
      hour: 0,
      minute: 0,
    };
  }

  return {
    hour: value.getHours(),
    minute: value.getMinutes(),
  };
}

function buildPollEndsAt(poll: PollState) {
  if (poll.endType === 'absolute') {
    if (!poll.absoluteEndAt || Number.isNaN(poll.absoluteEndAt.getTime())) {
      throw new Error('투표 종료 시간을 설정해주세요.');
    }

    const normalizedEndAt = new Date(poll.absoluteEndAt);
    normalizedEndAt.setSeconds(0, 0);

    const minimumEndAt = getMinimumAbsolutePollEndAt();

    if (normalizedEndAt.getTime() < minimumEndAt.getTime()) {
      throw new Error('투표 종료 시간은 최소 1분 뒤로 설정해주세요.');
    }

    return normalizedEndAt.toISOString();
  }

  if (poll.endType === 'relative') {
    const { hour, minute } = getRelativeHourMinute(poll.relativeTime);
    const relativeDays = Number.isFinite(poll.relativeDays) ? poll.relativeDays : 0;

    if (relativeDays < 0 || relativeDays > 7) {
      throw new Error('상대 시간은 최대 7일까지 설정할 수 있습니다.');
    }

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new Error('상대 시간이 유효하지 않습니다.');
    }

    if (relativeDays === 0 && hour === 0 && minute === 0) {
      throw new Error('상대 시간은 최소 1분 뒤로 설정해주세요.');
    }

    const endsAt = new Date();
    endsAt.setSeconds(0, 0);
    endsAt.setDate(endsAt.getDate() + relativeDays);
    endsAt.setHours(endsAt.getHours() + hour);
    endsAt.setMinutes(endsAt.getMinutes() + minute);

    return endsAt.toISOString();
  }

  throw new Error('투표 종료 방식을 선택해주세요.');
}

function buildDrawPayload(draw: DrawState): DrawPayload {
  if (!draw.type) {
    return {
      drawType: null,
      drawLimit: null,
      drawEndsAt: null,
    };
  }

  const limit = Number.isFinite(draw.limit) ? Math.floor(draw.limit) : 0;

  if (limit < 1) {
    throw new Error('당첨 인원수를 입력해주세요.');
  }

  if (draw.type === 'first_come') {
    return {
      drawType: 'first_come',
      drawLimit: limit,
      drawEndsAt: null,
    };
  }

  if (!draw.endsAt || Number.isNaN(draw.endsAt.getTime())) {
    throw new Error('추첨 마감 일시를 입력해주세요.');
  }

  const normalizedEndsAt = new Date(draw.endsAt);
  normalizedEndsAt.setSeconds(0, 0);

  const minimumEndsAt = new Date();
  minimumEndsAt.setSeconds(0, 0);
  minimumEndsAt.setMinutes(minimumEndsAt.getMinutes() + 1);

  if (normalizedEndsAt.getTime() < minimumEndsAt.getTime()) {
    throw new Error('추첨 마감 일시는 최소 1분 뒤로 설정해주세요.');
  }

  return {
    drawType: 'random',
    drawLimit: limit,
    drawEndsAt: normalizedEndsAt.toISOString(),
  };
}

export default function Opt({ isCommunity }: Props) {
  const router = useRouter();
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName).toLowerCase();
  const theme = useTheme();

  const thumbnailDialogInputReference = useRef<HTMLInputElement | null>(null);
  const galleryDialogInputReference = useRef<HTMLInputElement | null>(null);
  const editorBlobImagesReference = useRef<EditorBlobImage[]>([]);
  const prefixSelectReference = useRef<HTMLDivElement | null>(null);
  const seriesSelectReference = useRef<HTMLDivElement | null>(null);

  const [accessDialogType, setAccessDialogType] = useState<AccessDialogType>(null);
  const [alertMessage, setAlertMessage] = useState('');
  const [boards, setBoards] = useState<BoardItem[]>([]);
  const [selectedBoardKey, setSelectedBoardKey] = useState(boardName);
  const [boardType, setBoardType] = useState<'basic' | 'gallery' | 'youtube' | 'feed'>('basic');
  const [postType, setPostType] = useState<'none' | 'prefix' | 'series' | 'both'>('none');
  const [prefixList, setPrefixList] = useState<PrefixRow[]>([]);
  const [seriesList, setSeriesList] = useState<SeriesRow[]>([]);
  const [selectedPrefixId, setSelectedPrefixId] = useState('');
  const [selectedSeriesKey, setSelectedSeriesKey] = useState('');
  const [subject, setSubject] = useState('');
  const [subjectPaddingLeft, setSubjectPaddingLeft] = useState(12);
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contentMarkdown, setContentMarkdown] = useState('');
  const [editorBlobImages, setEditorBlobImages] = useState<EditorBlobImage[]>([]);
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
  const [markdownStatus, setMarkdownStatus] = useState<string | null>('markdown_default');
  const [isPollEnabled, setIsPollEnabled] = useState(false);
  const [poll, setPoll] = useState<PollState>(() => createEmptyPoll());
  const [pollDialogOpen, setPollDialogOpen] = useState(false);
  const [pollDialog, setPollDialog] = useState<PollState>(() => createEmptyPoll());
  const [pollDialogMessage, setPollDialogMessage] = useState('');
  const [isDrawEnabled, setIsDrawEnabled] = useState(false);
  const [draw, setDraw] = useState<DrawState>(() => createEmptyDraw());
  const [drawDialogOpen, setDrawDialogOpen] = useState(false);
  const [drawDialog, setDrawDialog] = useState<DrawState>(() => createEmptyDraw());
  const [drawDialogMessage, setDrawDialogMessage] = useState('');
  const [isLoadingBoards, setIsLoadingBoards] = useState(true);
  const [isLoadingBoardMeta, setIsLoadingBoardMeta] = useState(false);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isSubmittingPublish, setIsSubmittingPublish] = useState(false);
  const [isUploadingThumbnail, setIsUploadingThumbnail] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

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
        onCancel: () => router.replace(`/${siteName}/${boardName}`),
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
        onCancel: () => router.replace(`/${siteName}/${boardName}`),
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
        onCancel: () => router.replace(`/${siteName}/${boardName}`),
        onConfirm: () => router.replace(`/${siteName}/${boardName}`),
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
  }, [accessDialogType, router, siteName, boardName]);

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
    editorBlobImagesReference.current = editorBlobImages;
  }, [editorBlobImages]);

  useEffect(() => {
    return () => {
      editorBlobImagesReference.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      galleryBlobImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      galleryDialogBlobImages.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      poll.options.forEach((option) => {
        if (option.imagePreviewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(option.imagePreviewUrl);
        }
      });
      pollDialog.options.forEach((option) => {
        if (option.imagePreviewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(option.imagePreviewUrl);
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadBoards() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/boards/write?siteName=${siteName}`, {
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

        const canWriteCurrentBoard = nextBoards.some((board) => board.board_key === boardName);

        setBoards(nextBoards);

        if (boardName && !canWriteCurrentBoard) {
          setSelectedBoardKey('');
          setErrorMessage('접근 권한이 없습니다.');
          return;
        }

        setSelectedBoardKey(canWriteCurrentBoard ? boardName : '');
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
  }, [siteName, boardName]);

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
        setMarkdownStatus('markdown_default');
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
        const nextMarkdownStatus = boardResult.board?.markdown_status ?? 'markdown_default';

        setBoardType(nextBoardType);
        setPostType(nextPostType);
        setMarkdownStatus(nextMarkdownStatus);
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

        if (nextPostType === 'series' || nextPostType === 'both') {
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

      if (postType === 'series' || postType === 'both') {
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
    setPoll(createEmptyPoll());
    setPollDialog(createEmptyPoll());
    setIsDrawEnabled(false);
    setDraw(createEmptyDraw());
    setDrawDialog(createEmptyDraw());
    setDrawDialogMessage('');
    setDrawDialogOpen(false);
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

  function openPollDialog() {
    setPollDialog(clonePollState(poll));
    setPollDialogMessage('');
    setPollDialogOpen(true);
  }

  function closePollDialog() {
    revokeUnusedPollPreviewUrls(pollDialog, poll);
    setPollDialog(clonePollState(poll));
    setPollDialogMessage('');
    setPollDialogOpen(false);
  }

  function applyPollDialog() {
    try {
      const normalizedQuestion = normalizeText(pollDialog.question);

      if (!pollDialog.anonymity) {
        setPollDialogMessage('투표 방식을 선택해주세요.');
        return;
      }

      if (!normalizedQuestion) {
        setPollDialogMessage('투표 질문을 입력해주세요.');
        return;
      }

      const filledOptions = pollDialog.options
        .map((option) => ({
          ...option,
          label: normalizeText(option.label),
        }))
        .filter((option) => option.label);

      if (filledOptions.length < 2) {
        setPollDialogMessage('투표 항목은 최소 2개 이상 입력해주세요.');
        return;
      }

      if (pollDialog.useOptionThumbnail) {
        const hasMissingImage = filledOptions.some((option) => !option.imageFile && !option.imagePath);

        if (hasMissingImage) {
          setPollDialogMessage('썸네일 이미지 사용시 항목에 맞는 이미지는 필수 등록 사항입니다.');
          return;
        }
      }

      buildPollEndsAt(pollDialog);

      const nextPoll: PollState = {
        ...pollDialog,
        question: normalizedQuestion,
        options: pollDialog.options.map((option) => ({
          ...option,
          label: normalizeText(option.label),
          imagePath: pollDialog.useOptionThumbnail ? option.imagePath : '',
          imageUrl: pollDialog.useOptionThumbnail ? option.imageUrl : '',
          imageWidth: pollDialog.useOptionThumbnail ? option.imageWidth : null,
          imageHeight: pollDialog.useOptionThumbnail ? option.imageHeight : null,
          imageFile: pollDialog.useOptionThumbnail ? option.imageFile : null,
          imagePreviewUrl: pollDialog.useOptionThumbnail ? option.imagePreviewUrl : '',
        })),
      };

      revokeUnusedPollPreviewUrls(poll, nextPoll);
      revokeUnusedPollPreviewUrls(pollDialog, nextPoll);

      setPoll(nextPoll);
      setIsPollEnabled(true);
      setPollDialog(clonePollState(nextPoll));
      setPollDialogMessage('');
      setPollDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setPollDialogMessage(unknownError.message || '투표 설정을 확인해주세요.');
      } else {
        setPollDialogMessage('투표 설정을 확인해주세요.');
      }
    }
  }

  function removePoll() {
    revokeUnusedPollPreviewUrls(poll, createEmptyPoll());
    revokeUnusedPollPreviewUrls(pollDialog, createEmptyPoll());
    setPoll(createEmptyPoll());
    setPollDialog(createEmptyPoll());
    setIsPollEnabled(false);
    setPollDialogMessage('');
    setPollDialogOpen(false);
  }

  function openDrawDialog() {
    setDrawDialog(cloneDrawState(draw));
    setDrawDialogMessage('');
    setDrawDialogOpen(true);
  }

  function closeDrawDialog() {
    setDrawDialog(cloneDrawState(draw));
    setDrawDialogMessage('');
    setDrawDialogOpen(false);
  }

  function applyDrawDialog() {
    try {
      buildDrawPayload(drawDialog);
      setDraw(cloneDrawState(drawDialog));
      setIsDrawEnabled(true);
      setDrawDialogMessage('');
      setDrawDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDrawDialogMessage(unknownError.message || '추첨 이벤트 설정을 확인해주세요.');
      } else {
        setDrawDialogMessage('추첨 이벤트 설정을 확인해주세요.');
      }
    }
  }

  function removeDraw() {
    setDraw(createEmptyDraw());
    setDrawDialog(createEmptyDraw());
    setIsDrawEnabled(false);
    setDrawDialogMessage('');
    setDrawDialogOpen(false);
  }

  function updatePollDialogOptionLabel(index: number, value: string) {
    setPollDialog((previousPoll) => ({
      ...previousPoll,
      options: previousPoll.options.map((option, optionIndex) =>
        optionIndex === index
          ? {
              ...option,
              label: value,
            }
          : option,
      ),
    }));
  }

  function handlePollOptionImageChange(index: number, event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.currentTarget.files?.[0];

    if (!selectedFile) {
      return;
    }

    if (selectedFile.size > MAX_THUMBNAIL_FILE_SIZE) {
      setPollDialogMessage('투표 항목 이미지는 1MB 이하로 등록해주세요.');
      event.currentTarget.value = '';
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(selectedFile.type)) {
      setPollDialogMessage('png, jpg, webp 이미지만 등록할 수 있습니다.');
      event.currentTarget.value = '';
      return;
    }

    setPollDialog((previousPoll) => {
      const previousOption = previousPoll.options[index];

      if (previousOption?.imagePreviewUrl.startsWith('blob:')) {
        const isCommittedPreview = poll.options.some(
          (option) => option.imagePreviewUrl === previousOption.imagePreviewUrl,
        );

        if (!isCommittedPreview) {
          URL.revokeObjectURL(previousOption.imagePreviewUrl);
        }
      }

      return {
        ...previousPoll,
        options: previousPoll.options.map((option, optionIndex) =>
          optionIndex === index
            ? {
                ...option,
                imagePath: '',
                imageUrl: '',
                imageWidth: null,
                imageHeight: null,
                imageFile: selectedFile,
                imagePreviewUrl: URL.createObjectURL(selectedFile),
              }
            : option,
        ),
      };
    });

    setPollDialogMessage('');
    event.currentTarget.value = '';
  }

  function removePollOptionImage(index: number) {
    setPollDialog((previousPoll) => {
      const previousOption = previousPoll.options[index];

      if (previousOption?.imagePreviewUrl.startsWith('blob:')) {
        const isCommittedPreview = poll.options.some(
          (option) => option.imagePreviewUrl === previousOption.imagePreviewUrl,
        );

        if (!isCommittedPreview) {
          URL.revokeObjectURL(previousOption.imagePreviewUrl);
        }
      }

      return {
        ...previousPoll,
        options: previousPoll.options.map((option, optionIndex) =>
          optionIndex === index
            ? {
                ...option,
                imagePath: '',
                imageUrl: '',
                imageWidth: null,
                imageHeight: null,
                imageFile: null,
                imagePreviewUrl: '',
              }
            : option,
        ),
      };
    });

    setPollDialogMessage('');
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

  async function uploadThumbnailIfNeeded() {
    if (!thumbnailBlobFile) {
      return {
        thumbnailImage,
        thumbnailImageUrl,
        thumbnailWidth,
        thumbnailHeight,
      };
    }

    const webpThumbnailFile = await convertImageToWebpFile(
      thumbnailBlobFile,
      '썸네일 이미지는 1MB 이하로 등록해주세요.',
    );
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

  async function buildPollPayloadIfNeeded(): Promise<PollPayload | null> {
    const hasPollValue =
      isPollEnabled ||
      Boolean(poll.anonymity) ||
      Boolean(normalizeText(poll.question)) ||
      poll.options.some(
        (option) => Boolean(normalizeText(option.label)) || Boolean(option.imageFile || option.imagePath),
      );

    if (!hasPollValue) {
      return null;
    }

    const normalizedQuestion = normalizeText(poll.question);

    if (!poll.anonymity) {
      throw new Error('투표 방식을 선택해주세요.');
    }

    if (!normalizedQuestion) {
      throw new Error('투표 질문을 입력해주세요.');
    }

    const filledOptions = poll.options
      .map((option, optionIndex) => ({
        option,
        optionIndex,
        label: normalizeText(option.label),
      }))
      .filter((item) => item.label);

    if (filledOptions.length < 2) {
      throw new Error('투표 항목은 최소 2개 이상 입력해주세요.');
    }

    if (poll.useOptionThumbnail) {
      const hasMissingImage = filledOptions.some((item) => !item.option.imageFile && !item.option.imagePath);

      if (hasMissingImage) {
        throw new Error('썸네일 이미지 사용시 항목에 맞는 이미지는 필수 등록 사항입니다.');
      }
    }

    const endsAt = buildPollEndsAt(poll);
    const nextPoll = clonePollState(poll);
    const options: PollPayload['options'] = [];

    for (const item of filledOptions) {
      const targetOption = nextPoll.options[item.optionIndex];

      if (poll.useOptionThumbnail && targetOption.imageFile) {
        const webpFile = await convertImageToWebpFile(
          targetOption.imageFile,
          '투표 항목 이미지는 1MB 이하로 등록해주세요.',
        );
        const uploadedImage = await uploadPostImage(webpFile, 'images');

        targetOption.imagePath = uploadedImage.path;
        targetOption.imageUrl = uploadedImage.url;
        targetOption.imageWidth = uploadedImage.width;
        targetOption.imageHeight = uploadedImage.height;
        targetOption.imageFile = null;

        if (targetOption.imagePreviewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(targetOption.imagePreviewUrl);
        }

        targetOption.imagePreviewUrl = uploadedImage.url;
      }

      options.push({
        id: item.optionIndex + 1,
        label: item.label,
        image:
          poll.useOptionThumbnail && targetOption.imagePath
            ? {
                path: targetOption.imagePath,
                url: targetOption.imageUrl,
                width: targetOption.imageWidth,
                height: targetOption.imageHeight,
              }
            : null,
      });
    }

    setPoll(nextPoll);
    setPollDialog(clonePollState(nextPoll));
    setIsPollEnabled(true);

    return {
      question: normalizedQuestion,
      anonymity: poll.anonymity === 'named' ? 'named' : 'anonymous',
      endType: poll.endType === 'relative' ? 'relative' : 'absolute',
      endsAt,
      options,
    };
  }

  function buildDrawPayloadIfNeeded() {
    if (!isDrawEnabled) {
      return {
        drawType: null,
        drawLimit: null,
        drawEndsAt: null,
      };
    }

    return buildDrawPayload(draw);
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

    try {
      setErrorMessage('');

      if (action === 'draft') {
        setIsSubmittingDraft(true);
      } else {
        setIsSubmittingPublish(true);
      }

      const uploadedThumbnail = await uploadThumbnailIfNeeded();
      const uploadedImages = await uploadGalleryImagesIfNeeded();
      const uploadedEditorContent = await uploadEditorImagesIfNeeded();
      const pollPayload = await buildPollPayloadIfNeeded();
      const drawPayload = buildDrawPayloadIfNeeded();

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
          contentHtml: isBasicBoard || isGalleryBoard ? normalizeEditorHtml(uploadedEditorContent.contentHtml) : null,
          contentMarkdown: isBasicBoard || isGalleryBoard ? uploadedEditorContent.contentMarkdown : null,
          contentSimple: isFeedBoard ? contentSimple : null,
          thumbnailImage: uploadedThumbnail.thumbnailImage || null,
          thumbnailWidth: uploadedThumbnail.thumbnailWidth,
          thumbnailHeight: uploadedThumbnail.thumbnailHeight,
          youtubeUrl: isYoutubeBoard ? youtubeUrl : null,
          youtubeCreatedAt: isYoutubeBoard && youtubeCreatedAt ? youtubeCreatedAt : null,
          images: isGalleryBoard || isFeedBoard ? uploadedImages : [],
          poll: isBasicBoard ? pollPayload : null,
          seriesKey: selectedSeriesKey || null,
          prefixId: selectedPrefixId || null,
          isComment,
          isPin: canPinPost ? isPin : false,
          drawType: isBasicBoard ? drawPayload.drawType : null,
          drawLimit: isBasicBoard ? drawPayload.drawLimit : null,
          drawEndsAt: isBasicBoard ? drawPayload.drawEndsAt : null,
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
      <main>
        <div className="container">
          <div className={`${styles.content} content`}>
            <div className="paper">
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (boards.length === 0) {
    return (
      <main>
        <div className="container">
          <div className={`${styles.content} content`}>
            <div className="paper paper-error">글을 작성할 수 있는 게시판이 없습니다.</div>
          </div>
        </div>
      </main>
    );
  }

  if (!isCommunity) {
    return (
      <main>
        <div className="container">
          <div className={`${styles.content} content`}>
            <div className="paper paper-error">지원하지 않는 경로입니다.</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <Container pageBack={`/${siteName}/${boardName}`} pageTitle="새글 쓰기" pageFin>
      <div className="container">
        {isCommunity && !isMobile ? (
          <aside>
            <SiteInfo />
            <TableList />
          </aside>
        ) : null}

        <div className={`${styles.content} content`}>
          {isMobile ? null : (
            <h2>
              {boardType ? renderBoardTypeIcon(boardType) : <ListAltOutlinedIcon />}
              <span>글쓰기</span>
            </h2>
          )}

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

                          {postType === 'series' || postType === 'both' ? (
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
                              placeholder="제목을 입력해 주세요 (필수)"
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
                        <input type="hidden" value={youtubeId} />
                        <div className={styles['form-group']}>
                          <div className={styles['form-control']}>
                            <input
                              type="text"
                              value={youtubeUrl}
                              placeholder="유튜브 영상 주소를 입력해주세요 (필수)"
                              style={{ paddingLeft: 12 }}
                              onChange={(event) => setYoutubeUrl(event.currentTarget.value)}
                            />
                          </div>
                        </div>
                        <div className={styles['form-group']}>
                          <label htmlFor="youtube-created-at">유튜브 업로드 날짜 (필수)</label>
                          <div className={styles['form-control']}>
                            <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                              <DatePicker
                                value={parseDateValue(youtubeCreatedAt)}
                                onChange={(value) => setYoutubeCreatedAt(formatDateValue(value))}
                                className={styles['MuiFormControl-root']}
                                format="yyyy년 MM월 dd일"
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

                    <div className={styles['post-options']}>
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
                          <button
                            type="button"
                            onClick={openPollDialog}
                            className={isPollEnabled ? styles.enabled : undefined}
                          >
                            {isPollEnabled ? <HowToVoteRoundedIcon /> : <HowToVoteOutlinedIcon />}
                            <span>투표</span>
                          </button>
                        </div>
                      ) : null}

                      {isBasicBoard ? (
                        <div className={styles.image}>
                          <button
                            type="button"
                            onClick={openDrawDialog}
                            className={isDrawEnabled ? styles.enabled : undefined}
                          >
                            {isDrawEnabled ? <Inventory2RoundedIcon /> : <Inventory2OutlinedIcon />}
                            <span>추첨 이벤트</span>
                          </button>
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
                        className={`${styles['content-simple']} ${styles['content-simple-feed']}`}
                        value={contentSimple}
                        placeholder="당신의 이야기에 모두가 귀 기울이고 있습니다..."
                        onChange={(event) => setContentSimple(event.currentTarget.value)}
                      />
                    </div>
                  ) : null}

                  {isYoutubeBoard ? (
                    <div className="paper paper-p0">
                      <textarea
                        className={`${styles['content-simple']} ${styles['content-simple-youtube']}`}
                        value={summary}
                        placeholder="영상설명을 간단히 입력해주세요"
                        onChange={(event) => setSummary(event.currentTarget.value)}
                      />
                    </div>
                  ) : null}

                  {isBasicBoard || isGalleryBoard ? (
                    <div
                      className={`${styles.editor} ${isBasicBoard ? styles['editor-basic'] : styles['editor-gallery']} service-editor`}
                    >
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
                              onChange={(event: ChangeEvent<HTMLInputElement>) => setIsComment(event.target.checked)}
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
                                onChange={(event: ChangeEvent<HTMLInputElement>) => setIsPin(event.target.checked)}
                              />
                            }
                          />
                        ) : null}
                      </FormGroup>
                    </div>
                  </div>
                </>
              ) : null}

              {errorMessage ? <div className="paper paper-error">{errorMessage}</div> : null}
              {isMobile ? (
                <div className={styles['button-top']}>
                  <button type="submit" className={`button ${styles.button}`}>
                    저장
                  </button>
                </div>
              ) : null}
              <div className={styles['button-group']}>
                <a href={`/${siteName}/${boardName}`} className={`${styles.link} link`}>
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

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={thumbnailDialogOpen}
              onClose={closeThumbnailDialog}
              className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['thumbnail-dialog']}`}
            >
              <h2>썸네일 이미지 업로드</h2>
              <button className="close-button" onClick={closeThumbnailDialog} aria-label="닫기">
                <CloseRoundedIcon />
              </button>
              <div className={`VhiDrawer-bottom-content ${styles['thumbnail-dialog-content']}`}>
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
              </div>
              <div className={styles['drawer-dialog-actions']}>
                <button type="button" onClick={closeThumbnailDialog} className="button medium cancel">
                  취소
                </button>
                <button
                  type="button"
                  onClick={applyThumbnailDialogImage}
                  disabled={!thumbnailDialogFile}
                  className="button medium submit"
                >
                  이미지 업로드
                </button>
              </div>
            </Drawer>
          ) : (
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
              <DialogActions>
                <button type="button" onClick={closeThumbnailDialog} className="cancel-button">
                  취소
                </button>
                <button type="button" onClick={applyThumbnailDialogImage} disabled={!thumbnailDialogFile}>
                  이미지 업로드
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={galleryDialogOpen}
              onClose={closeGalleryDialog}
              className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['thumbnail-dialog']}`}
            >
              <h2>갤러리 이미지 업로드</h2>
              <button className="close-button" onClick={closeGalleryDialog} aria-label="닫기">
                <CloseRoundedIcon />
              </button>
              <div className={`VhiDrawer-bottom-content ${styles['thumbnail-dialog-content']}`}>
                {galleryDialogMessage ? (
                  <DialogContentText className={styles['thumbnail-dialog-message']}>
                    {galleryDialogMessage}
                  </DialogContentText>
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
                        <div key={image.path} className={styles['gallery-dialog-preview-image']}>
                          <button
                            type="button"
                            onClick={() => removeGalleryDialogServerImage(image.path)}
                            aria-label="이미지 삭제"
                            className={styles['gallery-dialog-remove-button']}
                          >
                            <CloseRoundedIcon />
                          </button>
                          <img src={image.url} alt="" />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              <div className={styles['drawer-dialog-actions']}>
                <button type="button" onClick={closeGalleryDialog} className="button medium cancel">
                  취소
                </button>
                <button
                  type="button"
                  onClick={applyGalleryDialogImages}
                  disabled={galleryDialogImageCount === 0}
                  className="button medium submit"
                >
                  이미지 업로드
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={galleryDialogOpen}
              onClose={closeGalleryDialog}
              className={`vh-dialog vh-alert-dialog ${styles['thumbnail-dialog']}`}
            >
              <DialogTitle>갤러리 이미지 업로드</DialogTitle>
              <DialogContent className={styles['thumbnail-dialog-content']}>
                {galleryDialogMessage ? (
                  <DialogContentText className={styles['thumbnail-dialog-message']}>
                    {galleryDialogMessage}
                  </DialogContentText>
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
                        <div key={image.path} className={styles['gallery-dialog-preview-image']}>
                          <button
                            type="button"
                            onClick={() => removeGalleryDialogServerImage(image.path)}
                            aria-label="이미지 삭제"
                            className={styles['gallery-dialog-remove-button']}
                          >
                            <CloseRoundedIcon />
                          </button>
                          <img src={image.url} alt="" />
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </DialogContent>
              <DialogActions>
                <button type="button" onClick={closeGalleryDialog} className="cancel-button">
                  취소
                </button>
                <button type="button" onClick={applyGalleryDialogImages} disabled={galleryDialogImageCount === 0}>
                  이미지 업로드
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={pollDialogOpen}
              onClose={closePollDialog}
              className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['poll-dialog']}`}
            >
              <h2>투표 설정</h2>
              <button className="close-button" onClick={closePollDialog} aria-label="닫기">
                <CloseRoundedIcon />
              </button>
              <div className={`VhiDrawer-bottom-content ${styles['poll-dialog-content']}`}>
                {pollDialogMessage ? <DialogContentText>{pollDialogMessage}</DialogContentText> : null}

                <div className={styles['form-group']}>
                  <div className={styles['form-control']}>
                    <input
                      type="text"
                      value={pollDialog.question}
                      placeholder="투표 질문을 입력해주세요"
                      onChange={(event) => {
                        const nextQuestion = event.currentTarget.value;

                        setPollDialog((previousPoll) => ({
                          ...previousPoll,
                          question: nextQuestion,
                        }));
                      }}
                    />
                  </div>
                  <FormControlLabel
                    label="항목에 이미지 등록"
                    className="vh-checkbox"
                    control={
                      <Checkbox
                        checked={pollDialog.useOptionThumbnail}
                        onChange={(event) =>
                          setPollDialog((previousPoll) => ({
                            ...previousPoll,
                            useOptionThumbnail: event.target.checked,
                          }))
                        }
                      />
                    }
                  />
                </div>

                <div className={styles['poll-options']}>
                  {pollDialog.options.map((option, index) => (
                    <div key={index} className={styles['poll-option']}>
                      <label htmlFor={`poll-option-${index}`}>{index + 1}</label>
                      <div className={styles['form-control']}>
                        <input
                          id={`poll-option-${index}`}
                          placeholder="항목을 입력해주세요"
                          type="text"
                          value={option.label}
                          onChange={(event) => updatePollDialogOptionLabel(index, event.currentTarget.value)}
                        />
                      </div>

                      {pollDialog.useOptionThumbnail ? (
                        <div className={styles['poll-option-image']}>
                          {option.imagePreviewUrl || option.imageUrl ? (
                            <div className={styles['poll-option-image-preview']}>
                              <button type="button" onClick={() => removePollOptionImage(index)}>
                                <CloseRoundedIcon />
                              </button>
                              <img src={option.imagePreviewUrl || option.imageUrl} alt="" />
                            </div>
                          ) : (
                            <div className={styles['poll-option-image-upload']}>
                              <button type="button">
                                <label htmlFor={`poll-option-image-${index}`} aria-label="이미지 선택">
                                  <InsertPhotoOutlinedIcon />
                                </label>
                              </button>
                              <input
                                id={`poll-option-image-${index}`}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) => handlePollOptionImageChange(index, event)}
                              />
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <FormControl className={`${styles['poll-end-type']} vh-form-control`}>
                  <FormLabel id="poll-anonymity-label">투표 방식</FormLabel>
                  <RadioGroup
                    row
                    className="vh-radio"
                    aria-labelledby="poll-anonymity-label"
                    value={pollDialog.anonymity}
                    onChange={(event) =>
                      setPollDialog((previousPoll) => ({
                        ...previousPoll,
                        anonymity: event.target.value as PollAnonymity,
                      }))
                    }
                  >
                    <FormControlLabel value="anonymous" control={<Radio />} label="무기명" />
                    <FormControlLabel value="named" control={<Radio />} label="기명" />
                  </RadioGroup>
                </FormControl>

                <FormControl className={`${styles['poll-end-type']} vh-form-control`}>
                  <FormLabel id="poll-end-type-label">투표 마감 설정</FormLabel>
                  <RadioGroup
                    row
                    className="vh-radio"
                    aria-labelledby="poll-end-type-label"
                    value={pollDialog.endType}
                    onChange={(event) =>
                      setPollDialog((previousPoll) => ({
                        ...previousPoll,
                        endType: event.target.value as PollEndType,
                      }))
                    }
                  >
                    <FormControlLabel value="absolute" control={<Radio />} label="절대 시간 설정" />
                    <FormControlLabel value="relative" control={<Radio />} label="상대 시간 설정" />
                  </RadioGroup>
                </FormControl>

                {pollDialog.endType === 'absolute' ? (
                  <div className={`${styles['poll-setting-end']} ${styles['poll-absolute-end']}`}>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                      <DateTimePicker
                        value={pollDialog.absoluteEndAt}
                        onChange={(value) =>
                          setPollDialog((previousPoll) => ({
                            ...previousPoll,
                            absoluteEndAt: value,
                          }))
                        }
                        ampm={false}
                        views={['year', 'month', 'day', 'hours', 'minutes']}
                        format="yyyy년 MM월 dd일 hh시 m분"
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                          },
                        }}
                      />
                    </LocalizationProvider>
                    <span>에 종료</span>
                  </div>
                ) : null}

                {pollDialog.endType === 'relative' ? (
                  <div className={`${styles['poll-setting-end']} ${styles['poll-relative-end']} vh-form-control`}>
                    <Select
                      value={String(pollDialog.relativeDays)}
                      onChange={(event: SelectChangeEvent) =>
                        setPollDialog((previousPoll) => ({
                          ...previousPoll,
                          relativeDays: Number(event.target.value),
                        }))
                      }
                      size="small"
                    >
                      {Array.from({ length: 8 }, (_, index) => (
                        <MenuItem key={index} value={String(index)}>
                          {index}일
                        </MenuItem>
                      ))}
                    </Select>

                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                      <TimePicker
                        value={pollDialog.relativeTime}
                        className={styles['poll-relative-time-picker']}
                        onChange={(value) =>
                          setPollDialog((previousPoll) => ({
                            ...previousPoll,
                            relativeTime: value,
                          }))
                        }
                        ampm={false}
                        views={['hours', 'minutes']}
                        format="H시간 mm분"
                        slotProps={{
                          textField: {
                            size: 'small',
                          },
                        }}
                      />
                    </LocalizationProvider>
                    <span>후에 종료</span>
                  </div>
                ) : null}
              </div>
              <div className={styles['drawer-dialog-actions']}>
                {isPollEnabled ? (
                  <button type="button" onClick={removePoll} className="button medium danger">
                    투표 삭제
                  </button>
                ) : null}
                <button type="button" onClick={closePollDialog} className="button medium cancel">
                  취소
                </button>
                <button type="button" onClick={applyPollDialog} className="button medium submit">
                  이미지 업로드
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={pollDialogOpen}
              onClose={closePollDialog}
              fullWidth={true}
              maxWidth="sm"
              className={`vh-dialog vh-alert-dialog ${styles['poll-dialog']}`}
            >
              <DialogTitle>투표 설정</DialogTitle>
              <DialogContent className={styles['poll-dialog-content']}>
                {pollDialogMessage ? <DialogContentText>{pollDialogMessage}</DialogContentText> : null}

                <div className={styles['form-group']}>
                  <div className={styles['form-control']}>
                    <input
                      type="text"
                      value={pollDialog.question}
                      placeholder="투표 질문을 입력해주세요"
                      onChange={(event) => {
                        const nextQuestion = event.currentTarget.value;

                        setPollDialog((previousPoll) => ({
                          ...previousPoll,
                          question: nextQuestion,
                        }));
                      }}
                    />
                  </div>
                  <FormControlLabel
                    label="항목에 이미지 등록"
                    className="vh-checkbox"
                    control={
                      <Checkbox
                        checked={pollDialog.useOptionThumbnail}
                        onChange={(event) =>
                          setPollDialog((previousPoll) => ({
                            ...previousPoll,
                            useOptionThumbnail: event.target.checked,
                          }))
                        }
                      />
                    }
                  />
                </div>

                <div className={styles['poll-options']}>
                  {pollDialog.options.map((option, index) => (
                    <div key={index} className={styles['poll-option']}>
                      <label htmlFor={`poll-option-${index}`}>{index + 1}</label>
                      <div className={styles['form-control']}>
                        <input
                          id={`poll-option-${index}`}
                          placeholder="항목을 입력해주세요"
                          type="text"
                          value={option.label}
                          onChange={(event) => updatePollDialogOptionLabel(index, event.currentTarget.value)}
                        />
                      </div>

                      {pollDialog.useOptionThumbnail ? (
                        <div className={styles['poll-option-image']}>
                          {option.imagePreviewUrl || option.imageUrl ? (
                            <div className={styles['poll-option-image-preview']}>
                              <button type="button" onClick={() => removePollOptionImage(index)}>
                                <CloseRoundedIcon />
                              </button>
                              <img src={option.imagePreviewUrl || option.imageUrl} alt="" />
                            </div>
                          ) : (
                            <div className={styles['poll-option-image-upload']}>
                              <button type="button">
                                <label htmlFor={`poll-option-image-${index}`} aria-label="이미지 선택">
                                  <InsertPhotoOutlinedIcon />
                                </label>
                              </button>
                              <input
                                id={`poll-option-image-${index}`}
                                type="file"
                                accept="image/png,image/jpeg,image/webp"
                                onChange={(event) => handlePollOptionImageChange(index, event)}
                              />
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>

                <FormControl className={`${styles['poll-end-type']} vh-form-control`}>
                  <FormLabel id="poll-anonymity-label">투표 방식</FormLabel>
                  <RadioGroup
                    row
                    className="vh-radio"
                    aria-labelledby="poll-anonymity-label"
                    value={pollDialog.anonymity}
                    onChange={(event) =>
                      setPollDialog((previousPoll) => ({
                        ...previousPoll,
                        anonymity: event.target.value as PollAnonymity,
                      }))
                    }
                  >
                    <FormControlLabel value="anonymous" control={<Radio />} label="무기명" />
                    <FormControlLabel value="named" control={<Radio />} label="기명" />
                  </RadioGroup>
                </FormControl>

                <FormControl className={`${styles['poll-end-type']} vh-form-control`}>
                  <FormLabel id="poll-end-type-label">투표 마감 설정</FormLabel>
                  <RadioGroup
                    row
                    className="vh-radio"
                    aria-labelledby="poll-end-type-label"
                    value={pollDialog.endType}
                    onChange={(event) =>
                      setPollDialog((previousPoll) => ({
                        ...previousPoll,
                        endType: event.target.value as PollEndType,
                      }))
                    }
                  >
                    <FormControlLabel value="absolute" control={<Radio />} label="절대 시간 설정" />
                    <FormControlLabel value="relative" control={<Radio />} label="상대 시간 설정" />
                  </RadioGroup>
                </FormControl>

                {pollDialog.endType === 'absolute' ? (
                  <div className={`${styles['poll-setting-end']} ${styles['poll-absolute-end']}`}>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                      <DateTimePicker
                        value={pollDialog.absoluteEndAt}
                        onChange={(value) =>
                          setPollDialog((previousPoll) => ({
                            ...previousPoll,
                            absoluteEndAt: value,
                          }))
                        }
                        ampm={false}
                        views={['year', 'month', 'day', 'hours', 'minutes']}
                        format="yyyy년 MM월 dd일 hh시 m분"
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                          },
                        }}
                      />
                    </LocalizationProvider>
                    <span>에 종료</span>
                  </div>
                ) : null}

                {pollDialog.endType === 'relative' ? (
                  <div className={`${styles['poll-setting-end']} ${styles['poll-relative-end']} vh-form-control`}>
                    <Select
                      value={String(pollDialog.relativeDays)}
                      onChange={(event: SelectChangeEvent) =>
                        setPollDialog((previousPoll) => ({
                          ...previousPoll,
                          relativeDays: Number(event.target.value),
                        }))
                      }
                      size="small"
                    >
                      {Array.from({ length: 8 }, (_, index) => (
                        <MenuItem key={index} value={String(index)}>
                          {index}일
                        </MenuItem>
                      ))}
                    </Select>

                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                      <TimePicker
                        value={pollDialog.relativeTime}
                        className={styles['poll-relative-time-picker']}
                        onChange={(value) =>
                          setPollDialog((previousPoll) => ({
                            ...previousPoll,
                            relativeTime: value,
                          }))
                        }
                        ampm={false}
                        views={['hours', 'minutes']}
                        format="H시간 mm분"
                        slotProps={{
                          textField: {
                            size: 'small',
                          },
                        }}
                      />
                    </LocalizationProvider>
                    <span>후에 종료</span>
                  </div>
                ) : null}
              </DialogContent>
              <DialogActions>
                {isPollEnabled ? (
                  <button type="button" onClick={removePoll} className="delete-button">
                    투표 삭제
                  </button>
                ) : null}
                <button type="button" onClick={closePollDialog} className="cancel-button">
                  취소
                </button>
                <button type="button" onClick={applyPollDialog}>
                  투표 설정
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={drawDialogOpen}
              onClose={closeDrawDialog}
              className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['draw-dialog']}`}
            >
              <h2>추첨 이벤트 설정</h2>
              <button className="close-button" onClick={closeDrawDialog} aria-label="추첨 이벤트 설정 닫기">
                <CloseRoundedIcon />
              </button>
              <div className={`VhiDrawer-bottom-content ${styles['draw-dialog-content']}`}>
                {drawDialogMessage ? <DialogContentText>{drawDialogMessage}</DialogContentText> : null}

                <FormControl className={`${styles['draw-end-at']} vh-form-control`}>
                  <FormLabel id="draw-type-label">추첨 방식</FormLabel>
                  <RadioGroup
                    row
                    className="vh-radio"
                    aria-labelledby="draw-type-label"
                    value={drawDialog.type}
                    onChange={(event) =>
                      setDrawDialog((previousDraw) => ({
                        ...previousDraw,
                        type: event.target.value as DrawType,
                        endsAt: event.target.value === 'first_come' ? null : previousDraw.endsAt,
                      }))
                    }
                  >
                    <FormControlLabel value="first_come" control={<Radio />} label="선착순" />
                    <FormControlLabel value="random" control={<Radio />} label="마감 후 무작위 추첨" />
                  </RadioGroup>
                </FormControl>

                <div className={`${styles['form-group']} vh-form-control`}>
                  <NumberField
                    label="당첨 인원수"
                    min={1}
                    value={drawDialog.limit}
                    size="small"
                    onValueChange={(value) =>
                      setDrawDialog((previousDraw) => ({
                        ...previousDraw,
                        limit: typeof value === 'number' && Number.isFinite(value) ? value : 1,
                      }))
                    }
                  />
                </div>

                {drawDialog.type === 'random' ? (
                  <div className={`${styles['draw-setting-end']} ${styles['draw-absolute-end']} vh-form-control`}>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                      <DateTimePicker
                        value={drawDialog.endsAt}
                        onChange={(value) =>
                          setDrawDialog((previousDraw) => ({
                            ...previousDraw,
                            endsAt: value,
                          }))
                        }
                        ampm={false}
                        views={['year', 'month', 'day', 'hours', 'minutes']}
                        format="yyyy년 MM월 dd일 hh시 m분"
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                          },
                        }}
                      />
                    </LocalizationProvider>
                    <span>에 마감</span>
                  </div>
                ) : null}
              </div>
              <div className={styles['drawer-dialog-actions']}>
                {isDrawEnabled ? (
                  <>
                    <button type="button" onClick={removeDraw} className="button medium danger">
                      추첨 이벤트 삭제
                    </button>
                    <div className="complex-button">
                      <button type="button" onClick={closeDrawDialog} className="button medium cancel">
                        취소
                      </button>
                      <button type="button" onClick={applyDrawDialog} className="button medium submit">
                        추첨 이벤트 설정
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={closeDrawDialog} className="button medium cancel">
                      취소
                    </button>
                    <button type="button" onClick={applyDrawDialog} className="button medium submit">
                      추첨 이벤트 설정
                    </button>
                  </>
                )}
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={drawDialogOpen}
              onClose={closeDrawDialog}
              fullWidth={true}
              maxWidth="sm"
              className={`vh-dialog vh-alert-dialog ${styles['draw-dialog']}`}
            >
              <DialogTitle>추첨 이벤트 설정</DialogTitle>
              <DialogContent className={styles['draw-dialog-content']}>
                {drawDialogMessage ? <DialogContentText>{drawDialogMessage}</DialogContentText> : null}

                <FormControl className={`${styles['draw-end-at']} vh-form-control`}>
                  <FormLabel id="draw-type-label">추첨 방식</FormLabel>
                  <RadioGroup
                    row
                    className="vh-radio"
                    aria-labelledby="draw-type-label"
                    value={drawDialog.type}
                    onChange={(event) =>
                      setDrawDialog((previousDraw) => ({
                        ...previousDraw,
                        type: event.target.value as DrawType,
                        endsAt: event.target.value === 'first_come' ? null : previousDraw.endsAt,
                      }))
                    }
                  >
                    <FormControlLabel value="first_come" control={<Radio />} label="선착순" />
                    <FormControlLabel value="random" control={<Radio />} label="마감 후 무작위 추첨" />
                  </RadioGroup>
                </FormControl>

                <div className={`${styles['form-group']} vh-form-control`}>
                  <NumberField
                    label="당첨 인원수"
                    min={1}
                    value={drawDialog.limit}
                    size="small"
                    onValueChange={(value) =>
                      setDrawDialog((previousDraw) => ({
                        ...previousDraw,
                        limit: typeof value === 'number' && Number.isFinite(value) ? value : 1,
                      }))
                    }
                  />
                </div>

                {drawDialog.type === 'random' ? (
                  <div className={`${styles['draw-setting-end']} ${styles['draw-absolute-end']} vh-form-control`}>
                    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
                      <DateTimePicker
                        value={drawDialog.endsAt}
                        onChange={(value) =>
                          setDrawDialog((previousDraw) => ({
                            ...previousDraw,
                            endsAt: value,
                          }))
                        }
                        ampm={false}
                        views={['year', 'month', 'day', 'hours', 'minutes']}
                        format="yyyy년 MM월 dd일 hh시 m분"
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small',
                          },
                        }}
                      />
                    </LocalizationProvider>
                    <span>에 마감</span>
                  </div>
                ) : null}
              </DialogContent>
              <DialogActions className={isDrawEnabled ? 'complex-buttons' : undefined}>
                {isDrawEnabled ? (
                  <>
                    <button type="button" onClick={removeDraw} className="delete-button">
                      추첨 이벤트 삭제
                    </button>
                    <div className="complex-button">
                      <button type="button" onClick={closeDrawDialog} className="cancel-button">
                        취소
                      </button>
                      <button type="button" onClick={applyDrawDialog}>
                        추첨 이벤트 설정
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={closeDrawDialog} className="cancel-button">
                      취소
                    </button>
                    <button type="button" onClick={applyDrawDialog}>
                      추첨 이벤트 설정
                    </button>
                  </>
                )}
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={accessDialog.open}
              onClose={accessDialog.onCancel}
              className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['poll-dialog']}`}
            >
              <h2>투표 설정</h2>
              <button className="close-button" onClick={accessDialog.onCancel} aria-label="투표 설정 닫기">
                <CloseRoundedIcon />
              </button>
              <p style={{ whiteSpace: 'pre-line' }}>{accessDialog.content}</p>
              <div className={styles['drawer-dialog-actions']}>
                {accessDialog.cancelLabel ? (
                  <button type="button" onClick={accessDialog.onCancel} className="button medium cancel">
                    {accessDialog.cancelLabel}
                  </button>
                ) : null}

                <button type="button" onClick={accessDialog.onConfirm} className="button medium submit">
                  {accessDialog.confirmLabel}
                </button>
              </div>
            </Drawer>
          ) : (
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
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(alertMessage)}
              onClose={() => setAlertMessage('')}
              className={`VhiDrawer-bottom VhiDrawer-bottom-service ${styles['thumbnail-dialog']}`}
            >
              <h2>{alertMessage}</h2>
              <button className="close-button" onClick={() => setAlertMessage('')} aria-label={`${alertMessage} 닫기`}>
                <CloseRoundedIcon />
              </button>
              <p>{alertMessage}</p>
              <div className={styles['drawer-dialog-actions']}>
                <button type="button" onClick={() => setAlertMessage('')} className="button medium cancel">
                  확인
                </button>
              </div>
            </Drawer>
          ) : (
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
          )}
        </div>
      </div>
    </Container>
  );
}
