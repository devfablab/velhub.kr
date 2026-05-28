'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Anchor from '@/components/Anchor';
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
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
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
        const statusResponse = await fetch(`/api/manage/contents/pages/status?siteName=${siteName}`, {
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

        const boardResponse = await fetch(`/api/boards/${statusResult.boardName}?siteName=${siteName}&page=1`, {
          method: 'GET',
          credentials: 'include',
        });

        const boardResult = await boardResponse.json();

        if (!boardResponse.ok) {
          throw new Error(boardResult.error ?? '페이지 목록을 불러오지 못했습니다.');
        }

        setPages(Array.isArray(boardResult.pages) ? (boardResult.pages as PageRow[]) : []);
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
    return (
      <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage`} menu="contents">
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
    <Container pageTitle="콘텐츠 관리" pageBack={`/${siteName}/manage`} menu="contents">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Stack direction="row" justifyContent="flex-end" sx={{ p: 2 }}>
            <Anchor href={`/${siteName}/manage/contents/pages/new`} className="button small submit">
              페이지 추가
            </Anchor>
          </Stack>

          {pages.length === 0 ? (
            <div className={`paper paper-error ${styles.paper}`}>페이지가 아직 없습니다</div>
          ) : pages.length === 1 ? (
            <div className={`paper ${styles.paper}`}>
              {pages.map((page: PageRow) => (
                <Anchor href={`/${siteName}/manage/contents/pages/${page.slug}`} className="link-normal" key={page.id}>
                  {page.subject}
                </Anchor>
              ))}
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items} strategy={verticalListSortingStrategy}>
                {pages.map((page: PageRow) => (
                  <SortableItem key={page.id} page={page} onClick={handleMoveToDetail} />
                ))}
              </SortableContext>
            </DndContext>
          )}

          {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
        </div>
      </div>
    </Container>
  );
}
