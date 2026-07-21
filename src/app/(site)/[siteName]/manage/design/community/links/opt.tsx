'use client';

import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CloseIcon from '@mui/icons-material/Close';
import DeleteForeverRoundedIcon from '@mui/icons-material/DeleteForeverRounded';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { normalizeText } from '@/lib/utils';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type ServiceValue = 'toonation' | 'kakaotalk' | 'discord';

type LinkItem = {
  localId: string;
  id: string | null;
  service: ServiceValue | '';
  account: string;
  image: string | null;
  imageUrl: string;
  pendingFile: File | null;
  previewUrl: string;
};

type LinkResponse = {
  links?: {
    id: string;
    service: ServiceValue;
    account: string;
    image: string | null;
    image_url: string;
    sort_order: number;
  }[];
  error?: string;
};

const MAX_FILE_SIZE = 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const SERVICE_OPTIONS: {
  value: ServiceValue;
  label: string;
  prefix: string;
}[] = [
  { value: 'toonation', label: '투네이션', prefix: 'https://toon.at/donate/' },
  { value: 'kakaotalk', label: '카카오톡', prefix: 'https://open.kakao.com/o/' },
  { value: 'discord', label: '디스코드', prefix: 'https://discord.com/invite/' },
];

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

function createLocalId() {
  return crypto.randomUUID();
}

function getServiceMeta(service: ServiceValue | '') {
  return SERVICE_OPTIONS.find((option) => option.value === service) ?? null;
}

function SortableItem({
  item,
  onServiceChange,
  onAccountChange,
  onImageChange,
  onImageRemove,
  onRemove,
}: {
  item: LinkItem;
  onServiceChange: (localId: string, service: ServiceValue | '') => void;
  onAccountChange: (localId: string, account: string) => void;
  onImageChange: (localId: string, event: InputChangeEvent) => void;
  onImageRemove: (localId: string) => void;
  onRemove: (localId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: item.localId });
  const serviceMeta = getServiceMeta(item.service);
  const displayedImageUrl = item.previewUrl || item.imageUrl;

  return (
    <Box
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <div className={`paper ${styles.paper}`}>
        <Stack gap={1.5}>
          <Stack direction="row" gap={1.5} alignItems="center">
            <Box
              {...attributes}
              {...listeners}
              sx={{ display: 'flex', alignItems: 'center', cursor: 'grab', flexShrink: 0 }}
              aria-label="순서 변경"
            >
              <DragIndicatorIcon />
            </Box>

            <Select
              value={item.service}
              onChange={(event) => onServiceChange(item.localId, event.target.value as ServiceValue | '')}
              displayEmpty
              size="small"
              sx={{ minWidth: 120, height: 40 }}
            >
              <MenuItem value="" disabled>
                서비스
              </MenuItem>
              {SERVICE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>

            <TextField
              value={item.account}
              onChange={(event) => onAccountChange(item.localId, event.target.value)}
              fullWidth
              size="small"
              slotProps={{
                input: {
                  startAdornment: <InputAdornment position="start">{serviceMeta?.prefix ?? ''}</InputAdornment>,
                },
              }}
            />

            <IconButton type="button" onClick={() => onRemove(item.localId)} aria-label="링크 삭제">
              <CloseIcon />
            </IconButton>
          </Stack>

          <Stack direction="row" gap={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ pl: 4.5 }}>
            <Box
              sx={{
                width: 160,
                height: 160,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              {displayedImageUrl ? (
                <Box
                  component="img"
                  src={displayedImageUrl}
                  alt={serviceMeta ? `${serviceMeta.label} 링크 이미지` : '링크 이미지'}
                  sx={{ width: 160, height: 160, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <Stack sx={{ width: 160, height: 160 }} alignItems="center" justifyContent="center">
                  <Typography variant="body2">이미지 없음</Typography>
                </Stack>
              )}
            </Box>

            <Stack gap={1}>
              <Button component="label" className="button small action" size="small">
                이미지 선택
                <VisuallyHiddenInput
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
                  onChange={(event) => onImageChange(item.localId, event)}
                />
              </Button>

              {displayedImageUrl ? (
                <Button
                  type="button"
                  className="button small warning"
                  color="error"
                  size="small"
                  startIcon={<DeleteForeverRoundedIcon />}
                  onClick={() => onImageRemove(item.localId)}
                >
                  이미지 삭제
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Stack>
      </div>
    </Box>
  );
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const [items, setItems] = useState<LinkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const previewUrlsRef = useRef(new Set<string>());
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const sortableIds = useMemo(() => items.map((item) => item.localId), [items]);

  function revokePreviewUrl(previewUrl: string) {
    if (!previewUrl) {
      return;
    }

    URL.revokeObjectURL(previewUrl);
    previewUrlsRef.current.delete(previewUrl);
  }

  function clearPreviewUrls() {
    previewUrlsRef.current.forEach((previewUrl) => URL.revokeObjectURL(previewUrl));
    previewUrlsRef.current.clear();
  }

  useEffect(() => {
    async function loadLinks() {
      try {
        const response = await fetch(`/api/manage/design/community/links?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });
        const result = (await response.json()) as LinkResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '커뮤니티 링크를 불러오지 못했습니다.');
        }

        setItems(
          (result.links ?? []).map((link) => ({
            localId: createLocalId(),
            id: link.id,
            service: link.service,
            account: link.account,
            image: link.image,
            imageUrl: link.image_url,
            pendingFile: null,
            previewUrl: '',
          })),
        );
      } catch (unknownError) {
        const error = unknownError instanceof Error ? unknownError.message : '';
        setErrorMessage(error || '커뮤니티 링크를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadLinks();

    return () => {
      clearPreviewUrls();
    };
  }, [siteName]);

  function handleAdd() {
    setItems((previousItems) => [
      ...previousItems,
      {
        localId: createLocalId(),
        id: null,
        service: '',
        account: '',
        image: null,
        imageUrl: '',
        pendingFile: null,
        previewUrl: '',
      },
    ]);
  }

  function handleServiceChange(localId: string, service: ServiceValue | '') {
    setItems((previousItems) => previousItems.map((item) => (item.localId === localId ? { ...item, service } : item)));
  }

  function handleAccountChange(localId: string, account: string) {
    setItems((previousItems) => previousItems.map((item) => (item.localId === localId ? { ...item, account } : item)));
  }

  function handleImageChange(localId: string, event: InputChangeEvent) {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.has(file.type.toLowerCase())) {
      setErrorMessage('PNG, JPEG, WEBP 이미지만 업로드할 수 있습니다.');
      input.value = '';
      return;
    }

    if (file.size >= MAX_FILE_SIZE) {
      setErrorMessage('이미지는 1MB 미만만 업로드할 수 있습니다.');
      input.value = '';
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    previewUrlsRef.current.add(previewUrl);
    setErrorMessage('');
    setItems((previousItems) =>
      previousItems.map((item) => {
        if (item.localId !== localId) {
          return item;
        }

        revokePreviewUrl(item.previewUrl);
        return { ...item, pendingFile: file, previewUrl };
      }),
    );
    input.value = '';
  }

  function handleImageRemove(localId: string) {
    setItems((previousItems) =>
      previousItems.map((item) => {
        if (item.localId !== localId) {
          return item;
        }

        revokePreviewUrl(item.previewUrl);
        return { ...item, image: null, imageUrl: '', pendingFile: null, previewUrl: '' };
      }),
    );
  }

  function handleRemove(localId: string) {
    setItems((previousItems) => {
      const target = previousItems.find((item) => item.localId === localId);
      revokePreviewUrl(target?.previewUrl ?? '');
      return previousItems.filter((item) => item.localId !== localId);
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setItems((previousItems) => {
      const oldIndex = previousItems.findIndex((item) => item.localId === active.id);
      const newIndex = previousItems.findIndex((item) => item.localId === over.id);
      return oldIndex < 0 || newIndex < 0 ? previousItems : arrayMove(previousItems, oldIndex, newIndex);
    });
  }

  async function handleSave() {
    if (items.some((item) => !item.service || !item.account.trim())) {
      setErrorMessage('빈 데이터가 있습니다.');
      return;
    }

    try {
      setErrorMessage('');
      setIsSaving(true);
      const formData = new FormData();
      formData.append('siteName', siteName);
      formData.append(
        'links',
        JSON.stringify(
          items.map((item) => ({
            localId: item.localId,
            service: item.service,
            account: item.account.trim(),
            image: item.image,
          })),
        ),
      );

      items.forEach((item) => {
        if (item.pendingFile) {
          formData.append(`image-${item.localId}`, item.pendingFile);
        }
      });

      const response = await fetch('/api/manage/design/community/links', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = (await response.json()) as LinkResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '커뮤니티 링크 저장에 실패했습니다.');
      }

      clearPreviewUrls();
      setItems(
        (result.links ?? []).map((link) => ({
          localId: createLocalId(),
          id: link.id,
          service: link.service,
          account: link.account,
          image: link.image,
          imageUrl: link.image_url,
          pendingFile: null,
          previewUrl: '',
        })),
      );
    } catch (unknownError) {
      const error = unknownError instanceof Error ? unknownError.message : '';
      setErrorMessage(error || '커뮤니티 링크 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="커뮤니티 디자인 설정" pageBack={`/${siteName}/manage`} menu="design">
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
    <Container pageTitle="커뮤니티 디자인 설정" pageBack={`/${siteName}/manage`} menu="design">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          <p className="alert info" style={{ paddingTop: 23 }}>
            <InfoOutlineRoundedIcon />
            <span>순서 변경, 링크 추가, 이미지 변경 후 반드시 저장 버튼을 눌러주세요.</span>
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              <Stack gap={1.5}>
                {items.map((item) => (
                  <SortableItem
                    key={item.localId}
                    item={item}
                    onServiceChange={handleServiceChange}
                    onAccountChange={handleAccountChange}
                    onImageChange={handleImageChange}
                    onImageRemove={handleImageRemove}
                    onRemove={handleRemove}
                  />
                ))}
              </Stack>
            </SortableContext>
          </DndContext>

          <Stack justifyContent="space-between" direction="row" sx={{ p: isMobile ? 2 : 0 }}>
            <button type="button" className="button medium action" onClick={handleAdd}>
              링크 추가
            </button>
            {isMobile ? (
              <div className={styles['button-top']}>
                <button type="button" className={`button ${styles.button}`} onClick={handleSave} disabled={isSaving}>
                  저장
                </button>
              </div>
            ) : (
              <button type="button" className="button medium submit" onClick={handleSave} disabled={isSaving}>
                저장
              </button>
            )}
          </Stack>
        </div>
      </div>
    </Container>
  );
}
