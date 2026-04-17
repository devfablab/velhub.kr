'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from '@mui/material/Link';
import { useParams, useRouter } from 'next/navigation';
import { Alert, Button, Paper, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { normalizeText } from '@/lib/utils';

type PageRow = {
  id: string;
  slug: string;
  subject: string;
  summary: string | null;
  edited_at: string;
  sort_order: number;
  user_id: string;
  site_id: string;
  board_id: string;
};

type SortableItemProps = {
  page: PageRow;
  onClick: (slug: string) => void;
};

function SortableItem({ page, onClick }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: page.slug,
  });

  return (
    <Paper
      ref={setNodeRef}
      elevation={0}
      sx={{
        p: 2,
        cursor: 'grab',
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      onClick={() => onClick(page.slug)}
    >
      <Typography>{page.subject}</Typography>
    </Paper>
  );
}

export default function Opt() {
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const [pages, setPages] = useState<PageRow[]>([]);
  const [boardName, setBoardName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const items = useMemo(() => pages.map((page: PageRow) => page.slug), [pages]);

  useEffect(() => {
    async function loadPages() {
      try {
        const statusResponse = await fetch(`/api/pages/status?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const statusResult = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(statusResult.error ?? '페이지 상태를 확인하지 못했습니다.');
        }

        if (!statusResult.hasBoard || !statusResult.boardName) {
          setBoardName(null);
          setPages([]);
          return;
        }

        setBoardName(statusResult.boardName);

        const boardResponse = await fetch(`/api/boards/${statusResult.boardName}?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const boardResult = await boardResponse.json();

        if (!boardResponse.ok) {
          throw new Error(boardResult.error ?? '페이지 목록을 불러오지 못했습니다.');
        }

        setPages(Array.isArray(boardResult.contents) ? (boardResult.contents as PageRow[]) : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '페이지 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('페이지 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPages();
  }, [siteName]);

  function handleMoveToDetail(slug: string) {
    router.push(`/${siteName}/contents/pages/${slug}`);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id || !boardName || isSavingOrder) {
      return;
    }

    const oldIndex = pages.findIndex((page: PageRow) => page.slug === active.id);
    const newIndex = pages.findIndex((page: PageRow) => page.slug === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const movedPages = arrayMove(pages, oldIndex, newIndex) as PageRow[];

    const reorderedPages: PageRow[] = movedPages.map((page: PageRow, index: number) => ({
      ...page,
      sort_order: index + 1,
    }));

    setPages(reorderedPages);
    setIsSavingOrder(true);
    setErrorMessage('');

    try {
      await Promise.all(
        reorderedPages.map(async (page: PageRow) => {
          const response = await fetch(`/api/boards/${boardName}/${page.slug}/order`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              siteName,
              sortOrder: page.sort_order,
            }),
          });

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error ?? '페이지 정렬 저장에 실패했습니다.');
          }
        }),
      );
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '페이지 정렬 저장에 실패했습니다.');
      } else {
        setErrorMessage('페이지 정렬 저장에 실패했습니다.');
      }
    } finally {
      setIsSavingOrder(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={2}>
      {isNotMobile && (
        <Typography variant="h5" component="h1">
          페이지
        </Typography>
      )}
      <Stack direction="row" justifyContent="flex-end">
        <Button LinkComponent={Link} type="button" variant="contained" href={`/${siteName}/contents/pages/new`}>
          페이지 추가
        </Button>
      </Stack>

      {pages.length === 0 ? (
        <Paper elevation={0} sx={{ p: 3 }}>
          <Typography>개설된 페이지가 없습니다</Typography>
        </Paper>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items} strategy={verticalListSortingStrategy}>
            <Paper elevation={3} sx={{ p: 1 }}>
              {pages.map((page: PageRow) => (
                <SortableItem key={page.id} page={page} onClick={handleMoveToDetail} />
              ))}
            </Paper>
          </SortableContext>
        </DndContext>
      )}

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      <Button component={Link} href="/settings" underline="none" variant="outlined">
        설정으로 이동
      </Button>
    </Stack>
  );
}
