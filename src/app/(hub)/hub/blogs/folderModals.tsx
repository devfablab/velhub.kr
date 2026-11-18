'use client';

import { useState } from 'react';
import { closestCenter, DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import { Checkbox, FormControl, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { type FavoriteFolder, validateFavoriteFolderLabel } from '@/lib/service/hubFavoriteFolder.shared';
import FormErrorDialog from '@/components/FormErrorDialog';
import MenuItem from '@/components/SelectMenuItem';
import Select from '@/components/SelectWithCheck';
import ResponsivePopup from '../shared/popup';
import styles from '@/app/hub.module.sass';

export type FolderActionError = {
  message: string;
  fieldError?: string;
  isUnknown?: boolean;
};

type FolderLabelPopupProps = {
  open: boolean;
  onClose: () => void;
};

function LabelErrorMessage({ id, message }: { id: string; message: string }) {
  if (!message) return null;

  return (
    <p id={id} className="alert error">
      <ErrorOutlineRoundedIcon />
      <span>{message}</span>
    </p>
  );
}

export function AddFolderPopup({
  open,
  onClose,
  onSubmit,
}: FolderLabelPopupProps & { onSubmit: (label: string, isDefault: boolean) => Promise<FolderActionError | null> }) {
  const [label, setLabel] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [labelError, setLabelError] = useState('');
  const [popupError, setPopupError] = useState<FolderActionError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (isLoading) return;

    const validated = validateFavoriteFolderLabel(label);

    if (validated.error) {
      setLabelError(validated.error);
      return;
    }

    setIsLoading(true);

    try {
      const actionError = await onSubmit(validated.label, isDefault);

      if (actionError) {
        setLabelError(actionError.fieldError ?? '');
        setPopupError(actionError);
        return;
      }

      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ResponsivePopup
        open={open}
        onClose={onClose}
        title="즐겨찾기 폴더 추가"
        maxWidth="xs"
        formId="add-favorite-folder-form"
        onSubmit={() => void handleSubmit()}
        actions={[
          { label: '취소', intent: 'cancel', onClick: onClose },
          { label: '추가', intent: 'submit', onClick: () => void handleSubmit(), disabled: isLoading || !label.trim() },
        ]}
      >
        <TextField
          size="small"
          fullWidth
          placeholder="폴더 이름 입력"
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            setLabelError('');
          }}
          required
          error={Boolean(labelError)}
          slotProps={{
            htmlInput: {
              minLength: 2,
              maxLength: 10,
              'aria-describedby': labelError ? 'add-folder-label-error' : undefined,
            },
          }}
        />
        <LabelErrorMessage id="add-folder-label-error" message={labelError} />
        <FormControlLabel
          className={styles['folder-default-option']}
          control={<Checkbox checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />}
          label="기본 폴더로 지정"
        />
      </ResponsivePopup>
      <FormErrorDialog
        open={Boolean(popupError)}
        title={popupError?.isUnknown ? null : '폴더 이름 확인'}
        messages={popupError ? [popupError.message] : []}
        onClose={() => setPopupError(null)}
      />
    </>
  );
}

export function RenameFolderPopup({
  folder,
  onClose,
  onSubmit,
}: {
  folder: FavoriteFolder | null;
  onClose: () => void;
  onSubmit: (folderId: string, label: string) => Promise<FolderActionError | null>;
}) {
  const [label, setLabel] = useState(folder?.label ?? '');
  const [labelError, setLabelError] = useState('');
  const [popupError, setPopupError] = useState<FolderActionError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!folder || isLoading) return;

    const validated = validateFavoriteFolderLabel(label);

    if (validated.error) {
      setLabelError(validated.error);
      return;
    }

    setIsLoading(true);

    try {
      const actionError = await onSubmit(folder.id, validated.label);

      if (actionError) {
        setLabelError(actionError.fieldError ?? '');
        setPopupError(actionError);
        return;
      }

      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ResponsivePopup
        open={Boolean(folder)}
        onClose={onClose}
        title="폴더명 변경"
        maxWidth="xs"
        formId="rename-favorite-folder-form"
        onSubmit={() => void handleSubmit()}
        actions={[
          { label: '취소', intent: 'cancel', onClick: onClose },
          { label: '변경', intent: 'submit', onClick: () => void handleSubmit(), disabled: isLoading || !label.trim() },
        ]}
      >
        <TextField
          size="small"
          fullWidth
          placeholder="폴더 이름 입력"
          value={label}
          onChange={(event) => {
            setLabel(event.target.value);
            setLabelError('');
          }}
          required
          error={Boolean(labelError)}
          slotProps={{
            htmlInput: {
              minLength: 2,
              maxLength: 10,
              'aria-describedby': labelError ? 'rename-folder-label-error' : undefined,
            },
          }}
        />
        <LabelErrorMessage id="rename-folder-label-error" message={labelError} />
      </ResponsivePopup>
      <FormErrorDialog
        open={Boolean(popupError)}
        title={popupError?.isUnknown ? null : '폴더 이름 확인'}
        messages={popupError ? [popupError.message] : []}
        onClose={() => setPopupError(null)}
      />
    </>
  );
}

export function DeleteFolderPopup({
  folder,
  folders,
  hasBlogs,
  onClose,
  onSubmit,
}: {
  folder: FavoriteFolder | null;
  folders: FavoriteFolder[];
  hasBlogs: boolean;
  onClose: () => void;
  onSubmit: (folderId: string, targetFolderId: string) => void;
}) {
  const [targetFolderId, setTargetFolderId] = useState('');
  const targetFolders = folders.filter((targetFolder) => targetFolder.id !== folder?.id);

  const handleSubmit = () => {
    if (!folder || (hasBlogs && !targetFolderId)) return;

    onSubmit(folder.id, targetFolderId);
    onClose();
  };

  return (
    <ResponsivePopup
      open={Boolean(folder)}
      onClose={onClose}
      title="폴더 삭제"
      maxWidth="xs"
      actions={[
        { label: '취소', intent: 'cancel', onClick: onClose },
        { label: '실행', intent: 'action', onClick: handleSubmit, disabled: hasBlogs && !targetFolderId },
      ]}
    >
      {hasBlogs ? (
        <Stack gap={2}>
          <Stack gap={0.5}>
            <Typography variant="subtitle2">기존 즐겨찾기의 이동을 원하는 폴더를 선택하세요.</Typography>
            <Stack gap={0.5}>
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>실행 버튼을 누르면 폴더는 삭제되고 즐겨찾기는 이동됩니다.</span>
              </p>
              <p className="alert info">
                <InfoOutlineRoundedIcon />
                <span>취소 시에는 현재 상태를 유지합니다.</span>
              </p>
            </Stack>
          </Stack>
          <FormControl fullWidth size="small">
            <Select
              value={targetFolderId}
              displayEmpty
              onChange={(event) => setTargetFolderId(String(event.target.value))}
            >
              <MenuItem value="" disabled>
                폴더 선택
              </MenuItem>
              {targetFolders.map((targetFolder) => (
                <MenuItem key={targetFolder.id} value={targetFolder.id}>
                  {targetFolder.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      ) : (
        <p>실행 버튼을 누르면 폴더가 삭제됩니다. 취소 시에는 현재 상태를 유지합니다.</p>
      )}
    </ResponsivePopup>
  );
}

function SortableFolderItem({ folder }: { folder: FavoriteFolder }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: folder.id });

  return (
    <li
      ref={setNodeRef}
      className={`paper ${styles['folder-order-item']}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button type="button" className={styles['drag-handle']} aria-label="순서 변경" {...attributes} {...listeners}>
        <DragIndicatorIcon />
      </button>
      <strong>{folder.label}</strong>
    </li>
  );
}

export function FolderOrderPopup({
  open,
  folders,
  onClose,
  onSubmit,
}: {
  open: boolean;
  folders: FavoriteFolder[];
  onClose: () => void;
  onSubmit: (folderIds: string[]) => Promise<FolderActionError | null>;
}) {
  const [orderedFolders, setOrderedFolders] = useState<FavoriteFolder[]>(folders);
  const [popupError, setPopupError] = useState<FolderActionError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    setOrderedFolders((previousFolders) => {
      const activeIndex = previousFolders.findIndex((folder) => folder.id === active.id);
      const overIndex = previousFolders.findIndex((folder) => folder.id === over.id);

      return arrayMove(previousFolders, activeIndex, overIndex);
    });
  };

  const handleSubmit = async () => {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const actionError = await onSubmit(orderedFolders.map((folder) => folder.id));

      if (actionError) {
        setPopupError(actionError);
        return;
      }

      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ResponsivePopup
        open={open}
        onClose={onClose}
        title="폴더 순서"
        maxWidth="xs"
        actions={[
          { label: '취소', intent: 'cancel', onClick: onClose },
          { label: '저장', intent: 'submit', onClick: () => void handleSubmit(), disabled: isLoading },
        ]}
      >
        <p className="alert info">
          <InfoOutlineRoundedIcon />
          <span>맨 위에 있는 폴더가 기본 폴더가 됩니다.</span>
        </p>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedFolders.map((folder) => folder.id)} strategy={verticalListSortingStrategy}>
            <ol className={styles['folder-order']}>
              {orderedFolders.map((folder) => (
                <SortableFolderItem key={folder.id} folder={folder} />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      </ResponsivePopup>
      <FormErrorDialog
        open={Boolean(popupError)}
        title={popupError?.isUnknown ? null : '폴더 순서'}
        messages={popupError ? [popupError.message] : []}
        onClose={() => setPopupError(null)}
      />
    </>
  );
}
