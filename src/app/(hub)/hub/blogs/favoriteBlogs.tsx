'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useDroppable,
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
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import { Snackbar } from '@mui/material';
import {
  type FavoriteBlog,
  type FavoriteBlogsResponse,
  type FavoriteFolder,
  getFolderBlogs,
  sortFavoriteBlogs,
  sortFavoriteFolders,
  trackFavoriteRequest,
} from '@/lib/service/hubFavoriteFolder.shared';
import FormErrorDialog from '@/components/FormErrorDialog';
import ScreenState from '@/components/service/ScreenState';
import { ServiceNoDataIcon } from '@/components/Svgs';
import FavoriteBlogCard from './favoriteBlogCard';
import {
  AddFolderPopup,
  DeleteFolderPopup,
  type FolderActionError,
  FolderOrderPopup,
  RenameFolderPopup,
} from './folderModals';
import styles from '@/app/hub.module.sass';

const UNDO_DURATION = 5000;
const FOLDER_DROP_PREFIX = 'folder:';

type PendingAction =
  | { kind: 'removeBlog'; favoriteId: string; previousBlogs: FavoriteBlog[] }
  | {
      kind: 'deleteFolder';
      folderId: string;
      targetFolderId: string;
      previousBlogs: FavoriteBlog[];
      previousFolders: FavoriteFolder[];
    };

type Props = {
  initialData: FavoriteBlogsResponse | null;
  initialError: string;
};

const NETWORK_ERROR: FolderActionError = { message: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.', isUnknown: true };

async function fetchFavoriteBlogs() {
  const response = await fetch('/api/hub/blog-favorites', { credentials: 'include', cache: 'no-store' });
  const result = (await response.json()) as FavoriteBlogsResponse;

  if (!response.ok) throw new Error(result.error ?? '즐겨찾는 블로그를 불러오지 못했습니다.');

  return result;
}

function getLoadErrorMessage(unknownError: unknown) {
  return unknownError instanceof Error ? unknownError.message : '즐겨찾는 블로그를 불러오지 못했습니다.';
}

async function getActionError(response: Response): Promise<FolderActionError | null> {
  if (response.ok) return null;

  const payload = (await response.json().catch(() => null)) as {
    error?: string;
    fieldErrors?: { label?: string };
  } | null;

  if (response.status >= 500 || !payload?.error) {
    return { message: '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.', isUnknown: true };
  }

  return { message: payload.error, fieldError: payload.fieldErrors?.label };
}

function applyFolderOrder(blogs: FavoriteBlog[], folderId: string, orderedIds: UniqueIdentifier[]) {
  const positions = new Map(orderedIds.map((favoriteId, index) => [favoriteId, index]));

  return blogs.map((blog) => {
    const position = positions.get(blog.id);

    return position === undefined ? blog : { ...blog, folderId, sortOrder: position };
  });
}

function withDefaultFolder(folders: FavoriteFolder[]) {
  return sortFavoriteFolders(folders).map((folder, index) => ({ ...folder, sortOrder: index, isDefault: index === 0 }));
}

function SortableBlog({ blog, onRemove }: { blog: FavoriteBlog; onRemove: (blog: FavoriteBlog) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: blog.id });

  return (
    <div
      ref={setNodeRef}
      className={isDragging ? styles.dragging : undefined}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <FavoriteBlogCard
        blog={blog}
        handle={
          <button type="button" className={styles['drag-handle']} aria-label="순서 변경" {...attributes} {...listeners}>
            <DragIndicatorIcon />
          </button>
        }
        action={
          <button
            type="button"
            className={`button small danger ${styles['setting-folder-button']}`}
            onClick={() => onRemove(blog)}
          >
            빼기
          </button>
        }
      />
    </div>
  );
}

function FolderDropArea({ folderId, children }: { folderId: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: `${FOLDER_DROP_PREFIX}${folderId}` });

  return (
    <div ref={setNodeRef} className={`${styles.list} ${styles['list-newest']} ${styles['favorite-drop-area']}`}>
      {children}
    </div>
  );
}

export default function FavoriteBlogs({ initialData, initialError }: Props) {
  const [blogs, setBlogs] = useState<FavoriteBlog[]>(initialData?.blogs ?? []);
  const [folders, setFolders] = useState<FavoriteFolder[]>(sortFavoriteFolders(initialData?.folders ?? []));
  const [canUseFolders, setCanUseFolders] = useState(initialData?.canUseFolders === true);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [actionError, setActionError] = useState<FolderActionError | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [isFolderOrderOpen, setIsFolderOrderOpen] = useState(false);
  const [renameFolder, setRenameFolder] = useState<FavoriteFolder | null>(null);
  const [deleteFolder, setDeleteFolder] = useState<FavoriteFolder | null>(null);
  const [popupKey, setPopupKey] = useState(0);

  const pendingActionRef = useRef<PendingAction | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartFolderIdRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const applyData = useCallback((result: FavoriteBlogsResponse) => {
    setBlogs(result.blogs ?? []);
    setFolders(sortFavoriteFolders(result.folders ?? []));
    setCanUseFolders(result.canUseFolders === true);
    setErrorMessage('');
  }, []);

  const loadData = useCallback(async () => {
    try {
      applyData(await fetchFavoriteBlogs());
    } catch (unknownError) {
      setErrorMessage(getLoadErrorMessage(unknownError));
    }
  }, [applyData]);

  const commitAction = useCallback(
    async (action: PendingAction, keepalive = false) => {
      const request = trackFavoriteRequest(
        action.kind === 'removeBlog'
          ? fetch(`/api/hub/blog-favorites?id=${encodeURIComponent(action.favoriteId)}`, {
              method: 'DELETE',
              keepalive,
            })
          : fetch(
              `/api/hub/favorite-folders/${encodeURIComponent(action.folderId)}?targetFolderId=${encodeURIComponent(action.targetFolderId)}`,
              { method: 'DELETE', keepalive },
            ),
      );

      if (keepalive) {
        void request.catch(() => null);
        return;
      }

      try {
        const nextActionError = await getActionError(await request);

        if (nextActionError) {
          setActionError(nextActionError);
          await loadData();
        }
      } catch {
        setActionError(NETWORK_ERROR);
        await loadData();
      }
    },
    [loadData],
  );

  const takePendingAction = useCallback(() => {
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);

    const action = pendingActionRef.current;

    pendingTimerRef.current = null;
    pendingActionRef.current = null;
    setPendingAction(null);

    return action;
  }, []);

  const flushPendingAction = useCallback(() => {
    const action = takePendingAction();

    if (action) void commitAction(action);
  }, [commitAction, takePendingAction]);

  const startPendingAction = (action: PendingAction) => {
    flushPendingAction();

    pendingActionRef.current = action;
    setPendingAction(action);
    pendingTimerRef.current = setTimeout(() => {
      const currentAction = takePendingAction();

      if (currentAction) void commitAction(currentAction);
    }, UNDO_DURATION);
  };

  const undoPendingAction = () => {
    const action = takePendingAction();

    if (!action) return;

    setBlogs(action.previousBlogs);

    if (action.kind === 'deleteFolder') setFolders(action.previousFolders);
  };

  useEffect(() => {
    const handlePageHide = () => {
      const action = takePendingAction();

      if (action) void commitAction(action, true);
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) void loadData();
    };

    fetchFavoriteBlogs()
      .then(applyData)
      .catch((unknownError: unknown) => setErrorMessage(getLoadErrorMessage(unknownError)));
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    return () => {
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      handlePageHide();
    };
  }, [applyData, commitAction, loadData, takePendingAction]);

  const handleRemoveBlog = (blog: FavoriteBlog) => {
    const previousBlogs = blogs;

    startPendingAction({ kind: 'removeBlog', favoriteId: blog.id, previousBlogs });
    setBlogs(previousBlogs.filter((previousBlog) => previousBlog.id !== blog.id));
  };

  const handleDeleteFolder = (folderId: string, targetFolderId: string) => {
    const previousBlogs = blogs;
    const previousFolders = folders;
    const targetBlogs = getFolderBlogs(previousBlogs, targetFolderId);
    const bottomSortOrder = targetBlogs.reduce((maximum, blog) => Math.max(maximum, blog.sortOrder + 1), 0);
    const movedIds = getFolderBlogs(previousBlogs, folderId).map((blog) => blog.id);
    const movedPositions = new Map(movedIds.map((favoriteId, index) => [favoriteId, bottomSortOrder + index]));

    startPendingAction({ kind: 'deleteFolder', folderId, targetFolderId, previousBlogs, previousFolders });
    setBlogs(
      previousBlogs.map((blog) => {
        const position = movedPositions.get(blog.id);

        return position === undefined ? blog : { ...blog, folderId: targetFolderId, sortOrder: position };
      }),
    );
    setFolders(withDefaultFolder(previousFolders.filter((folder) => folder.id !== folderId)));
  };

  const handleAddFolder = async (label: string, isDefault: boolean) => {
    flushPendingAction();

    try {
      const response = await fetch('/api/hub/favorite-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, isDefault }),
      });
      const nextActionError = await getActionError(response.clone());

      if (nextActionError) return nextActionError;

      const result = (await response.json()) as { folders?: FavoriteFolder[] };

      setFolders(sortFavoriteFolders(result.folders ?? []));
      return null;
    } catch {
      return NETWORK_ERROR;
    }
  };

  const handleRenameFolder = async (folderId: string, label: string) => {
    flushPendingAction();

    try {
      const response = await fetch(`/api/hub/favorite-folders/${encodeURIComponent(folderId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label }),
      });
      const nextActionError = await getActionError(response);

      if (nextActionError) return nextActionError;

      setFolders((previousFolders) =>
        previousFolders.map((folder) => (folder.id === folderId ? { ...folder, label } : folder)),
      );
      return null;
    } catch {
      return NETWORK_ERROR;
    }
  };

  const handleFolderOrder = async (folderIds: string[]) => {
    flushPendingAction();

    try {
      const response = await fetch('/api/hub/favorite-folders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderIds }),
      });
      const nextActionError = await getActionError(response.clone());

      if (nextActionError) return nextActionError;

      const result = (await response.json()) as { folders?: FavoriteFolder[] };

      setFolders(sortFavoriteFolders(result.folders ?? []));
      return null;
    } catch {
      return NETWORK_ERROR;
    }
  };

  const findFolderId = (id: UniqueIdentifier) => {
    const value = String(id);

    if (value.startsWith(FOLDER_DROP_PREFIX)) return value.slice(FOLDER_DROP_PREFIX.length);

    return blogs.find((blog) => blog.id === value)?.folderId ?? null;
  };

  const handleDragStart = ({ active }: { active: { id: UniqueIdentifier } }) => {
    flushPendingAction();
    dragStartFolderIdRef.current = findFolderId(active.id);
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;

    const activeFolderId = findFolderId(active.id);
    const overFolderId = findFolderId(over.id);

    if (!activeFolderId || !overFolderId || activeFolderId === overFolderId) return;

    setBlogs((previousBlogs) => {
      const overIds = getFolderBlogs(previousBlogs, overFolderId).map((blog) => blog.id);
      const overIndex = overIds.indexOf(String(over.id));
      const insertIndex = overIndex === -1 ? overIds.length : overIndex;
      const nextOverIds = [...overIds.slice(0, insertIndex), String(active.id), ...overIds.slice(insertIndex)];
      const nextActiveIds = getFolderBlogs(previousBlogs, activeFolderId)
        .map((blog) => blog.id)
        .filter((favoriteId) => favoriteId !== active.id);

      return applyFolderOrder(
        applyFolderOrder(previousBlogs, activeFolderId, nextActiveIds),
        overFolderId,
        nextOverIds,
      );
    });
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const startFolderId = dragStartFolderIdRef.current;

    dragStartFolderIdRef.current = null;

    if (!over || !startFolderId) {
      await loadData();
      return;
    }

    const currentFolderId = findFolderId(active.id);

    if (!currentFolderId) return;

    const currentIds = getFolderBlogs(blogs, currentFolderId).map((blog) => blog.id);
    const activeIndex = currentIds.indexOf(String(active.id));
    const overIndex = currentIds.indexOf(String(over.id));
    const orderedIds =
      overIndex === -1 || activeIndex === overIndex ? currentIds : arrayMove(currentIds, activeIndex, overIndex);
    const nextBlogs = applyFolderOrder(blogs, currentFolderId, orderedIds);
    const changedFolderIds = new Set([startFolderId, currentFolderId]);
    const updates = nextBlogs
      .filter((blog) => changedFolderIds.has(blog.folderId))
      .map((blog) => ({ id: blog.id, folder_id: blog.folderId, sort_order: blog.sortOrder }));

    setBlogs(nextBlogs);

    if (startFolderId === currentFolderId && orderedIds === currentIds) return;

    try {
      const response = await trackFavoriteRequest(
        fetch('/api/hub/blog-favorites/move', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates }),
        }),
      );
      const nextActionError = await getActionError(response);

      if (nextActionError) {
        setActionError(nextActionError);
        await loadData();
      }
    } catch {
      setActionError(NETWORK_ERROR);
      await loadData();
    }
  };

  if (errorMessage)
    return (
      <section className={`paper ${styles.paper}`}>
        <ScreenState kind="error">{errorMessage}</ScreenState>
      </section>
    );

  const undoSnackbar = (
    <Snackbar
      open={Boolean(pendingAction)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      message={pendingAction?.kind === 'deleteFolder' ? '폴더를 삭제했습니다.' : '즐겨찾기에서 뺐습니다.'}
      action={
        <button type="button" className="button small submit" onClick={undoPendingAction}>
          취소하기
        </button>
      }
    />
  );

  const errorDialog = (
    <FormErrorDialog
      open={Boolean(actionError)}
      title={actionError?.isUnknown ? null : '즐겨찾기 편집'}
      messages={actionError ? [actionError.message] : []}
      onClose={() => setActionError(null)}
    />
  );

  if (!canUseFolders) {
    const sortedBlogs = sortFavoriteBlogs(blogs, folders);

    return (
      <section className={`paper ${styles.paper} ${styles.join}`}>
        <div className={styles['section-headline']}>
          <h2>즐겨찾기</h2>
        </div>
        {sortedBlogs.length > 0 ? (
          <div className={`${styles.list} ${styles['list-newest']}`}>
            {sortedBlogs.map((blog) => (
              <FavoriteBlogCard
                key={blog.id}
                blog={blog}
                action={
                  <button
                    type="button"
                    className={`button small danger ${styles['setting-folder-button']}`}
                    onClick={() => handleRemoveBlog(blog)}
                  >
                    빼기
                  </button>
                }
              />
            ))}
          </div>
        ) : (
          <div className="paper page-info">
            <ServiceNoDataIcon />
            <p>즐겨찾는 블로그가 없습니다.</p>
          </div>
        )}
        {undoSnackbar}
        {errorDialog}
      </section>
    );
  }

  return (
    <section className={`paper ${styles.paper} ${styles.join}`}>
      <div className={styles['section-headline']}>
        <h2>즐겨찾기</h2>
        <div className={styles['section-actions']}>
          {folders.length > 1 ? (
            <button
              type="button"
              className={`button medium action ${styles['setting-folder-button']}`}
              onClick={() => {
                setPopupKey((previousKey) => previousKey + 1);
                setIsFolderOrderOpen(true);
              }}
            >
              <EditNoteRoundedIcon /> 폴더 순서
            </button>
          ) : null}
          <button
            type="button"
            className={`button medium submit ${styles['setting-folder-button']}`}
            onClick={() => {
              setPopupKey((previousKey) => previousKey + 1);
              setIsAddFolderOpen(true);
            }}
          >
            <AddRoundedIcon /> 폴더 추가
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={(event) => void handleDragEnd(event)}
        onDragCancel={() => void loadData()}
      >
        <div className={styles['hub-list-groups']}>
          {folders.map((folder) => {
            const folderBlogs = getFolderBlogs(blogs, folder.id);
            return (
              <div key={folder.id}>
                <div className={styles['folder-headline']}>
                  <h3>{folder.label}</h3>
                  <div className={styles['section-actions']}>
                    <button
                      type="button"
                      className={`button small normal ${styles['setting-folder-button']}`}
                      onClick={() => setRenameFolder(folder)}
                    >
                      <EditNoteRoundedIcon />
                      폴더명 변경
                    </button>
                    {folders.length > 1 ? (
                      <button
                        type="button"
                        className={`button small danger ${styles['setting-folder-button']}`}
                        onClick={() => setDeleteFolder(folder)}
                      >
                        <DeleteSweepRoundedIcon />
                        폴더 삭제
                      </button>
                    ) : null}
                  </div>
                </div>
                <SortableContext items={folderBlogs.map((blog) => blog.id)} strategy={verticalListSortingStrategy}>
                  <FolderDropArea folderId={folder.id}>
                    {folderBlogs.length > 0 ? (
                      folderBlogs.map((blog) => <SortableBlog key={blog.id} blog={blog} onRemove={handleRemoveBlog} />)
                    ) : (
                      <ScreenState>항목이 없습니다.</ScreenState>
                    )}
                  </FolderDropArea>
                </SortableContext>
              </div>
            );
          })}
        </div>
      </DndContext>

      <AddFolderPopup
        key={`add-${popupKey}`}
        open={isAddFolderOpen}
        onClose={() => setIsAddFolderOpen(false)}
        onSubmit={handleAddFolder}
      />
      <RenameFolderPopup
        key={`rename-${renameFolder?.id ?? ''}`}
        folder={renameFolder}
        onClose={() => setRenameFolder(null)}
        onSubmit={handleRenameFolder}
      />
      <DeleteFolderPopup
        key={`delete-${deleteFolder?.id ?? ''}`}
        folder={deleteFolder}
        folders={folders}
        hasBlogs={deleteFolder ? getFolderBlogs(blogs, deleteFolder.id).length > 0 : false}
        onClose={() => setDeleteFolder(null)}
        onSubmit={handleDeleteFolder}
      />
      <FolderOrderPopup
        key={`order-${popupKey}`}
        open={isFolderOrderOpen}
        folders={folders}
        onClose={() => setIsFolderOrderOpen(false)}
        onSubmit={handleFolderOrder}
      />
      {undoSnackbar}
      {errorDialog}
    </section>
  );
}
