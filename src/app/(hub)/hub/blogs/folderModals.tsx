import React, { useEffect, useState } from 'react';
import { FormControl } from '@mui/material';
import { validateFavoriteFolderLabel } from '@/lib/hub/favoriteFolder.shared';
import FormErrorDialog from '@/components/FormErrorDialog';
import MenuItem from '@/components/SelectMenuItem';
import Select from '@/components/SelectWithCheck';
import ResponsivePopup from '../shared/ResponsivePopup';

type Folder = {
  id: string;
  label: string;
};

type FolderModalsProps = {
  isAddFolderOpen: boolean;
  setIsAddFolderOpen: (open: boolean) => void;
  onAddFolder: (label: string) => Promise<FolderActionError | null>;

  editFolder: Folder | null;
  setEditFolder: (folder: Folder | null) => void;
  onEditFolder: (id: string, newLabel: string) => Promise<FolderActionError | null>;
  onDeleteFolder: (id: string) => Promise<FolderActionError | null>;

  isMoveSitesOpen: boolean;
  setIsMoveSitesOpen: (open: boolean) => void;
  folders: Folder[];
  onMoveSites: (targetFolderId: string | null) => Promise<FolderActionError | null>;
};

export type FolderActionError = {
  message: string;
  fieldError?: string;
  isUnknown?: boolean;
};

export default function FolderModals({
  isAddFolderOpen,
  setIsAddFolderOpen,
  onAddFolder,
  editFolder,
  setEditFolder,
  onEditFolder,
  onDeleteFolder,
  isMoveSitesOpen,
  setIsMoveSitesOpen,
  folders,
  onMoveSites,
}: FolderModalsProps) {
  const [addLabel, setAddLabel] = useState('');
  const [editLabel, setEditLabel] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [addLabelError, setAddLabelError] = useState('');
  const [editLabelError, setEditLabelError] = useState('');
  const [popupError, setPopupError] = useState<FolderActionError | null>(null);

  useEffect(() => {
    if (editFolder) {
      setEditLabel(editFolder.label);
      setEditLabelError('');
    }
  }, [editFolder]);

  const handleAddFolder = async () => {
    if (isLoading) return;
    const validated = validateFavoriteFolderLabel(addLabel);
    if (validated.error) {
      setAddLabelError(validated.error);
      setPopupError({ message: validated.error, fieldError: validated.error });
      return;
    }
    setIsLoading(true);
    try {
      const actionError = await onAddFolder(validated.label);
      if (actionError) {
        setAddLabelError(actionError.fieldError ?? '');
        setPopupError(actionError);
        return;
      }
      setAddLabel('');
      setAddLabelError('');
      setIsAddFolderOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditFolder = async () => {
    if (!editFolder || isLoading) return;
    const validated = validateFavoriteFolderLabel(editLabel);
    if (validated.error) {
      setEditLabelError(validated.error);
      setPopupError({ message: validated.error, fieldError: validated.error });
      return;
    }
    setIsLoading(true);
    try {
      const actionError = await onEditFolder(editFolder.id, validated.label);
      if (actionError) {
        setEditLabelError(actionError.fieldError ?? '');
        setPopupError(actionError);
        return;
      }
      setEditFolder(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!editFolder || isLoading) return;
    setIsLoading(true);
    try {
      const actionError = await onDeleteFolder(editFolder.id);
      if (actionError) {
        setPopupError(actionError);
        return;
      }
      setIsDeleteConfirmOpen(false);
      setEditFolder(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMoveSites = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const actionError = await onMoveSites(selectedFolderId);
      if (actionError) {
        setPopupError(actionError);
        return;
      }
      setIsMoveSitesOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <ResponsivePopup
        open={isAddFolderOpen}
        onClose={() => setIsAddFolderOpen(false)}
        title="즐겨찾기 폴더 추가"
        maxWidth="xs"
        actions={[
          { label: '취소', intent: 'cancel', onClick: () => setIsAddFolderOpen(false) },
          {
            label: '추가',
            intent: 'submit',
            onClick: handleAddFolder,
            disabled: isLoading || !addLabel.trim(),
          },
        ]}
      >
        <input
          type="text"
          placeholder="폴더 이름 입력"
          value={addLabel}
          onChange={(event) => {
            setAddLabel(event.target.value);
            setAddLabelError('');
          }}
          minLength={2}
          maxLength={10}
          required
          aria-invalid={Boolean(addLabelError)}
          aria-describedby={addLabelError ? 'add-folder-label-error' : undefined}
          style={{ width: '100%', padding: '8px' }}
        />
        {addLabelError ? (
          <p id="add-folder-label-error" className="alert popup-error">
            {addLabelError}
          </p>
        ) : null}
      </ResponsivePopup>

      <ResponsivePopup
        open={Boolean(editFolder) && !isDeleteConfirmOpen}
        onClose={() => setEditFolder(null)}
        title="폴더 수정"
        maxWidth="xs"
        actions={[
          { label: '삭제', intent: 'danger', onClick: () => setIsDeleteConfirmOpen(true) },
          { label: '취소', intent: 'cancel', onClick: () => setEditFolder(null) },
          {
            label: '수정 완료',
            intent: 'submit',
            onClick: handleEditFolder,
            disabled: isLoading || !editLabel.trim(),
          },
        ]}
      >
        <input
          type="text"
          placeholder="폴더 이름 입력"
          value={editLabel}
          onChange={(event) => {
            setEditLabel(event.target.value);
            setEditLabelError('');
          }}
          minLength={2}
          maxLength={10}
          required
          aria-invalid={Boolean(editLabelError)}
          aria-describedby={editLabelError ? 'edit-folder-label-error' : undefined}
          style={{ width: '100%', padding: '8px' }}
        />
        {editLabelError ? (
          <p id="edit-folder-label-error" className="alert popup-error">
            {editLabelError}
          </p>
        ) : null}
      </ResponsivePopup>

      <ResponsivePopup
        open={isDeleteConfirmOpen && Boolean(editFolder)}
        onClose={() => setIsDeleteConfirmOpen(false)}
        title="정말로 삭제합니까?"
        maxWidth="xs"
        actions={[
          { label: '취소', intent: 'cancel', onClick: () => setIsDeleteConfirmOpen(false) },
          { label: '확인', intent: 'danger', onClick: handleDeleteFolder, disabled: isLoading },
        ]}
      >
        <p>폴더를 삭제하면 폴더에 있던 사이트들은 기본 폴더로 이동됩니다.</p>
      </ResponsivePopup>

      <ResponsivePopup
        open={isMoveSitesOpen}
        onClose={() => setIsMoveSitesOpen(false)}
        title="이동할 폴더 선택"
        maxWidth="xs"
        actions={[
          { label: '취소', intent: 'cancel', onClick: () => setIsMoveSitesOpen(false) },
          { label: '이동', intent: 'submit', onClick: handleMoveSites, disabled: isLoading },
        ]}
      >
        <FormControl fullWidth size="small">
          <Select value={selectedFolderId || ''} onChange={(event) => setSelectedFolderId(event.target.value || null)}>
            <MenuItem value="">기본 폴더</MenuItem>
            {folders.map((folder) => (
              <MenuItem key={folder.id} value={folder.id}>
                {folder.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
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
