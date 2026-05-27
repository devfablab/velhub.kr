'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type JSX } from 'react';
import { useParams } from 'next/navigation';
import { closestCenter, DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  InputAdornment,
  styled,
  Button,
  Snackbar,
  Drawer,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type CategoryRow = {
  id: string;
  category_key: string;
  category_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  sort_order: number;
  board_id: string;
  site_id: string;
  created_at?: string;
};

type BoardRow = {
  id: string;
  board_key: string;
  board_label: string;
  board_type: string;
  site_id: string;
};

type CategoryListResponse = {
  board?: BoardRow;
  categories?: CategoryRow[];
  error?: string;
};

type CategoryDetailResponse = {
  board?: BoardRow;
  category?: CategoryRow;
  error?: string;
};

type CategorySaveResponse = {
  ok?: boolean;
  category?: CategoryRow;
  error?: string;
};

type CategoryDeleteResponse = {
  ok?: boolean;
  error?: string;
};

type CategoryOrderResponse = {
  ok?: boolean;
  error?: string;
};

type StatusResponse = {
  hasBoard: boolean;
  boardName: string | null;
};

type CategoryCheckResponse = {
  ok?: boolean;
  available?: boolean;
  error?: string;
};

type CategoryImageUploadResponse = {
  ok?: boolean;
  thumbnailImage?: string;
  url?: string;
  error?: string;
};

type DialogMode = 'new' | 'edit' | 'delete' | null;

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

function isValidCategoryKey(value: string) {
  if (value.length < 2 || value.length > 16) {
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

function getCategoryImageUrl(value: string) {
  const imagePath = normalizeText(value);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  if (!supabaseUrl || !imagePath) {
    return '';
  }

  return `${supabaseUrl}/storage/v1/object/public/category/${imagePath}`;
}

function buildCheckUrl({
  boardName,
  siteName,
  type,
  value,
  ignoreCategoryName,
}: {
  boardName: string;
  siteName: string;
  type: 'key' | 'label';
  value: string;
  ignoreCategoryName?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set('siteName', siteName);
  searchParams.set('type', type);
  searchParams.set('value', value);

  if (ignoreCategoryName) {
    searchParams.set('ignoreCategoryName', ignoreCategoryName);
  }

  return `/api/boards/${boardName}/category/check?${searchParams.toString()}`;
}

function SortableCategoryRow({
  category,
  onEdit,
  onDelete,
}: {
  category: CategoryRow;
  onEdit: (category: CategoryRow) => void;
  onDelete: (category: CategoryRow) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: category.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <Box
          {...attributes}
          {...listeners}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'grab',
            width: 'fit-content',
          }}
        >
          <DragIndicatorIcon />
        </Box>
      </TableCell>

      <TableCell sx={{ whiteSpace: 'nowrap' }}>{category.category_key}</TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{category.category_label}</TableCell>
      <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{category.summary || ''}</TableCell>

      <TableCell>
        {category.thumbnail_image ? (
          <Box
            component="img"
            src={getCategoryImageUrl(category.thumbnail_image)}
            alt={category.category_label}
            sx={{
              width: 80,
              height: 80,
              objectFit: 'cover',
              display: 'block',
              borderRadius: 1,
            }}
          />
        ) : null}
      </TableCell>

      <TableCell align="right">
        <Stack direction="row" gap={1} justifyContent="flex-end">
          <button type="button" className="button small action" onClick={() => onEdit(category)}>
            수정
          </button>
          <button type="button" className="button small danger" onClick={() => onDelete(category)}>
            삭제
          </button>
        </Stack>
      </TableCell>
    </TableRow>
  );
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotTablet = useMediaQuery(theme.breakpoints.up('lg'));
  const isTablet = !isNotTablet;
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [board, setBoard] = useState<BoardRow | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryRow | null>(null);
  const [categoryKey, setCategoryKey] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [summary, setSummary] = useState('');
  const [thumbnailImage, setThumbnailImage] = useState('');
  const [thumbnailImageUrl, setThumbnailImageUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isOrderChanged, setIsOrderChanged] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(false);
  const [isCheckingLabel, setIsCheckingLabel] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDeletingImage, setIsDeletingImage] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [dialogSuccessMessage, setDialogSuccessMessage] = useState('');
  const [isKeyChecked, setIsKeyChecked] = useState(false);
  const [isLabelChecked, setIsLabelChecked] = useState(false);
  const [checkedCategoryKey, setCheckedCategoryKey] = useState('');
  const [checkedCategoryLabel, setCheckedCategoryLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => {
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }

      return a.category_key.localeCompare(b.category_key);
    });
  }, [categories]);

  useEffect(() => {
    async function loadCategories() {
      try {
        setErrorMessage('');

        const statusResponse = await fetch(`/api/manage/contents/blog-posts/status?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const statusResult = (await statusResponse.json()) as StatusResponse | { error?: string };

        if (!statusResponse.ok) {
          throw new Error(
            'error' in statusResult
              ? statusResult.error || '블로그 상태를 확인하지 못했습니다.'
              : '블로그 상태를 확인하지 못했습니다.',
          );
        }

        if (!('hasBoard' in statusResult) || !('boardName' in statusResult)) {
          throw new Error('블로그 상태를 확인하지 못했습니다.');
        }

        if (!statusResult.hasBoard || !statusResult.boardName) {
          throw new Error('블로그 게시판을 찾을 수 없습니다.');
        }

        const response = await fetch(`/api/boards/${statusResult.boardName}/category?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as CategoryListResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '카테고리 목록을 불러오지 못했습니다.');
        }

        if (!result.board) {
          throw new Error('카테고리 목록을 불러오지 못했습니다.');
        }

        setBoard(result.board);
        setCategories(Array.isArray(result.categories) ? result.categories : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '카테고리 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('카테고리 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadCategories();
  }, [siteName]);

  function resetDialogFields() {
    setCategoryKey('');
    setCategoryLabel('');
    setSummary('');
    setThumbnailImage('');
    setThumbnailImageUrl('');
    setDialogErrorMessage('');
    setDialogSuccessMessage('');
    setIsKeyChecked(false);
    setIsLabelChecked(false);
    setCheckedCategoryKey('');
    setCheckedCategoryLabel('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleOpenNewDialog() {
    setDialogMode('new');
    setSelectedCategory(null);
    resetDialogFields();
  }

  async function handleOpenEditDialog(category: CategoryRow) {
    if (!board) {
      return;
    }

    try {
      setDialogErrorMessage('');
      setDialogSuccessMessage('');

      const response = await fetch(
        `/api/boards/${board.board_key}/category/${category.category_key}?siteName=${siteName}`,
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as CategoryDetailResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '카테고리 정보를 불러오지 못했습니다.');
      }

      if (!result.category) {
        throw new Error('카테고리 정보를 불러오지 못했습니다.');
      }

      const nextThumbnailImage = result.category.thumbnail_image || '';

      setSelectedCategory(result.category);
      setCategoryKey(result.category.category_key);
      setCategoryLabel(result.category.category_label);
      setSummary(result.category.summary || '');
      setThumbnailImage(nextThumbnailImage);
      setThumbnailImageUrl(getCategoryImageUrl(nextThumbnailImage));
      setIsKeyChecked(true);
      setIsLabelChecked(true);
      setCheckedCategoryKey(result.category.category_key);
      setCheckedCategoryLabel(result.category.category_label);
      setDialogMode('edit');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '카테고리 정보를 불러오지 못했습니다.');
      } else {
        setErrorMessage('카테고리 정보를 불러오지 못했습니다.');
      }
    }
  }

  function handleOpenDeleteDialog(category: CategoryRow) {
    setSelectedCategory(category);
    setDialogMode('delete');
    setDialogErrorMessage('');
    setDialogSuccessMessage('');
  }

  function handleCloseDialog() {
    if (isSubmitting || isUploadingImage || isDeletingImage) {
      return;
    }

    setDialogMode(null);
    setSelectedCategory(null);
    resetDialogFields();
  }

  function handleCategoryKeyChange(event: InputChangeEvent) {
    setCategoryKey(event.currentTarget.value);
    setDialogErrorMessage('');
    setDialogSuccessMessage('');
    setIsKeyChecked(false);
    setCheckedCategoryKey('');
  }

  function handleCategoryLabelChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    setCategoryLabel(nextValue);
    setDialogErrorMessage('');
    setDialogSuccessMessage('');

    if (!normalizeText(nextValue)) {
      setIsLabelChecked(true);
      setCheckedCategoryLabel('');
      return;
    }

    setIsLabelChecked(false);
    setCheckedCategoryLabel('');
  }

  function handleSummaryChange(event: InputChangeEvent) {
    setSummary(event.currentTarget.value);
    setDialogErrorMessage('');
    setDialogSuccessMessage('');
  }

  async function handleImageFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    try {
      setIsUploadingImage(true);
      setDialogErrorMessage('');
      setDialogSuccessMessage('');

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/attachment/add/category-image', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = (await response.json()) as CategoryImageUploadResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '카테고리 이미지 업로드에 실패했습니다.');
      }

      if (!result.thumbnailImage) {
        throw new Error('카테고리 이미지 업로드에 실패했습니다.');
      }

      setThumbnailImage(result.thumbnailImage);
      setThumbnailImageUrl(result.url ?? '');
      setDialogSuccessMessage('카테고리 이미지가 업로드되었습니다.');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '카테고리 이미지 업로드에 실패했습니다.');
      } else {
        setDialogErrorMessage('카테고리 이미지 업로드에 실패했습니다.');
      }
      setDialogSuccessMessage('');
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
      setDialogSuccessMessage('');

      const response = await fetch('/api/attachment/delete/category-image', {
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
        throw new Error(result.error ?? '카테고리 이미지 삭제에 실패했습니다.');
      }

      setThumbnailImage('');
      setThumbnailImageUrl('');
      setDialogSuccessMessage('카테고리 이미지가 삭제되었습니다.');

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '카테고리 이미지 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('카테고리 이미지 삭제에 실패했습니다.');
      }
      setDialogSuccessMessage('');
    } finally {
      setIsDeletingImage(false);
    }
  }

  async function handleCheckCategoryKey() {
    if (!board) {
      return;
    }

    const nextCategoryKey = normalizeText(categoryKey).toLowerCase();

    if (!nextCategoryKey) {
      setDialogErrorMessage('카테고리 식별자를 입력해주세요.');
      setDialogSuccessMessage('');
      return;
    }

    if (!isValidCategoryKey(nextCategoryKey)) {
      setDialogErrorMessage(
        '카테고리 식별자는 2자 이상 16자 이하여야 하며, 영소문자/숫자/하이픈/언더스코어만 사용할 수 있고, 최소 한 글자의 영문자를 포함해야 합니다.',
      );
      setDialogSuccessMessage('');
      setIsKeyChecked(false);
      setCheckedCategoryKey('');
      return;
    }

    try {
      setDialogErrorMessage('');
      setDialogSuccessMessage('');
      setIsCheckingKey(true);

      const response = await fetch(
        buildCheckUrl({
          boardName: board.board_key,
          siteName,
          type: 'key',
          value: nextCategoryKey,
          ignoreCategoryName: dialogMode === 'edit' && selectedCategory ? selectedCategory.category_key : '',
        }),
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as CategoryCheckResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '카테고리 식별자 중복 확인에 실패했습니다.');
      }

      if (!result.available) {
        setDialogErrorMessage('이미 존재하는 카테고리 식별자입니다.');
        setDialogSuccessMessage('');
        setIsKeyChecked(false);
        setCheckedCategoryKey('');
        return;
      }

      setDialogErrorMessage('');
      setDialogSuccessMessage('사용 가능한 카테고리 식별자입니다.');
      setIsKeyChecked(true);
      setCheckedCategoryKey(nextCategoryKey);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '카테고리 식별자 중복 확인에 실패했습니다.');
      } else {
        setDialogErrorMessage('카테고리 식별자 중복 확인에 실패했습니다.');
      }
      setDialogSuccessMessage('');
      setIsKeyChecked(false);
      setCheckedCategoryKey('');
    } finally {
      setIsCheckingKey(false);
    }
  }

  async function handleCheckCategoryLabel() {
    if (!board) {
      return;
    }

    const nextCategoryLabel = normalizeText(categoryLabel);

    if (!nextCategoryLabel) {
      setIsLabelChecked(true);
      setCheckedCategoryLabel('');
      setDialogErrorMessage('');
      setDialogSuccessMessage('카테고리명을 입력하지 않으면 식별자 기준으로 자동 등록됩니다.');
      return;
    }

    try {
      setDialogErrorMessage('');
      setDialogSuccessMessage('');
      setIsCheckingLabel(true);

      const response = await fetch(
        buildCheckUrl({
          boardName: board.board_key,
          siteName,
          type: 'label',
          value: nextCategoryLabel,
          ignoreCategoryName: dialogMode === 'edit' && selectedCategory ? selectedCategory.category_key : '',
        }),
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as CategoryCheckResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '카테고리명 중복 확인에 실패했습니다.');
      }

      if (!result.available) {
        setDialogErrorMessage('이미 존재하는 카테고리명입니다.');
        setDialogSuccessMessage('');
        setIsLabelChecked(false);
        setCheckedCategoryLabel('');
        return;
      }

      setDialogErrorMessage('');
      setDialogSuccessMessage('사용 가능한 카테고리명입니다.');
      setIsLabelChecked(true);
      setCheckedCategoryLabel(nextCategoryLabel);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '카테고리명 중복 확인에 실패했습니다.');
      } else {
        setDialogErrorMessage('카테고리명 중복 확인에 실패했습니다.');
      }
      setDialogSuccessMessage('');
      setIsLabelChecked(false);
      setCheckedCategoryLabel('');
    } finally {
      setIsCheckingLabel(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setCategories((previousCategories) => {
      const oldIndex = previousCategories.findIndex((category) => category.id === active.id);
      const newIndex = previousCategories.findIndex((category) => category.id === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return previousCategories;
      }

      setIsOrderChanged(true);

      return arrayMove(previousCategories, oldIndex, newIndex).map((category, index) => ({
        ...category,
        sort_order: index + 1,
      }));
    });
  }

  async function handleSaveOrder() {
    if (!board || isOrdering || categories.length === 0) {
      return;
    }

    try {
      setErrorMessage('');
      setIsOrdering(true);

      const response = await fetch(`/api/boards/${board.board_key}/category/order`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          categories: categories.map((category, index) => ({
            categoryName: category.category_key,
            sortOrder: index + 1,
          })),
        }),
      });

      const result = (await response.json()) as CategoryOrderResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '카테고리 순서 저장에 실패했습니다.');
      }

      setCategories((previousCategories) =>
        previousCategories.map((category, index) => ({
          ...category,
          sort_order: index + 1,
        })),
      );
      setIsOrderChanged(false);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '카테고리 순서 저장에 실패했습니다.');
      } else {
        setErrorMessage('카테고리 순서 저장에 실패했습니다.');
      }
    } finally {
      setIsOrdering(false);
    }
  }

  async function handleSubmit() {
    if (!board || isSubmitting) {
      return;
    }

    const nextCategoryKey = normalizeText(categoryKey).toLowerCase();
    const nextCategoryLabel = normalizeText(categoryLabel);

    if (!nextCategoryKey) {
      setDialogErrorMessage('카테고리 식별자를 입력해주세요.');
      setDialogSuccessMessage('');
      return;
    }

    if (!isKeyChecked || checkedCategoryKey !== nextCategoryKey) {
      setDialogErrorMessage('카테고리 식별자 중복 검사를 해주세요.');
      setDialogSuccessMessage('');
      return;
    }

    if (nextCategoryLabel) {
      if (!isLabelChecked || checkedCategoryLabel !== nextCategoryLabel) {
        setDialogErrorMessage('카테고리명 중복 검사를 해주세요.');
        setDialogSuccessMessage('');
        return;
      }
    }

    try {
      setDialogErrorMessage('');
      setDialogSuccessMessage('');
      setIsSubmitting(true);

      const requestBody = {
        siteName,
        categoryKey: nextCategoryKey,
        categoryLabel: nextCategoryLabel || null,
        summary,
        thumbnailImage,
      };

      if (dialogMode === 'new') {
        const response = await fetch(`/api/boards/${board.board_key}/category/new`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(requestBody),
        });

        const result = (await response.json()) as CategorySaveResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '카테고리 등록에 실패했습니다.');
        }

        const nextCategory = result.category;

        if (!nextCategory) {
          throw new Error('카테고리 등록에 실패했습니다.');
        }

        setCategories((previousCategories) => [...previousCategories, nextCategory]);
        setDialogMode(null);
        setSelectedCategory(null);
        resetDialogFields();
        return;
      }

      if (dialogMode === 'edit' && selectedCategory) {
        const response = await fetch(`/api/boards/${board.board_key}/category/${selectedCategory.category_key}/edit`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(requestBody),
        });

        const result = (await response.json()) as CategorySaveResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '카테고리 수정에 실패했습니다.');
        }

        const nextCategory = result.category;

        if (!nextCategory) {
          throw new Error('카테고리 수정에 실패했습니다.');
        }

        setCategories((previousCategories) =>
          previousCategories.map((category) => (category.id === nextCategory.id ? nextCategory : category)),
        );
        setDialogMode(null);
        setSelectedCategory(null);
        resetDialogFields();
      }
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '카테고리 저장에 실패했습니다.');
      } else {
        setDialogErrorMessage('카테고리 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!board || !selectedCategory || isSubmitting) {
      return;
    }

    try {
      setDialogErrorMessage('');
      setDialogSuccessMessage('');
      setIsSubmitting(true);

      const response = await fetch(
        `/api/boards/${board.board_key}/category/${selectedCategory.category_key}/delete?siteName=${siteName}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as CategoryDeleteResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '카테고리 삭제에 실패했습니다.');
      }

      setCategories((previousCategories) =>
        previousCategories.filter((category) => category.id !== selectedCategory.id),
      );
      setDialogMode(null);
      setSelectedCategory(null);
      resetDialogFields();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || '카테고리 삭제에 실패했습니다.');
      } else {
        setDialogErrorMessage('카테고리 삭제에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    setBaseUrl(window.location.origin);
  }, []);

  if (isLoading) {
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts`} menu="contents">
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
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage/contents/posts`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {isMobile ? (
            <Typography variant="h5" component="h2" sx={{ p: 2 }}>
              카테고리 관리
            </Typography>
          ) : null}

          <Stack direction="row" justifyContent="flex-end" alignItems="center" gap={1} sx={{ p: 1, pb: 0 }}>
            <button type="button" className="button small action" onClick={handleOpenNewDialog}>
              카테고리 추가
            </button>
            {isOrderChanged ? (
              <button type="button" className="button small submit" onClick={handleSaveOrder} disabled={isOrdering}>
                순서 저장
              </button>
            ) : null}
          </Stack>

          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          {isOrderChanged ? (
            <p className="alert info">
              <InfoOutlineRoundedIcon />
              <span>순서를 변경하시면 반드시 저장을 눌러주세요.</span>
            </p>
          ) : null}

          {sortedCategories.length === 0 ? (
            <p className="alert warning">
              <WarningAmberRoundedIcon />
              <span>등록된 카테고리가 없습니다.</span>
            </p>
          ) : (
            <div className={`paper paper-p0 ${styles.paper}`}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={sortedCategories.map((category) => category.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell width={64}></TableCell>
                        <TableCell>식별자</TableCell>
                        <TableCell>카테고리명</TableCell>
                        <TableCell>설명</TableCell>
                        <TableCell>썸네일</TableCell>
                        <TableCell />
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {sortedCategories.map((category) => (
                        <SortableCategoryRow
                          key={category.id}
                          category={category}
                          onEdit={handleOpenEditDialog}
                          onDelete={handleOpenDeleteDialog}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </SortableContext>
              </DndContext>
            </div>
          )}

          {isTablet ? (
            <Drawer
              anchor="bottom"
              open={dialogMode === 'new' || dialogMode === 'edit'}
              onClose={handleCloseDialog}
              className="VhiDrawer-bottom"
            >
              <h2>{dialogMode === 'new' ? '카테고리 추가' : '카테고리 수정'}</h2>
              <button
                className="close-button"
                onClick={handleCloseDialog}
                aria-label="닫기"
                disabled={isSubmitting || isUploadingImage || isDeletingImage}
              >
                <CloseRoundedIcon />
              </button>
              <Stack gap={3.5}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Stack gap={1}>
                    <Typography variant="subtitle2">사이트 식별자</Typography>
                    <TextField
                      value={categoryKey}
                      onChange={handleCategoryKeyChange}
                      fullWidth
                      required
                      size="medium"
                      helperText="영문 소문자, 숫자, 하이픈('-')만 사용할 수 있습니다."
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              {baseUrl}/{siteName}/b/c/
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <button
                                type="button"
                                className="button small action"
                                onClick={handleCheckCategoryKey}
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
                    <Typography variant="subtitle2">카테고리명</Typography>
                    <TextField
                      value={categoryLabel}
                      onChange={handleCategoryLabelChange}
                      fullWidth
                      size="medium"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <button
                                type="button"
                                className="button small action"
                                onClick={handleCheckCategoryLabel}
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
                    <Typography variant="subtitle2">카테고리 설명</Typography>
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
                      <Typography variant="subtitle2">카테고리 썸네일 이미지</Typography>

                      <Stack direction="row" gap={1}>
                        <Button component="label" className="button small action" disabled={isUploadingImage}>
                          이미지 선택
                          <VisuallyHiddenInput
                            ref={fileInputRef}
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
                        alt="카테고리 썸네일"
                        sx={{ maxWidth: 320, height: 'auto', display: 'block', borderRadius: 1 }}
                      />
                    ) : null}
                  </Stack>

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}

                  <Snackbar
                    open={Boolean(dialogSuccessMessage)}
                    message={dialogSuccessMessage}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'center',
                    }}
                    autoHideDuration={3000}
                  />
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
              <DialogTitle>{dialogMode === 'new' ? '카테고리 추가' : '카테고리 수정'}</DialogTitle>
              <button
                className="close-button"
                onClick={handleCloseDialog}
                aria-label="닫기"
                disabled={isSubmitting || isUploadingImage || isDeletingImage}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2} sx={{ pt: 1, pb: 1 }}>
                  <Stack gap={1}>
                    <Typography variant="subtitle2">사이트 식별자</Typography>
                    <TextField
                      value={categoryKey}
                      onChange={handleCategoryKeyChange}
                      fullWidth
                      required
                      size="medium"
                      helperText="영문 소문자, 숫자, 하이픈('-')만 사용할 수 있습니다."
                      slotProps={{
                        input: {
                          startAdornment: (
                            <InputAdornment position="start">
                              {baseUrl}/{siteName}/b/c/
                            </InputAdornment>
                          ),
                          endAdornment: (
                            <InputAdornment position="end">
                              <button
                                type="button"
                                className="button small action"
                                onClick={handleCheckCategoryKey}
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
                    <Typography variant="subtitle2">카테고리명</Typography>
                    <TextField
                      value={categoryLabel}
                      onChange={handleCategoryLabelChange}
                      fullWidth
                      size="medium"
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <button
                                type="button"
                                className="button small action"
                                onClick={handleCheckCategoryLabel}
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
                    <Typography variant="subtitle2">카테고리 설명</Typography>
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
                      <Typography variant="subtitle2">카테고리 썸네일 이미지</Typography>

                      <Stack direction="row" gap={1}>
                        <Button component="label" className="button small action" disabled={isUploadingImage}>
                          이미지 선택
                          <VisuallyHiddenInput
                            ref={fileInputRef}
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
                        alt="카테고리 썸네일"
                        sx={{ maxWidth: 320, height: 'auto', display: 'block', borderRadius: 1 }}
                      />
                    ) : null}
                  </Stack>

                  {dialogErrorMessage ? (
                    <p className="alert error">
                      <ErrorOutlineRoundedIcon />
                      <span>{dialogErrorMessage}</span>
                    </p>
                  ) : null}

                  <Snackbar
                    open={Boolean(dialogSuccessMessage)}
                    message={dialogSuccessMessage}
                    anchorOrigin={{
                      vertical: 'top',
                      horizontal: 'center',
                    }}
                    autoHideDuration={3000}
                  />
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

          {isTablet ? (
            <Drawer
              anchor="bottom"
              open={dialogMode === 'delete'}
              onClose={handleCloseDialog}
              className="VhiDrawer-bottom"
            >
              <h2>카테고리 삭제</h2>
              <button className="close-button" onClick={handleCloseDialog} aria-label="닫기" disabled={isSubmitting}>
                <CloseRoundedIcon />
              </button>
              <Stack gap={2} sx={{ pt: 1 }}>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography>해당 카테고리를 삭제하시겠습니까?</Typography>

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
            <Dialog open={dialogMode === 'delete'} onClose={handleCloseDialog} fullWidth maxWidth="xs">
              <DialogTitle>카테고리 삭제</DialogTitle>
              <button className="close-button" onClick={handleCloseDialog} aria-label="닫기" disabled={isSubmitting}>
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <Stack gap={2} sx={{ pt: 1 }}>
                  <Typography>해당 카테고리를 삭제하시겠습니까?</Typography>

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
        </div>
      </div>
    </Container>
  );
}
