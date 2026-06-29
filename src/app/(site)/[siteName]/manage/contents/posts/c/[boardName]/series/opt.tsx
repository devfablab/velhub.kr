'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  InputAdornment,
  Snackbar,
  Stack,
  styled,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { formatDateTimeDetail, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: string;
  post_type?: 'none' | 'prefix' | 'series';
  site_id: string;
  created_at?: string;
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

type SeriesUserSearchRow = {
  particleId: string;
  email: string;
  userName: string;
  nickname: string;
};

type SeriesListResponse = {
  board?: BoardRow;
  series?: SeriesRow[];
  error?: string;
};

type SeriesDetailResponse = {
  board?: BoardRow;
  series?: SeriesRow;
  selectedUser?: SeriesUserSearchRow | null;
  error?: string;
};

type SeriesSaveResponse = {
  ok?: boolean;
  series?: SeriesRow;
  error?: string;
};

type SeriesDeleteResponse = {
  ok?: boolean;
  error?: string;
};

type SeriesCheckResponse = {
  ok?: boolean;
  available?: boolean;
  error?: string;
};

type SeriesImageUploadResponse = {
  ok?: boolean;
  thumbnailImage?: string;
  url?: string;
  error?: string;
};

type SeriesUserSearchResponse = {
  users?: SeriesUserSearchRow[];
  error?: string;
};

type DialogMode = 'new' | 'edit' | 'delete' | null;

type AgeCheckResponse = {
  isAdult?: boolean;
  error?: string;
};

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

function isValidSeriesKey(value: string) {
  if (value.length < 5 || value.length > 16) {
    return false;
  }

  if (!/[a-z]/.test(value)) {
    return false;
  }

  if (/[^a-z0-9\-_]/.test(value)) {
    return false;
  }

  if (value.startsWith('_') || value.endsWith('_')) {
    return false;
  }

  if (value.includes('__')) {
    return false;
  }

  return true;
}

function getSeriesImageUrl(value: string) {
  const imagePath = normalizeText(value);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  if (!supabaseUrl || !imagePath) {
    return '';
  }

  return `${supabaseUrl}/storage/v1/object/public/series/${imagePath}`;
}

function buildCheckUrl({
  boardName,
  siteName,
  type,
  value,
  ignoreSeriesName,
}: {
  boardName: string;
  siteName: string;
  type: 'key' | 'label';
  value: string;
  ignoreSeriesName?: string;
}) {
  const searchParams = new URLSearchParams();

  searchParams.set('siteName', siteName);
  searchParams.set('type', type);
  searchParams.set('value', value);

  if (ignoreSeriesName) {
    searchParams.set('ignoreSeriesName', ignoreSeriesName);
  }

  return `/api/boards/${boardName}/series/check?${searchParams.toString()}`;
}

export default function Opt() {
  const params = useParams();

  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName).toLowerCase();

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const fileInputReference = useRef<HTMLInputElement | null>(null);

  const [board, setBoard] = useState<BoardRow | null>(null);
  const [seriesList, setSeriesList] = useState<SeriesRow[]>([]);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedSeries, setSelectedSeries] = useState<SeriesRow | null>(null);
  const [seriesKey, setSeriesKey] = useState('');
  const [seriesLabel, setSeriesLabel] = useState('');
  const [summary, setSummary] = useState('');
  const [thumbnailImage, setThumbnailImage] = useState('');
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState('');
  const [selectedUser, setSelectedUser] = useState<SeriesUserSearchRow | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(false);
  const [isCheckingLabel, setIsCheckingLabel] = useState(false);
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [userSearchKeyword, setUserSearchKeyword] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<SeriesUserSearchRow[]>([]);
  const [isUserSearching, setIsUserSearching] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [dialogHelperMessage, setDialogHelperMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isKeyChecked, setIsKeyChecked] = useState(false);
  const [isLabelChecked, setIsLabelChecked] = useState(false);
  const [checkedSeriesKey, setCheckedSeriesKey] = useState('');
  const [checkedSeriesLabel, setCheckedSeriesLabel] = useState('');

  const sortedSeries = useMemo(() => {
    return [...seriesList].sort((a, b) => {
      const aLastPublishedAt = a.last_published_at ? new Date(a.last_published_at).getTime() : 0;
      const bLastPublishedAt = b.last_published_at ? new Date(b.last_published_at).getTime() : 0;

      if (aLastPublishedAt !== bLastPublishedAt) {
        return bLastPublishedAt - aLastPublishedAt;
      }

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [seriesList]);

  useEffect(() => {
    async function loadSeries() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/boards/${boardName}/series?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as SeriesListResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '연재 목록을 불러오지 못했습니다.');
        }

        if (!result.board) {
          throw new Error('연재 목록을 불러오지 못했습니다.');
        }

        setBoard(result.board);
        setSeriesList(Array.isArray(result.series) ? result.series : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '연재 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('연재 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadSeries();
  }, [boardName, siteName]);

  function resetDialogFields() {
    setSeriesKey('');
    setSeriesLabel('');
    setSummary('');
    setThumbnailImage('');
    setThumbnailImageUrl('');
    setSelectedUser(null);
    setIsCompleted(false);
    setDialogErrorMessage('');
    setDialogHelperMessage('');
    setIsKeyChecked(false);
    setIsLabelChecked(false);
    setCheckedSeriesKey('');
    setCheckedSeriesLabel('');
    setUserSearchKeyword('');
    setSearchedUsers([]);

    if (fileInputReference.current) {
      fileInputReference.current.value = '';
    }
  }

  function handleOpenNewDialog() {
    setDialogMode('new');
    setSelectedSeries(null);
    resetDialogFields();
  }

  async function handleOpenEditDialog(series: SeriesRow) {
    try {
      setDialogErrorMessage('');
      setDialogHelperMessage('');

      const response = await fetch(`/api/boards/${boardName}/series/${series.series_key}?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as SeriesDetailResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '연재 정보를 불러오지 못했습니다.');
      }

      if (!result.series) {
        throw new Error('연재 정보를 불러오지 못했습니다.');
      }

      const nextThumbnailImage = result.series.thumbnail_image || '';

      setSelectedSeries(result.series);
      setSeriesKey(result.series.series_key);
      setSeriesLabel(result.series.series_label);
      setSummary(result.series.summary || '');
      setThumbnailImage(nextThumbnailImage);
      setThumbnailImageUrl(getSeriesImageUrl(nextThumbnailImage));
      setSelectedUser(result.selectedUser ?? null);
      setIsCompleted(result.series.is_completed);
      setIsKeyChecked(true);
      setIsLabelChecked(true);
      setCheckedSeriesKey(result.series.series_key);
      setCheckedSeriesLabel(result.series.series_label);
      setDialogMode('edit');

      if (fileInputReference.current) {
        fileInputReference.current.value = '';
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '연재 정보를 불러오지 못했습니다.');
      } else {
        setErrorMessage('연재 정보를 불러오지 못했습니다.');
      }
    }
  }

  function handleOpenDeleteDialog(series: SeriesRow) {
    setSelectedSeries(series);
    setDialogMode('delete');
    setDialogErrorMessage('');
    setDialogHelperMessage('');
  }

  function handleCloseDialog() {
    if (isSubmitting || isUploadingImage || isDeletingImage) {
      return;
    }

    setDialogMode(null);
    setSelectedSeries(null);
    resetDialogFields();
  }

  function handleSeriesKeyChange(event: InputChangeEvent) {
    setSeriesKey(event.currentTarget.value);
    setDialogErrorMessage('');
    setDialogHelperMessage('');
    setIsKeyChecked(false);
    setCheckedSeriesKey('');
  }

  function handleSeriesLabelChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    setSeriesLabel(nextValue);
    setDialogErrorMessage('');
    setDialogHelperMessage('');

    if (!normalizeText(nextValue)) {
      setIsLabelChecked(true);
      setCheckedSeriesLabel('');
      return;
    }

    setIsLabelChecked(false);
    setCheckedSeriesLabel('');
  }

  function handleSummaryChange(event: InputChangeEvent) {
    setSummary(event.currentTarget.value);
    setDialogErrorMessage('');
    setDialogHelperMessage('');
  }

  function handleIsCompletedChange(event: ChangeEvent<HTMLInputElement>) {
    if (selectedSeries?.is_completed) {
      return;
    }

    setIsCompleted(event.target.checked);
    setDialogErrorMessage('');
    setDialogHelperMessage('');
  }

  function handleUserSearchKeywordChange(event: InputChangeEvent) {
    setUserSearchKeyword(event.currentTarget.value);
  }

  function handleOpenUserDialog() {
    if (!board) {
      return;
    }

    setUserSearchKeyword('');
    setSearchedUsers([]);
    setDialogErrorMessage('');
    setIsUserDialogOpen(true);
  }

  function handleCloseUserDialog() {
    if (isUserSearching) {
      return;
    }

    setIsUserDialogOpen(false);
  }

  type AgeCheckResponse = {
    isAdult?: boolean;
    error?: string;
  };

  async function handleSelectUser(user: SeriesUserSearchRow) {
    try {
      const response = await fetch(`/api/identity/portone/status?userId=${user.particleId}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as AgeCheckResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '사용자 나이를 확인하지 못했습니다.');
      }

      if (!result.isAdult) {
        setSnackbarMessage('만 19세 미만은 선택할 수 없습니다');
        return;
      }

      setSelectedUser(user);
      setIsUserDialogOpen(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setSnackbarMessage(unknownError.message || '사용자 나이를 확인하지 못했습니다.');
      } else {
        setSnackbarMessage('사용자 나이를 확인하지 못했습니다.');
      }
    }
  }

  function handleClearUser() {
    setSelectedUser(null);
  }

  async function handleSearchUsers() {
    if (!board) {
      return;
    }

    const keyword = normalizeText(userSearchKeyword);

    if (!keyword) {
      setSearchedUsers([]);
      return;
    }

    try {
      setDialogErrorMessage('');
      setIsUserSearching(true);

      const searchParams = new URLSearchParams();
      searchParams.set('siteName', siteName);
      searchParams.set('query', keyword);

      const response = await fetch(`/api/boards/${board.board_key}/series/users?${searchParams.toString()}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as SeriesUserSearchResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '사용자 검색에 실패했습니다.');
      }

      setSearchedUsers(Array.isArray(result.users) ? result.users : []);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '사용자 검색에 실패했습니다.');
      } else {
        setDialogErrorMessage('사용자 검색에 실패했습니다.');
      }
    } finally {
      setIsUserSearching(false);
    }
  }

  async function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] ?? null;

    if (!selectedFile || isUploadingImage) {
      event.target.value = '';
      return;
    }

    try {
      setIsUploadingImage(true);
      setDialogErrorMessage('');
      setDialogHelperMessage('');

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/attachment/add/series-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = (await response.json()) as SeriesImageUploadResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '연재 이미지 업로드에 실패했습니다.');
      }

      if (!result.thumbnailImage) {
        throw new Error('연재 이미지 업로드에 실패했습니다.');
      }

      setThumbnailImage(result.thumbnailImage);
      setThumbnailImageUrl(result.url ?? '');

      if (fileInputReference.current) {
        fileInputReference.current.value = '';
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '연재 이미지 업로드에 실패했습니다.');
      } else {
        setDialogErrorMessage('연재 이미지 업로드에 실패했습니다.');
      }
    } finally {
      setIsUploadingImage(false);
    }
  }

  async function handleDeleteImage() {
    if (!thumbnailImage) {
      return;
    }

    try {
      setIsDeletingImage(true);
      setDialogErrorMessage('');
      setDialogHelperMessage('');

      const response = await fetch('/api/attachment/delete/series-image', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          path: thumbnailImage,
        }),
      });

      const result = (await response.json()) as { ok?: boolean; error?: string };

      if (!response.ok) {
        throw new Error(result.error ?? '연재 이미지 삭제에 실패했습니다.');
      }

      setThumbnailImage('');
      setThumbnailImageUrl('');

      if (fileInputReference.current) {
        fileInputReference.current.value = '';
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '연재 이미지 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('연재 이미지 삭제에 실패했습니다.');
      }
    } finally {
      setIsDeletingImage(false);
    }
  }

  async function handleCheckSeriesKey() {
    if (!board) {
      return;
    }

    const nextSeriesKey = normalizeText(seriesKey).toLowerCase();

    if (!nextSeriesKey) {
      setDialogErrorMessage('연재 식별자를 입력해주세요.');
      setDialogHelperMessage('');
      return;
    }

    if (!isValidSeriesKey(nextSeriesKey)) {
      setDialogErrorMessage(
        '연재 식별자는 5자 이상 16자 이하여야 하며, 영소문자/숫자/하이픈/언더스코어만 사용할 수 있고, 최소 한 글자의 영문자를 포함해야 합니다.',
      );
      setDialogHelperMessage('');
      setIsKeyChecked(false);
      setCheckedSeriesKey('');
      return;
    }

    try {
      setDialogErrorMessage('');
      setDialogHelperMessage('');
      setIsCheckingKey(true);

      const response = await fetch(
        buildCheckUrl({
          boardName: board.board_key,
          siteName,
          type: 'key',
          value: nextSeriesKey,
          ignoreSeriesName: dialogMode === 'edit' && selectedSeries ? selectedSeries.series_key : '',
        }),
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as SeriesCheckResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '연재 식별자 중복 확인에 실패했습니다.');
      }

      if (!result.available) {
        setDialogErrorMessage('이미 존재하는 연재 식별자입니다.');
        setDialogHelperMessage('');
        setIsKeyChecked(false);
        setCheckedSeriesKey('');
        return;
      }

      setDialogErrorMessage('');
      setDialogHelperMessage('사용 가능한 연재 식별자입니다.');
      setIsKeyChecked(true);
      setCheckedSeriesKey(nextSeriesKey);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '연재 식별자 중복 확인에 실패했습니다.');
      } else {
        setDialogErrorMessage('연재 식별자 중복 확인에 실패했습니다.');
      }

      setDialogHelperMessage('');
      setIsKeyChecked(false);
      setCheckedSeriesKey('');
    } finally {
      setIsCheckingKey(false);
    }
  }

  async function handleCheckSeriesLabel() {
    if (!board) {
      return;
    }

    const nextSeriesLabel = normalizeText(seriesLabel);

    if (!nextSeriesLabel) {
      setIsLabelChecked(true);
      setCheckedSeriesLabel('');
      setDialogErrorMessage('');
      setDialogHelperMessage('연재명을 입력하지 않으면 식별자 기준으로 자동 등록됩니다.');
      return;
    }

    try {
      setDialogErrorMessage('');
      setDialogHelperMessage('');
      setIsCheckingLabel(true);

      const response = await fetch(
        buildCheckUrl({
          boardName: board.board_key,
          siteName,
          type: 'label',
          value: nextSeriesLabel,
          ignoreSeriesName: dialogMode === 'edit' && selectedSeries ? selectedSeries.series_key : '',
        }),
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as SeriesCheckResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '연재명 중복 확인에 실패했습니다.');
      }

      if (!result.available) {
        setDialogErrorMessage('이미 존재하는 연재명입니다.');
        setDialogHelperMessage('');
        setIsLabelChecked(false);
        setCheckedSeriesLabel('');
        return;
      }

      setDialogErrorMessage('');
      setDialogHelperMessage('사용 가능한 연재명입니다.');
      setIsLabelChecked(true);
      setCheckedSeriesLabel(nextSeriesLabel);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '연재명 중복 확인에 실패했습니다.');
      } else {
        setDialogErrorMessage('연재명 중복 확인에 실패했습니다.');
      }

      setDialogHelperMessage('');
      setIsLabelChecked(false);
      setCheckedSeriesLabel('');
    } finally {
      setIsCheckingLabel(false);
    }
  }

  async function handleSubmit() {
    if (!board || isSubmitting) {
      return;
    }

    const nextSeriesKey = normalizeText(seriesKey).toLowerCase();
    const nextSeriesLabel = normalizeText(seriesLabel);

    if (!nextSeriesKey) {
      setDialogErrorMessage('연재 식별자를 입력해주세요.');
      setDialogHelperMessage('');
      return;
    }

    if (!isKeyChecked || checkedSeriesKey !== nextSeriesKey) {
      setDialogErrorMessage('연재 식별자 중복 검사를 해주세요.');
      setDialogHelperMessage('');
      return;
    }

    if (nextSeriesLabel) {
      if (!isLabelChecked || checkedSeriesLabel !== nextSeriesLabel) {
        setDialogErrorMessage('연재명 중복 검사를 해주세요.');
        setDialogHelperMessage('');
        return;
      }
    }

    try {
      setDialogErrorMessage('');
      setDialogHelperMessage('');
      setIsSubmitting(true);

      const requestBody = {
        siteName,
        seriesKey: nextSeriesKey,
        seriesLabel: nextSeriesLabel || null,
        summary,
        thumbnailImage,
        userId: selectedUser?.particleId || null,
        isCompleted,
      };

      if (dialogMode === 'new') {
        const response = await fetch(`/api/boards/${board.board_key}/series/new`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(requestBody),
        });

        const result = (await response.json()) as SeriesSaveResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '연재 추가에 실패했습니다.');
        }

        if (!result.series) {
          throw new Error('연재 추가에 실패했습니다.');
        }

        setSeriesList((previousSeries) => [result.series as SeriesRow, ...previousSeries]);
        setDialogMode(null);
        setSelectedSeries(null);
        resetDialogFields();
        setSnackbarMessage('연재가 등록되었습니다.');
        return;
      }

      if (dialogMode === 'edit' && selectedSeries) {
        const response = await fetch(`/api/boards/${board.board_key}/series/${selectedSeries.series_key}/edit`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(requestBody),
        });

        const result = (await response.json()) as SeriesSaveResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '연재 수정에 실패했습니다.');
        }

        if (!result.series) {
          throw new Error('연재 수정에 실패했습니다.');
        }

        setSeriesList((previousSeries) =>
          previousSeries.map((series) => (series.id === result.series?.id ? (result.series as SeriesRow) : series)),
        );

        setDialogMode(null);
        setSelectedSeries(null);
        resetDialogFields();
        setSnackbarMessage('연재가 수정되었습니다.');
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '연재 저장에 실패했습니다.');
      } else {
        setDialogErrorMessage('연재 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!board || !selectedSeries || isSubmitting) {
      return;
    }

    try {
      setDialogErrorMessage('');
      setDialogHelperMessage('');
      setIsSubmitting(true);

      const response = await fetch(
        `/api/boards/${board.board_key}/series/${selectedSeries.series_key}/delete?siteName=${siteName}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as SeriesDeleteResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '연재 삭제에 실패했습니다.');
      }

      setSeriesList((previousSeries) => previousSeries.filter((series) => series.id !== selectedSeries.id));
      setDialogMode(null);
      setSelectedSeries(null);
      resetDialogFields();
      setSnackbarMessage('연재가 삭제되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '연재 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('연재 삭제에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/c/${boardName}`} menu="contents">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts/c/${boardName}`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {isMobile ? (
            <Typography variant="h5" component="h2" sx={{ p: 2 }}>
              연재 관리
            </Typography>
          ) : null}
          <Stack direction="row" justifyContent="flex-end" sx={{ p: 2, pb: 0 }}>
            <button type="button" className="button small action" onClick={handleOpenNewDialog}>
              연재 추가
            </button>
          </Stack>

          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          {sortedSeries.length === 0 ? (
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>등록된 연재가 없습니다.</span>
            </p>
          ) : (
            <div className={`paper paper-p0 ${styles.paper}`}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>식별자</TableCell>
                    <TableCell>연재명</TableCell>
                    <TableCell>완결</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>마지막 연재</TableCell>
                    <TableCell>생성일</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>

                <TableBody>
                  {sortedSeries.map((series) => (
                    <TableRow key={series.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{series.series_key}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{series.series_label}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{series.is_completed ? '완결' : '연재중'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {series.last_published_at ? formatDateTimeDetail(series.last_published_at) : ''}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTimeDetail(series.created_at)}</TableCell>

                      <TableCell align="right">
                        <Stack direction="row" gap={1} justifyContent="flex-end">
                          <button
                            type="button"
                            className="button small cancel"
                            onClick={() => handleOpenEditDialog(series)}
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            className="button small danger"
                            onClick={() => handleOpenDeleteDialog(series)}
                          >
                            삭제
                          </button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={dialogMode === 'new' || dialogMode === 'edit'}
              onClose={handleCloseDialog}
              className="VhiDrawer-bottom"
            >
              <h2>{dialogMode === 'new' ? '연재 추가' : '연재 수정'}</h2>
              <button
                className="close-button"
                onClick={handleCloseDialog}
                disabled={isSubmitting || isUploadingImage || isDeletingImage}
                aria-label="닫기"
              >
                <CloseRoundedIcon />
              </button>

              <Stack gap={2} sx={{ pt: 1 }}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Stack gap={1}>
                    <Typography variant="subtitle2">연재 식별자 *</Typography>

                    <TextField
                      value={seriesKey}
                      onChange={handleSeriesKeyChange}
                      fullWidth
                      required
                      size="small"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <button
                                type="button"
                                className="button small action"
                                onClick={handleCheckSeriesKey}
                                disabled={isCheckingKey}
                              >
                                중복 확인
                              </button>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Stack>

                  <Stack gap={1}>
                    <Typography variant="subtitle2">연재명</Typography>

                    <TextField
                      value={seriesLabel}
                      onChange={handleSeriesLabelChange}
                      fullWidth
                      size="small"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <button
                                type="button"
                                className="button small action"
                                onClick={handleCheckSeriesLabel}
                                disabled={isCheckingLabel}
                              >
                                중복 확인
                              </button>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Stack>

                  <Stack gap={1}>
                    <Typography variant="subtitle2">연재 설명</Typography>

                    <TextField
                      value={summary}
                      onChange={handleSummaryChange}
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                    />
                  </Stack>

                  <Stack gap={1} direction="column">
                    <Stack gap={1} direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                      <Typography variant="subtitle2">연재 썸네일 이미지</Typography>

                      <Stack direction="row" gap={1}>
                        <Button component="label" className="button small action" disabled={isUploadingImage}>
                          이미지 선택
                          <VisuallyHiddenInput
                            ref={fileInputReference}
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                          />
                        </Button>

                        {thumbnailImage ? (
                          <button
                            type="button"
                            className="button small danger"
                            onClick={handleDeleteImage}
                            disabled={isDeletingImage}
                          >
                            이미지 삭제
                          </button>
                        ) : null}
                      </Stack>
                    </Stack>

                    {thumbnailImageUrl ? (
                      <Box
                        component="img"
                        src={thumbnailImageUrl}
                        alt="연재 썸네일"
                        sx={{ maxWidth: 320, height: 'auto', display: 'block', borderRadius: 1 }}
                      />
                    ) : null}
                  </Stack>

                  <div className={`paper ${styles['paper-sub']}`} style={{ marginTop: 12 }}>
                    <Stack gap={1}>
                      {selectedUser ? (
                        <Stack gap={0.5}>
                          <Box>
                            <Typography variant="subtitle2">이메일</Typography>
                            <Typography variant="body2">{selectedUser.email || selectedUser.particleId}</Typography>
                          </Box>
                          {selectedUser.userName ? (
                            <Box>
                              <Typography variant="subtitle2">활동명</Typography>
                              <Typography variant="body2">{selectedUser.userName}</Typography>
                            </Box>
                          ) : null}
                          {selectedUser.nickname ? (
                            <Box>
                              <Typography variant="subtitle2">닉네임</Typography>
                              <Typography variant="body2">{selectedUser.nickname}</Typography>
                            </Box>
                          ) : null}
                        </Stack>
                      ) : (
                        <p className="alert warning">
                          <WarningAmberRoundedIcon />
                          <span>멤버를 지정하지 않으면 누구든지 해당 연재명으로 연재글을 게시할 수 있습니다.</span>
                        </p>
                      )}
                      <Stack direction="column" gap={1}>
                        {selectedUser ? (
                          <>
                            <Typography variant="subtitle2">연재가능 멤버 취소</Typography>
                            <button type="button" className="button small danger" onClick={handleClearUser}>
                              멤버 지정 취소
                            </button>
                          </>
                        ) : (
                          <>
                            <Typography variant="subtitle2">연재가능 멤버 지정</Typography>
                            <button type="button" className="button small action" onClick={handleOpenUserDialog}>
                              멤버 검색
                            </button>
                          </>
                        )}
                      </Stack>
                    </Stack>

                    {dialogMode !== 'new' && (
                      <Stack direction="row" gap={1} alignItems="center">
                        <FormControlLabel
                          control={<Checkbox checked={isCompleted} onChange={handleIsCompletedChange} />}
                          label="완결"
                        />
                        {isCompleted && (
                          <p className="alert warning">
                            <WarningAmberRoundedIcon />
                            <span>완결 처리된 연재는 다시 연재중으로 변경할 수 없습니다.</span>
                          </p>
                        )}
                      </Stack>
                    )}
                  </div>

                  {dialogHelperMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogHelperMessage}</span>
                    </p>
                  ) : null}

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseDialog}
                    disabled={isSubmitting || isUploadingImage || isDeletingImage}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={handleSubmit}
                    disabled={isSubmitting || isUploadingImage || isDeletingImage}
                  >
                    저장
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={dialogMode === 'new' || dialogMode === 'edit'}
              onClose={handleCloseDialog}
              fullWidth
              maxWidth="sm"
              className="VhiDialog"
            >
              <DialogTitle>{dialogMode === 'new' ? '연재 추가' : '연재 수정'}</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseDialog}
                disabled={isSubmitting || isUploadingImage || isDeletingImage}
                aria-label="닫기"
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  {dialogHelperMessage ? (
                    <p className="alert info">
                      <InfoOutlineRoundedIcon />
                      <span>{dialogHelperMessage}</span>
                    </p>
                  ) : null}

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}

                  <Stack gap={1}>
                    <Typography variant="subtitle2">연재 식별자 *</Typography>
                    <TextField
                      value={seriesKey}
                      onChange={handleSeriesKeyChange}
                      fullWidth
                      required
                      size="small"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <button
                                type="button"
                                className="button small action"
                                onClick={handleCheckSeriesKey}
                                disabled={isCheckingKey}
                              >
                                중복 확인
                              </button>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Stack>

                  <Stack gap={1}>
                    <Typography variant="subtitle2">연재명</Typography>
                    <TextField
                      value={seriesLabel}
                      onChange={handleSeriesLabelChange}
                      fullWidth
                      size="small"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <button
                                type="button"
                                className="button small action"
                                onClick={handleCheckSeriesLabel}
                                disabled={isCheckingLabel}
                              >
                                중복 확인
                              </button>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                  </Stack>

                  <Stack gap={1}>
                    <Typography variant="subtitle2">연재 설명</Typography>
                    <TextField
                      value={summary}
                      onChange={handleSummaryChange}
                      fullWidth
                      multiline
                      minRows={3}
                      size="small"
                    />
                  </Stack>

                  <Stack gap={1} direction="column">
                    <Stack gap={1} direction="row" justifyContent="space-between" sx={{ width: '100%' }}>
                      <Typography variant="subtitle2">연재 썸네일 이미지</Typography>

                      <Stack direction="row" gap={1}>
                        <Button component="label" className="button small action" disabled={isUploadingImage}>
                          이미지 선택
                          <VisuallyHiddenInput
                            ref={fileInputReference}
                            type="file"
                            accept="image/*"
                            onChange={handleImageFileChange}
                          />
                        </Button>

                        {thumbnailImage ? (
                          <button
                            type="button"
                            className="button small danger"
                            onClick={handleDeleteImage}
                            disabled={isDeletingImage}
                          >
                            이미지 삭제
                          </button>
                        ) : null}
                      </Stack>
                    </Stack>

                    {thumbnailImageUrl ? (
                      <Box
                        component="img"
                        src={thumbnailImageUrl}
                        alt="연재 썸네일"
                        sx={{
                          maxWidth: 320,
                          height: 'auto',
                          display: 'block',
                          borderRadius: 1,
                        }}
                      />
                    ) : null}
                  </Stack>

                  <div className={`paper ${styles['paper-sub']}`} style={{ marginTop: 12 }}>
                    <Stack gap={1}>
                      {selectedUser ? (
                        <Stack gap={0.5}>
                          <Box>
                            <Typography variant="subtitle2">이메일</Typography>
                            <Typography variant="body2">{selectedUser.email || selectedUser.particleId}</Typography>
                          </Box>
                          {selectedUser.userName ? (
                            <Box>
                              <Typography variant="subtitle2">활동명</Typography>
                              <Typography variant="body2">{selectedUser.userName}</Typography>
                            </Box>
                          ) : null}
                          {selectedUser.nickname ? (
                            <Box>
                              <Typography variant="subtitle2">닉네임</Typography>
                              <Typography variant="body2">{selectedUser.nickname}</Typography>
                            </Box>
                          ) : null}
                        </Stack>
                      ) : (
                        <p className="alert warning">
                          <WarningAmberRoundedIcon />
                          <span>멤버를 지정하지 않으면 누구든지 해당 연재명으로 연재글을 게시할 수 있습니다.</span>
                        </p>
                      )}
                      <Stack direction="column" gap={1}>
                        {selectedUser ? (
                          <>
                            <Typography variant="subtitle2">연재가능 멤버 취소</Typography>
                            <button type="button" className="button small danger" onClick={handleClearUser}>
                              멤버 지정 취소
                            </button>
                          </>
                        ) : (
                          <>
                            <Typography variant="subtitle2">연재가능 멤버 지정</Typography>
                            <button type="button" className="button small action" onClick={handleOpenUserDialog}>
                              멤버 검색
                            </button>
                          </>
                        )}
                      </Stack>
                    </Stack>

                    {dialogMode !== 'new' && (
                      <Stack direction="row" gap={1} alignItems="center">
                        <FormControlLabel
                          control={<Checkbox checked={isCompleted} onChange={handleIsCompletedChange} />}
                          label="완결"
                        />

                        {isCompleted && (
                          <p className="alert warning">
                            <WarningAmberRoundedIcon />
                            <span>완결 처리된 연재는 다시 연재중으로 변경할 수 없습니다.</span>
                          </p>
                        )}
                      </Stack>
                    )}
                  </div>

                  {dialogHelperMessage ? (
                    <p className="alert info">
                      <InfoOutlineRoundedIcon />
                      <span>{dialogHelperMessage}</span>
                    </p>
                  ) : null}

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseDialog}
                  disabled={isSubmitting || isUploadingImage || isDeletingImage}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={handleSubmit}
                  disabled={isSubmitting || isUploadingImage || isDeletingImage}
                >
                  저장
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={dialogMode === 'delete'}
              onClose={handleCloseDialog}
              className="VhiDrawer-bottom"
            >
              <h2>연재 삭제</h2>
              <button className="close-button" onClick={handleCloseDialog} disabled={isSubmitting} aria-label="닫기">
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography variant="body2">해당 연재를 삭제하시겠습니까?</Typography>

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>

                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseDialog}
                    disabled={isSubmitting}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium warning"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                  >
                    삭제
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={dialogMode === 'delete'}
              onClose={handleCloseDialog}
              fullWidth
              maxWidth="xs"
              className="VhiDialog"
            >
              <DialogTitle>연재 삭제</DialogTitle>
              <button className="close-button" onClick={handleCloseDialog} disabled={isSubmitting} aria-label="닫기">
                <CloseRoundedIcon />
              </button>

              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography variant="body2">해당 연재를 삭제하시겠습니까?</Typography>

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseDialog}
                  disabled={isSubmitting}
                >
                  취소
                </button>
                <button type="button" className="button medium warning" onClick={handleDelete} disabled={isSubmitting}>
                  삭제
                </button>
              </DialogActions>
            </Dialog>
          )}

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={isUserDialogOpen}
              onClose={handleCloseUserDialog}
              className="VhiDrawer-bottom"
            >
              <h2>사용자 검색</h2>
              <button
                className="close-button"
                onClick={handleCloseUserDialog}
                disabled={isUserSearching}
                aria-label="닫기"
              >
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <TextField
                      placeholder="이메일, 활동명, 닉네임 검색"
                      value={userSearchKeyword}
                      onChange={handleUserSearchKeywordChange}
                      fullWidth
                      size="small"
                    />
                    <button
                      type="button"
                      className="button medium submit"
                      onClick={handleSearchUsers}
                      disabled={isUserSearching}
                    >
                      검색
                    </button>
                  </Stack>

                  <div className={`paper paper-p0 ${styles.paper}`}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>이메일</TableCell>
                          <TableCell>활동명</TableCell>
                          <TableCell>닉네임</TableCell>
                          <TableCell align="right">선택</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {searchedUsers.map((user) => (
                          <TableRow key={user.particleId}>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.userName}</TableCell>
                            <TableCell>{user.nickname}</TableCell>
                            <TableCell align="right">
                              <button
                                type="button"
                                className="button small action"
                                onClick={() => handleSelectUser(user)}
                              >
                                선택
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}

                        {searchedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              검색 결과가 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </Stack>
                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseUserDialog}
                    disabled={isUserSearching}
                  >
                    닫기
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={isUserDialogOpen}
              onClose={handleCloseUserDialog}
              fullWidth
              maxWidth="md"
              className="VhiDialog"
            >
              <DialogTitle>사용자 검색</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseUserDialog}
                disabled={isUserSearching}
                aria-label="닫기"
              >
                <CloseRoundedIcon />
              </button>

              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Stack direction="row" gap={1} alignItems="center">
                    <TextField
                      placeholder="이메일, 활동명, 닉네임 검색"
                      value={userSearchKeyword}
                      onChange={handleUserSearchKeywordChange}
                      fullWidth
                      size="small"
                    />
                    <button
                      type="button"
                      className="button medium submit"
                      onClick={handleSearchUsers}
                      disabled={isUserSearching}
                    >
                      검색
                    </button>
                  </Stack>

                  <div className={`paper paper-p0 ${styles.paper}`}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>이메일</TableCell>
                          <TableCell>활동명</TableCell>
                          <TableCell>닉네임</TableCell>
                          <TableCell align="right">선택</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {searchedUsers.map((user) => (
                          <TableRow key={user.particleId}>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>{user.userName}</TableCell>
                            <TableCell>{user.nickname}</TableCell>
                            <TableCell align="right">
                              <button
                                type="button"
                                className="button small action"
                                onClick={() => handleSelectUser(user)}
                              >
                                선택
                              </button>
                            </TableCell>
                          </TableRow>
                        ))}

                        {searchedUsers.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} align="center">
                              검색 결과가 없습니다.
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </div>
                </Stack>
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseUserDialog}
                  disabled={isUserSearching}
                >
                  닫기
                </button>
              </DialogActions>
            </Dialog>
          )}

          <Snackbar
            open={Boolean(snackbarMessage)}
            autoHideDuration={2700}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            onClose={() => setSnackbarMessage('')}
            sx={{ zIndex: 20007 }}
            message={snackbarMessage}
          />
        </div>
      </div>
    </Container>
  );
}
