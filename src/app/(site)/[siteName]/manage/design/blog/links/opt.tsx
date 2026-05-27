'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import FacebookIcon from '@mui/icons-material/Facebook';
import GitHubIcon from '@mui/icons-material/GitHub';
import InstagramIcon from '@mui/icons-material/Instagram';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import PinterestIcon from '@mui/icons-material/Pinterest';
import XIcon from '@mui/icons-material/X';
import YouTubeIcon from '@mui/icons-material/YouTube';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CloseIcon from '@mui/icons-material/Close';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import {
  Box,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

type ServiceValue = 'Facebook' | 'GitHub' | 'Instagram' | 'LinkedIn' | 'Pinterest' | 'X' | 'YouTube';

type LinkItem = {
  localId: string;
  id: string | null;
  service: ServiceValue | '';
  account: string;
};

type LinkResponse = {
  links: {
    id: string;
    service: ServiceValue;
    account: string;
    sort_order: number;
    blog_id: string;
  }[];
};

const SERVICE_OPTIONS: {
  value: ServiceValue;
  label: string;
  prefix: string;
  Icon: typeof FacebookIcon;
}[] = [
  { value: 'Facebook', label: 'Facebook', prefix: 'https://facebook.com/', Icon: FacebookIcon },
  { value: 'GitHub', label: 'GitHub', prefix: 'https://github.com/', Icon: GitHubIcon },
  { value: 'Instagram', label: 'Instagram', prefix: 'https://instagram.com/', Icon: InstagramIcon },
  { value: 'LinkedIn', label: 'LinkedIn', prefix: 'https://linkedin.com/in/', Icon: LinkedInIcon },
  { value: 'Pinterest', label: 'Pinterest', prefix: 'https://pinterest.com/', Icon: PinterestIcon },
  { value: 'X', label: 'X', prefix: 'https://x.com/', Icon: XIcon },
  { value: 'YouTube', label: 'YouTube', prefix: 'https://youtube.com/@', Icon: YouTubeIcon },
];

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
  onRemove,
}: {
  item: LinkItem;
  onServiceChange: (localId: string, service: ServiceValue | '') => void;
  onAccountChange: (localId: string, account: string) => void;
  onRemove: (localId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: item.localId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const serviceMeta = getServiceMeta(item.service);

  return (
    <Box ref={setNodeRef} style={style}>
      <div className={`paper ${styles.paper}`}>
        <Stack direction="row" gap={1.5} alignItems="center">
          <Box
            {...attributes}
            {...listeners}
            sx={{
              display: 'flex',
              alignItems: 'center',
              cursor: 'grab',
              flexShrink: 0,
            }}
          >
            <DragIndicatorIcon />
          </Box>

          <Select
            value={item.service}
            onChange={(event) => onServiceChange(item.localId, event.target.value as ServiceValue | '')}
            displayEmpty
            size="small"
            sx={{ height: 40 }}
            renderValue={(selectedValue) => {
              if (!selectedValue) {
                return <Box sx={{ width: 24, height: 24 }} />;
              }

              const selectedMeta = getServiceMeta(selectedValue as ServiceValue);

              if (!selectedMeta) {
                return <Box sx={{ width: 24, height: 24 }} />;
              }

              const SelectedIcon = selectedMeta.Icon;

              return <SelectedIcon aria-label={selectedMeta.label} sx={{ width: 24, height: 24, marginTop: 1 }} />;
            }}
          >
            {SERVICE_OPTIONS.map((option) => {
              const ServiceIcon = option.Icon;

              return (
                <MenuItem key={option.value} value={option.value}>
                  <ServiceIcon aria-label={option.label} sx={{ width: 24, height: 24 }} />
                </MenuItem>
              );
            })}
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

          <IconButton type="button" onClick={() => onRemove(item.localId)}>
            <CloseIcon />
          </IconButton>
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
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  useEffect(() => {
    async function loadLinks() {
      try {
        const response = await fetch(`/api/manage/design/blog/links?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as LinkResponse | { error?: string };

        if (!response.ok) {
          throw new Error(
            'error' in result ? result.error || '소셜 링크를 불러오지 못했습니다.' : '소셜 링크를 불러오지 못했습니다.',
          );
        }

        if (!('links' in result) || !Array.isArray(result.links)) {
          throw new Error('소셜 링크를 불러오지 못했습니다.');
        }

        setItems(
          result.links.map((link) => ({
            localId: createLocalId(),
            id: link.id,
            service: link.service,
            account: link.account ?? '',
          })),
        );
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '소셜 링크를 불러오지 못했습니다.');
        } else {
          setErrorMessage('소셜 링크를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadLinks();
  }, [siteName]);

  const sortableIds = useMemo(() => items.map((item) => item.localId), [items]);

  function handleAdd() {
    setItems((previousItems) => [
      ...previousItems,
      {
        localId: createLocalId(),
        id: null,
        service: '',
        account: '',
      },
    ]);
  }

  function handleRemove(localId: string) {
    setItems((previousItems) => previousItems.filter((item) => item.localId !== localId));
  }

  function handleServiceChange(localId: string, service: ServiceValue | '') {
    setItems((previousItems) =>
      previousItems.map((item) =>
        item.localId === localId
          ? {
              ...item,
              service,
            }
          : item,
      ),
    );
  }

  function handleAccountChange(localId: string, account: string) {
    setItems((previousItems) =>
      previousItems.map((item) =>
        item.localId === localId
          ? {
              ...item,
              account,
            }
          : item,
      ),
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setItems((previousItems) => {
      const oldIndex = previousItems.findIndex((item) => item.localId === active.id);
      const newIndex = previousItems.findIndex((item) => item.localId === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return previousItems;
      }

      return arrayMove(previousItems, oldIndex, newIndex);
    });
  }

  async function handleSave() {
    try {
      if (items.some((item) => !item.service || !item.account.trim())) {
        setErrorMessage('빈 데이터가 있습니다.');
        return;
      }

      setErrorMessage('');
      setIsSaving(true);

      const response = await fetch('/api/manage/design/blog/links', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          links: items.map((item) => ({
            service: item.service,
            account: item.account.trim(),
          })),
        }),
      });

      const result = (await response.json()) as LinkResponse | { error?: string };

      if (!response.ok) {
        throw new Error(
          'error' in result ? result.error || '소셜 링크 저장에 실패했습니다.' : '소셜 링크 저장에 실패했습니다.',
        );
      }

      if (!('links' in result) || !Array.isArray(result.links)) {
        throw new Error('소셜 링크 저장에 실패했습니다.');
      }

      setItems(
        result.links.map((link) => ({
          localId: createLocalId(),
          id: link.id,
          service: link.service,
          account: link.account ?? '',
        })),
      );
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '소셜 링크 저장에 실패했습니다.');
      } else {
        setErrorMessage('소셜 링크 저장에 실패했습니다.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="블로그 디자인 설정" pageBack={`/${siteName}/manage`} menu="design">
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
    <Container pageTitle="블로그 디자인 설정" pageBack={`/${siteName}/manage`} menu="design">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

          <p className="alert info" style={{ paddingTop: 23 }}>
            <InfoOutlineRoundedIcon />
            <span>순서를 변경 또는 링크 추가시 반드시 저장 버튼을 누르셔야 저장됩니다.</span>
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
