'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { Box, FormControlLabel, Snackbar, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

type HomeOrderItem = {
  id: string;
  boardId: string;
  boardKey: string;
  boardLabel: string;
  boardType: string;
  isActive: boolean;
  order: number;
  isShow: boolean;
  hasHomeOrder: boolean;
};

type HomeOrderResponse = {
  ok?: boolean;
  hasHomeOrders?: boolean;
  items?: HomeOrderItem[];
  error?: string;
};

type SortableHomeOrderItemProps = {
  item: HomeOrderItem;
  onChangeShow: (id: string, checked: boolean) => void;
};

function getBoardTypeLabel(boardType: string) {
  if (boardType === 'basic') {
    return '일반 게시판';
  }

  if (boardType === 'gallery') {
    return '갤러리 게시판';
  }

  if (boardType === 'youtube') {
    return '유튜브 게시판';
  }

  if (boardType === 'feed') {
    return '피드 게시판';
  }

  return boardType;
}

function SortableHomeOrderItem({ item, onChangeShow }: SortableHomeOrderItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div ref={setNodeRef} className={`paper ${styles.paper}`}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box
          component="button"
          type="button"
          {...attributes}
          {...listeners}
          sx={{
            border: 0,
            p: 0,
            m: 0,
            bgcolor: 'transparent',
            color: 'text.secondary',
            display: 'flex',
            cursor: 'grab',
          }}
          aria-label="순서 변경"
        >
          <DragIndicatorIcon />
        </Box>

        <Stack spacing={0.5} sx={{ flex: '1 1 auto', minWidth: 0 }}>
          <Typography variant="subtitle2">{item.boardLabel}</Typography>
          <Typography variant="body2">{`${item.boardKey} / ${getBoardTypeLabel(item.boardType)}`}</Typography>
          {!item.isActive ? (
            <Typography variant="body2" color="error">
              비활성 게시판
            </Typography>
          ) : null}
        </Stack>

        <FormControlLabel
          control={
            <IOSSwitch
              sx={{ m: 1 }}
              checked={item.isShow}
              onChange={(event) => onChangeShow(item.id, event.currentTarget.checked)}
            />
          }
          label={item.isShow ? '노출' : '숨김'}
        />
      </Stack>
    </div>
  );
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const [items, setItems] = useState<HomeOrderItem[]>([]);
  const [hasHomeOrders, setHasHomeOrders] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const sortableIds = useMemo(() => items.map((item) => item.id), [items]);

  async function loadHomeOrders() {
    const response = await fetch(`/api/manage/design/community/home?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as HomeOrderResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '커뮤니티 홈 설정을 불러오지 못했습니다.');
    }

    setHasHomeOrders(Boolean(result.hasHomeOrders));
    setItems(Array.isArray(result.items) ? result.items : []);
  }

  async function handleInitialize() {
    if (isInitializing) {
      return;
    }

    try {
      setErrorMessage('');
      setIsInitializing(true);

      const response = await fetch('/api/manage/design/community/home', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'init',
          siteName,
        }),
      });

      const result = (await response.json()) as HomeOrderResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '커뮤니티 홈 초기 세팅에 실패했습니다.');
      }

      setHasHomeOrders(Boolean(result.hasHomeOrders));
      setItems(Array.isArray(result.items) ? result.items : []);
      setSnackbarMessage('커뮤니티 홈 초기 세팅이 완료되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '커뮤니티 홈 초기 세팅에 실패했습니다.');
      } else {
        setErrorMessage('커뮤니티 홈 초기 세팅에 실패했습니다.');
      }
    } finally {
      setIsInitializing(false);
    }
  }

  async function handleSave() {
    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/manage/design/community/home', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          items: items.map((item, index) => ({
            id: item.id,
            order: index + 1,
            isShow: item.isShow,
          })),
        }),
      });

      const result = (await response.json()) as HomeOrderResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '커뮤니티 홈 순서 저장에 실패했습니다.');
      }

      setHasHomeOrders(Boolean(result.hasHomeOrders));
      setItems(Array.isArray(result.items) ? result.items : []);
      setSnackbarMessage('저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '커뮤니티 홈 순서 저장에 실패했습니다.');
      } else {
        setErrorMessage('커뮤니티 홈 순서 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    setItems((previousItems) => {
      const oldIndex = previousItems.findIndex((item) => item.id === active.id);
      const newIndex = previousItems.findIndex((item) => item.id === over.id);

      if (oldIndex < 0 || newIndex < 0) {
        return previousItems;
      }

      return arrayMove(previousItems, oldIndex, newIndex).map((item, index) => ({
        ...item,
        order: index + 1,
      }));
    });
  }

  function handleChangeShow(id: string, checked: boolean) {
    setItems((previousItems) =>
      previousItems.map((item) =>
        item.id === id
          ? {
              ...item,
              isShow: checked,
            }
          : item,
      ),
    );
  }

  useEffect(() => {
    void (async () => {
      try {
        setErrorMessage('');
        await loadHomeOrders();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '커뮤니티 홈 설정을 불러오지 못했습니다.');
        } else {
          setErrorMessage('커뮤니티 홈 설정을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, [siteName]);

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

          {!hasHomeOrders ? (
            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle1">커뮤니티 홈 세팅이 필요합니다.</Typography>
              <Typography variant="body2">현재 등록된 게시판을 기준으로 홈 노출 순서를 생성합니다.</Typography>
              <Box>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={() => void handleInitialize()}
                  disabled={isInitializing}
                >
                  커뮤니티 홈 초기 세팅하기
                </button>
              </Box>
            </div>
          ) : (
            <>
              {items.length === 0 ? (
                <p className="alert error">
                  <ErrorOutlineRoundedIcon />
                  <span>등록된 게시판이 없습니다.</span>
                </p>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                    <Stack spacing={1.5}>
                      {items.map((item) => (
                        <SortableHomeOrderItem key={item.id} item={item} onChangeShow={handleChangeShow} />
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
              )}

              <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ p: isMobile ? 2 : 0 }}>
                <button
                  type="button"
                  className="button medium action"
                  onClick={() => void loadHomeOrders()}
                  disabled={isSubmitting}
                >
                  다시 불러오기
                </button>
                {isMobile ? (
                  <div className={styles['button-top']}>
                    <button type="submit" className={`button ${styles.button}`}>
                      저장
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={() => void handleSave()}
                    disabled={isSubmitting}
                  >
                    저장
                  </button>
                )}
              </Stack>
            </>
          )}

          <Snackbar
            open={Boolean(snackbarMessage)}
            autoHideDuration={2500}
            onClose={() => setSnackbarMessage('')}
            message={snackbarMessage}
          />
        </div>
      </div>
    </Container>
  );
}
