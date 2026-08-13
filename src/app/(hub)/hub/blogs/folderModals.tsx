import React, { useState, useEffect } from 'react';

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

  // Handle Add Folder
  const handleAddFolder = async () => {
    if (!addLabel.trim() || isLoading) return;
    setIsLoading(true);
    await onAddFolder(addLabel);
    setAddLabel('');
    setIsAddFolderOpen(false);
    setIsLoading(false);
  };

  // Handle Edit Folder
  const handleEditFolder = async () => {
    if (!editLabel.trim() || !editFolder || isLoading) return;
    setIsLoading(true);
    await onEditFolder(editFolder.id, editLabel);
    setEditFolder(null);
    setIsLoading(false);
  };

  // Handle Delete Folder
  const handleDeleteFolder = async () => {
    if (!editFolder || isLoading) return;
    setIsLoading(true);
    await onDeleteFolder(editFolder.id);
    setIsDeleteConfirmOpen(false);
    setEditFolder(null);
    setIsLoading(false);
  };

  // Handle Move Sites
  const handleMoveSites = async () => {
    if (isLoading) return;
    setIsLoading(true);
    await onMoveSites(selectedFolderId);
    setIsMoveSitesOpen(false);
    setIsLoading(false);
  };

  return (
    <>
      {/* Add Folder Modal */}
      {isAddFolderOpen && (
        <dialog open className="dialog-layer">
          <div className="dialog-content">
            <h3>즐겨찾기 폴더 추가</h3>
            <div style={{ margin: '16px 0' }}>
              <input
                type="text"
                placeholder="폴더 이름 입력"
                value={addLabel}
                onChange={(e) => setAddLabel(e.target.value)}
                style={{ width: '100%', padding: '8px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="button" onClick={() => setIsAddFolderOpen(false)}>
                취소
              </button>
              <button
                type="button"
                className="button action"
                onClick={handleAddFolder}
                disabled={isLoading || !addLabel.trim()}
              >
                추가
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Edit Folder Modal */}
      {editFolder && !isDeleteConfirmOpen && (
        <dialog open className="dialog-layer">
          <div className="dialog-content">
            <h3>폴더 수정</h3>
            <div style={{ margin: '16px 0' }}>
              <input
                type="text"
                placeholder="폴더 이름 입력"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                style={{ width: '100%', padding: '8px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="button danger" onClick={() => setIsDeleteConfirmOpen(true)}>
                삭제
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className="button" onClick={() => setEditFolder(null)}>
                  취소
                </button>
                <button
                  type="button"
                  className="button action"
                  onClick={handleEditFolder}
                  disabled={isLoading || !editLabel.trim()}
                >
                  수정 완료
                </button>
              </div>
            </div>
          </div>
        </dialog>
      )}

      {/* Delete Confirm Modal */}
      {isDeleteConfirmOpen && editFolder && (
        <dialog open className="dialog-layer">
          <div className="dialog-content">
            <h3>정말로 삭제합니까?</h3>
            <p style={{ margin: '16px 0' }}>폴더를 삭제하면 폴더에 있던 사이트들은 기본 폴더로 이동됩니다.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="button" onClick={() => setIsDeleteConfirmOpen(false)}>
                취소
              </button>
              <button type="button" className="button action" onClick={handleDeleteFolder} disabled={isLoading}>
                확인
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Move Sites Modal */}
      {isMoveSitesOpen && (
        <dialog open className="dialog-layer">
          <div className="dialog-content">
            <h3>이동할 폴더 선택</h3>
            <div style={{ margin: '16px 0' }}>
              <select
                value={selectedFolderId || ''}
                onChange={(e) => setSelectedFolderId(e.target.value || null)}
                style={{ width: '100%', padding: '8px' }}
              >
                <option value="">기본 폴더</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" className="button" onClick={() => setIsMoveSitesOpen(false)}>
                취소
              </button>
              <button type="button" className="button action" onClick={handleMoveSites} disabled={isLoading}>
                이동
              </button>
            </div>
          </div>
        </dialog>
      )}

      {/* Background Dim (if any dialog is open) */}
      {(isAddFolderOpen || editFolder || isMoveSitesOpen) && (
        <div
          className="dialog-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 100,
          }}
        />
      )}
    </>
  );
}
