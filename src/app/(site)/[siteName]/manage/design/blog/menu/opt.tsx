'use client';

import { type JSX, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import PopupMessage from '@/components/PopupMessage';
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
  isSortable: boolean;
  onOpenRenameDialog: (menu: MenuRow) => void;
};

function SortableItem({ menu, isSortable, onOpenRenameDialog }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: menu.id,
    disabled: !isSortable,
  });

  return (
    <div
      ref={setNodeRef}
      className={`paper ${styles.paper}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
    >
      <Stack direction="row" gap={2} alignItems="center">
        {isSortable ? (
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
        ) : null}

        <Typography sx={{ flex: '1 1 auto', minWidth: 0 }}>{menu.display_label}</Typography>

        {menu.is_renameable ? (
          <button type="button" className="button small action" onClick={() => onOpenRenameDialog(menu)}>
            이름 변경
          </button>
        ) : null}
      </Stack>
    </div>
  );
}

export type InitialMenuResponse = {
  menus?: MenuRow[];
  hasCategories?: boolean;
  hasSeries?: boolean;
  error?: string;
};
type OptProps = { initialData: InitialMenuResponse | null; initialError: string };

export default function Opt({ initialData, initialError }: OptProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const [menus, setMenus] = useState<MenuRow[]>(initialData?.menus ?? []);
  const hasCategories = initialData?.hasCategories === true;
  const hasSeries = initialData?.hasSeries === true;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [successMessage, setSuccessMessage] = useState('');
  const [renameTarget, setRenameTarget] = useState<MenuRow | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

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

  return (
    <Container pageTitle="블로그 디자인 설정" pageBack={`/${siteName}/manage`} menu="design">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Stack gap={3}>
            {menus.length > 0 ? (
              <>
                <p className="alert info" style={{ paddingTop: 23 }}>
                  <InfoOutlineRoundedIcon />
                  <span>
                    {menus.length > 1
                      ? '메뉴를 원하는 위치로 끌어다 놓은 뒤 ‘적용’버튼을 누르세요.'
                      : '블로그 메뉴의 이름을 변경할 수 있습니다.'}
                  </span>
                </p>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={menus.map((menu) => menu.id)} strategy={verticalListSortingStrategy}>
                    <Stack direction="column" gap={2}>
                      {menus.length > 1 ? (
                        <>
                          <div className={`paper ${styles.paper}`}>
                            <Typography>홈</Typography>
                          </div>
                          <div className={`paper ${styles.paper}`}>
                            <Typography>블로그 소개</Typography>
                          </div>
                          {hasCategories ? (
                            <div className={`paper ${styles.paper}`}>
                              <Typography>카테고리</Typography>
                            </div>
                          ) : null}
                          {hasSeries ? (
                            <div className={`paper ${styles.paper}`}>
                              <Typography>연재</Typography>
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {menus.map((menu) => (
                        <SortableItem
                          key={menu.id}
                          menu={menu}
                          isSortable={menus.length > 1}
                          onOpenRenameDialog={handleOpenRenameDialog}
                        />
                      ))}
                    </Stack>
                  </SortableContext>
                </DndContext>
                {menus.length > 1 ? (
                  isMobile ? (
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
                  )
                ) : null}
              </>
            ) : (
              <p className="alert info" style={{ paddingTop: 23 }}>
                <InfoOutlineRoundedIcon />
                <span>글과 페이지가 있을 때에만 사용이 가능합니다.</span>
              </p>
            )}

            {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
            <PopupMessage
              open={Boolean(successMessage)}
              message={successMessage}
              onClose={() => setSuccessMessage('')}
            />
          </Stack>

          {isMobile ? (
            <Drawer
              anchor="bottom"
              open={Boolean(renameTarget)}
              onClose={handleCloseRenameDialog}
              className="VhiDrawer-bottom VhiDrawer-bottom-service"
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
              <div className="VhiDrawer-bottom-content">
                <TextField
                  placeholder="게시판 이름"
                  value={renameValue}
                  onChange={handleRenameValueChange}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                />
              </div>
              <div className="drawer-dialog-actions">
                <button
                  type="button"
                  className="button small cancel"
                  onClick={handleCloseRenameDialog}
                  disabled={isRenaming}
                >
                  취소
                </button>
                <button
                  type="button"
                  className="button small submit"
                  onClick={() => void handleRename()}
                  disabled={isRenaming}
                >
                  저장
                </button>
              </div>
            </Drawer>
          ) : (
            <Dialog
              open={Boolean(renameTarget)}
              onClose={handleCloseRenameDialog}
              fullWidth
              maxWidth="xs"
              className="vh-dialog vh-alert-dialog"
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
                <button type="button" className="cancel-button" onClick={handleCloseRenameDialog} disabled={isRenaming}>
                  취소
                </button>
                <button type="button" onClick={() => void handleRename()} disabled={isRenaming}>
                  저장
                </button>
              </DialogActions>
            </Dialog>
          )}
        </div>
      </div>
    </Container>
  );
}
