'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Stack, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FormErrorDialog from '@/components/FormErrorDialog';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

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
    <div
      ref={setNodeRef}
      className={`paper ${styles.paper}`}
      style={{
        cursor: 'grab',
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      onClick={() => onClick(page.slug)}
    >
      <Typography>{page.subject}</Typography>
    </div>
  );
}

export type InitialPagesData = { boardName: string; pages: PageRow[] };

type OptProps = { initialData: InitialPagesData | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
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

  const [pages, setPages] = useState<PageRow[]>(initialData?.pages ?? []);
  const [boardName] = useState<string | null>(initialData?.boardName ?? null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));

  const items = useMemo(() => pages.map((page: PageRow) => page.slug), [pages]);

  function handleMoveToDetail(slug: string) {
    router.push(`/${siteName}/manage/contents/pages/${slug}`);
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
          const response = await fetch(`/api/boards/${boardName}/${page.slug}/order?siteName=${siteName}`, {
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
      const message =
        unknownError instanceof Error
          ? unknownError.message || '페이지 정렬 저장에 실패했습니다.'
          : '페이지 정렬 저장에 실패했습니다.';
      setErrorMessage(message);
      setIsErrorDialogOpen(true);
    } finally {
      setIsSavingOrder(false);
    }
  }

  return (
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']} ${styles.Content}`}>
          {initialError ? (
            <>
              <div className={`paper paper-error ${styles.paper}`}>{initialError}</div>
              <ScreenState>페이지 목록을 불러오지 못했습니다.</ScreenState>
            </>
          ) : pages.length === 0 ? (
            <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>
              <Anchor href={`/${siteName}/manage/contents/pages/new`} className="button small submit">
                페이지 추가
              </Anchor>
            </Stack>
          ) : null}

          {!initialError && pages.length === 0 ? (
            <ScreenState>페이지가 아직 없습니다</ScreenState>
          ) : !initialError && pages.length === 1 ? (
            <div className={`paper ${styles.paper}`}>
              {pages.map((page: PageRow) => (
                <Anchor href={`/${siteName}/manage/contents/pages/${page.slug}`} className="link-normal" key={page.id}>
                  {page.subject}
                </Anchor>
              ))}
            </div>
          ) : !initialError ? (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {pages.map((page: PageRow) => (
                  <SortableItem key={page.id} page={page} onClick={handleMoveToDetail} />
                ))}
              </SortableContext>
            </DndContext>
          ) : null}

          {errorMessage && errorMessage !== initialError ? (
            <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div>
          ) : null}
          <FormErrorDialog
            open={isErrorDialogOpen}
            title={null}
            messages={errorMessage ? [errorMessage] : []}
            onClose={() => setIsErrorDialogOpen(false)}
          />
        </div>
      </div>
    </Container>
  );
}
