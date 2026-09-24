/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import ResponsivePopup from '../shared/ResponsivePopup';

type Folder = {
  id: string;
  label: string;
};

type FolderModalsProps = {
  isAddFolderOpen: boolean;
  setIsAddFolderOpen: (open: boolean) => void;
  onAddFolder: (label: string) => Promise<void>;

  editFolder: Folder | null;
  setEditFolder: (folder: Folder | null) => void;
  onEditFolder: (id: string, newLabel: string) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;

  isMoveSitesOpen: boolean;
  setIsMoveSitesOpen: (open: boolean) => void;
  folders: Folder[];
  onMoveSites: (targetFolderId: string | null) => Promise<void>;
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

  useEffect(() => {
    if (editFolder) {
      setEditLabel(editFolder.label);
    }
  }, [editFolder]);

  const handleAddFolder = async () => {
    if (!addLabel.trim() || isLoading) return;
    setIsLoading(true);
    await onAddFolder(addLabel);
    setAddLabel('');
    setIsAddFolderOpen(false);
    setIsLoading(false);
  };

  const handleEditFolder = async () => {
    if (!editLabel.trim() || !editFolder || isLoading) return;
    setIsLoading(true);
    await onEditFolder(editFolder.id, editLabel);
    setEditFolder(null);
    setIsLoading(false);
  };

  const handleDeleteFolder = async () => {
    if (!editFolder || isLoading) return;
    setIsLoading(true);
    await onDeleteFolder(editFolder.id);
    setIsDeleteConfirmOpen(false);
    setEditFolder(null);
    setIsLoading(false);
  };

  const handleMoveSites = async () => {
    if (isLoading) return;
    setIsLoading(true);
    await onMoveSites(selectedFolderId);
    setIsMoveSitesOpen(false);
    setIsLoading(false);
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
          onChange={(event) => setAddLabel(event.target.value)}
          style={{ width: '100%', padding: '8px' }}
        />
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
          onChange={(event) => setEditLabel(event.target.value)}
          style={{ width: '100%', padding: '8px' }}
        />
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
        <select
          value={selectedFolderId || ''}
          onChange={(event) => setSelectedFolderId(event.target.value || null)}
          style={{ width: '100%', padding: '8px' }}
        >
          <option value="">기본 폴더</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.label}
            </option>
          ))}
        </select>
      </ResponsivePopup>
    </>
  );
}
