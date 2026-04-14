'use client';

import { useEffect, useState, type JSX } from 'react';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

type MenuRow = {
  id: string;
  board_type: string;
  board_label: string;
  display_label: string;
  sort_order: number;
  is_renameable: boolean;
};

type Props = {
  siteName: string;
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
    <Paper
      ref={setNodeRef}
      elevation={3}
      sx={{
        p: 2,
        minWidth: 160,
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        transform: CSS.Transform.toString(transform),
        transition,
        cursor: 'grab',
      }}
      {...attributes}
      {...listeners}
    >
      <Typography>{menu.display_label}</Typography>

      {menu.is_renameable ? (
        <Button
          type="button"
          variant="outlined"
          onPointerDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onOpenRenameDialog(menu);
          }}
        >
          이름 변경
        </Button>
      ) : null}
    </Paper>
  );
}

export default function Opt({ siteName }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 4,
      },
    }),
  );

  const [menus, setMenus] = useState<MenuRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [renameTarget, setRenameTarget] = useState<MenuRow | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    async function loadMenus() {
      try {
        const response = await fetch(`/api/design/shared/menu?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();
        console.log('result: ', result);

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
      const response = await fetch('/api/design/shared/menu', {
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
      const response = await fetch('/api/design/shared/menu', {
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
    return null;
  }

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      {console.log('menus: ', menus)}
      <Stack spacing={3}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={menus.map((menu) => menu.id)} strategy={horizontalListSortingStrategy}>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
              <Paper elevation={3} sx={{ p: 2, minWidth: 160, display: 'flex', alignItems: 'center' }}>
                <Typography>홈</Typography>
              </Paper>

              {menus.map((menu) => (
                <SortableItem key={menu.id} menu={menu} onOpenRenameDialog={handleOpenRenameDialog} />
              ))}
            </Stack>
          </SortableContext>
        </DndContext>

        <Stack direction="row" justifyContent="flex-end">
          <Button type="button" variant="contained" onClick={() => void handleApply()} disabled={isSubmitting}>
            적용
          </Button>
        </Stack>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
        {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      </Stack>

      <Dialog open={Boolean(renameTarget)} onClose={handleCloseRenameDialog} fullWidth maxWidth="xs">
        <DialogTitle>게시판 이름 변경</DialogTitle>
        <DialogContent>
          <TextField
            label="게시판 이름"
            value={renameValue}
            onChange={handleRenameValueChange}
            fullWidth
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCloseRenameDialog} disabled={isRenaming}>
            취소
          </Button>
          <Button type="button" variant="contained" onClick={() => void handleRename()} disabled={isRenaming}>
            저장
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
