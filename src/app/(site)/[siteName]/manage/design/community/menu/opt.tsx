'use client';

import { useEffect, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type MenuRow = {
  id: string;
  board_type: string;
  board_label: string;
  display_label: string;
  sort_order: number;
  is_renameable: boolean;
};

type SortableItemProps = {
  menu: MenuRow;
  onOpenRenameDialog: (menu: MenuRow) => void;
};

function SortableItem({ menu, onOpenRenameDialog }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: menu.id,
  });

  return (
    <div
      ref={setNodeRef}
      className={`paper ${styles.paper}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      <Typography>{menu.display_label}</Typography>

      {menu.is_renameable ? (
        <button
          type="button"
          className="button medium action"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenRenameDialog(menu);
          }}
        >
          이름 변경
        </button>
      ) : null}
    </div>
  );
}

export default function Opt() {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [renameTarget, setRenameTarget] = useState<MenuRow | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    async function loadMenus() {
      try {
        const response = await fetch(`/api/manage/design/shared/menu?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '메뉴 설정을 불러오지 못했습니다.');
        }

        setMenus(Array.isArray(result.menus) ? (result.menus as MenuRow[]) : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '메뉴 설정을 불러오지 못했습니다.');
        } else {
          setErrorMessage('메뉴 설정을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadMenus();
  }, [siteName]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = menus.findIndex((menu) => menu.id === active.id);
    const newIndex = menus.findIndex((menu) => menu.id === over.id);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    setMenus((previousMenus) => arrayMove(previousMenus, oldIndex, newIndex));
    setSuccessMessage('');
  }

  async function handleApply() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/manage/design/shared/menu', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          orderedBoardIds: menus.map((menu) => menu.id),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '메뉴 설정 저장에 실패했습니다.');
      }

      setSuccessMessage('적용되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '메뉴 설정 저장에 실패했습니다.');
      } else {
        setErrorMessage('메뉴 설정 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleOpenRenameDialog(menu: MenuRow) {
    setRenameTarget(menu);
    setRenameValue(menu.board_label ?? '');
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleCloseRenameDialog() {
    if (isRenaming) {
      return;
    }

    setRenameTarget(null);
    setRenameValue('');
  }

  function handleRenameValueChange(event: InputChangeEvent) {
    setRenameValue(event.currentTarget.value);
  }

  async function handleRename() {
    if (!renameTarget || isRenaming) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsRenaming(true);

    try {
      const response = await fetch('/api/manage/design/shared/menu', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          boardId: renameTarget.id,
          boardLabel: renameValue,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '게시판 이름 변경에 실패했습니다.');
      }

      setMenus((previousMenus) =>
        previousMenus.map((menu) =>
          menu.id === renameTarget.id
            ? {
                ...menu,
                board_label: result.board.board_label,
                display_label: result.board.board_label,
              }
            : menu,
        ),
      );

      setSuccessMessage('이름이 변경되었습니다.');
      setRenameTarget(null);
      setRenameValue('');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '게시판 이름 변경에 실패했습니다.');
      } else {
        setErrorMessage('게시판 이름 변경에 실패했습니다.');
      }
    } finally {
      setIsRenaming(false);
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
          <Stack gap={2}>
            {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
            <p className="alert info" style={{ paddingTop: 23 }}>
              <InfoOutlineRoundedIcon />
              <span>메뉴를 원하는 위치로 끌어다 놓은 뒤 ‘적용’버튼을 누르세요.</span>
            </p>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={menus.map((menu) => menu.id)} strategy={horizontalListSortingStrategy}>
                <Stack gap={2}>
                  <div className={`paper ${styles.paper}`}>
                    <Typography>홈</Typography>
                  </div>

                  {menus.map((menu) => (
                    <SortableItem key={menu.id} menu={menu} onOpenRenameDialog={handleOpenRenameDialog} />
                  ))}
                </Stack>
              </SortableContext>
            </DndContext>
            {isMobile ? (
              <div className={styles['button-top']}>
                <button
                  type="button"
                  className={`button ${styles.button}`}
                  onClick={() => void handleApply()}
                  disabled={isSubmitting}
                >
                  적용
                </button>
              </div>
            ) : (
              <Stack direction="row" justifyContent="flex-end">
                <button
                  type="button"
                  className="button medium submit"
                  onClick={() => void handleApply()}
                  disabled={isSubmitting}
                >
                  적용
                </button>
              </Stack>
            )}
            {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
            {successMessage ? <div className={`paper paper-success ${styles.paper}`}>{successMessage}</div> : null}
          </Stack>

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(renameTarget)}
              onClose={handleCloseRenameDialog}
              className="VhiDrawer-bottom"
            >
              <h2>게시판 이름 변경</h2>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseRenameDialog}
                aria-label="게시판 이름 변경 닫기"
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>

              <Stack gap={3}>
                <TextField
                  placeholder="게시판 이름"
                  value={renameValue}
                  onChange={handleRenameValueChange}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                />

                <Stack direction="column" gap={1.5}>
                  <button
                    type="button"
                    className="button medium cancel"
                    onClick={handleCloseRenameDialog}
                    disabled={isRenaming}
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    className="button medium submit"
                    onClick={() => void handleRename()}
                    disabled={isRenaming}
                  >
                    저장
                  </button>
                </Stack>
              </Stack>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(renameTarget)}
              onClose={handleCloseRenameDialog}
              fullWidth
              maxWidth="xs"
              className="VhiDialog"
            >
              <DialogTitle>게시판 이름 변경</DialogTitle>
              <button
                type="button"
                className="close-button"
                onClick={handleCloseRenameDialog}
                aria-label="게시판 이름 변경 닫기"
                disabled={isSubmitting}
              >
                <CloseRoundedIcon />
              </button>
              <DialogContent>
                <TextField
                  placeholder="게시판 이름"
                  value={renameValue}
                  onChange={handleRenameValueChange}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                />
              </DialogContent>
              <DialogActions>
                <button
                  type="button"
                  className="button medium close"
                  onClick={handleCloseRenameDialog}
                  disabled={isRenaming}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={() => void handleRename()}
                  disabled={isRenaming}
                >
                  저장
                </button>
              </DialogActions>
            </Dialog>
          )}
          <Snackbar
            open={Boolean(successMessage)}
            autoHideDuration={2700}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            onClose={() => setSuccessMessage('')}
            message={successMessage}
          />
        </div>
      </div>
    </Container>
  );
}
