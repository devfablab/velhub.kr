'use client';

import { useEffect, useState } from 'react';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import FolderModals from './folderModals';
import styles from '@/app/hub.module.sass';

type FavoriteBlogRow = {
  id: string;
  siteName: string;
  siteLabel: string;
  visibilityType: string;
  visibilityLabel: string;
  isShutdown: boolean;
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
  href: string;
  favoritedAt: string;
  folderId: string | null;
  sortOrder: number;
};

type FavoriteBlogsResponse = {
  blogs?: FavoriteBlogRow[];
  error?: string;
};

type Folder = {
  id: string;
  label: string;
};

export default function FavoriteBlogs() {
  const [blogs, setBlogs] = useState<FavoriteBlogRow[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  // Modals state
  const [isAddFolderOpen, setIsAddFolderOpen] = useState(false);
  const [editFolder, setEditFolder] = useState<Folder | null>(null);
  const [isMoveSitesOpen, setIsMoveSitesOpen] = useState(false);

  // Selection state
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(new Set());

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<FavoriteBlogRow | null>(null);
  const [dragOverItem, setDragOverItem] = useState<FavoriteBlogRow | null>(null);

  const loadData = async () => {
    try {
      setErrorMessage('');
      const [blogsRes, foldersRes] = await Promise.all([
        fetch('/api/hub/blog-favorites', { credentials: 'include' }),
        fetch('/api/hub/favorite-folders', { credentials: 'include' }),
      ]);

      const blogsResult = (await blogsRes.json()) as FavoriteBlogsResponse;
      const foldersResult = await foldersRes.json();

      if (!blogsRes.ok) throw new Error(blogsResult.error ?? 'Error loading blogs');

      setBlogs(Array.isArray(blogsResult.blogs) ? blogsResult.blogs : []);
      setFolders(foldersResult.folders || []);
    } catch (e: any) {
      setErrorMessage(e.message || '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // --- Folder Management API Wrappers ---
  const handleAddFolder = async (label: string) => {
    await fetch('/api/hub/favorite-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    await loadData();
  };

  const handleEditFolder = async (id: string, label: string) => {
    await fetch(`/api/hub/favorite-folders/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label }),
    });
    await loadData();
  };

  const handleDeleteFolder = async (id: string) => {
    await fetch(`/api/hub/favorite-folders/${id}`, { method: 'DELETE' });
    await loadData();
  };

  const handleMoveSites = async (targetFolderId: string | null) => {
    if (selectedSiteIds.size === 0) return;
    const updates = Array.from(selectedSiteIds).map((id) => {
      const blog = blogs.find((b) => b.id === id);
      return { id, folder_id: targetFolderId, sort_order: blog?.sortOrder || 0 };
    });

    await fetch('/api/hub/blog-favorites/move', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });

    setSelectedSiteIds(new Set());
    await loadData();
  };

  // --- Drag and Drop ---
  const handleDragStart = (e: React.DragEvent, item: FavoriteBlogRow) => {
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, item: FavoriteBlogRow) => {
    e.preventDefault();
    if (draggedItem && draggedItem.folderId === item.folderId && draggedItem.id !== item.id) {
      setDragOverItem(item);
    }
  };

  const handleDrop = async (e: React.DragEvent, item: FavoriteBlogRow) => {
    e.preventDefault();
    if (!draggedItem || draggedItem.folderId !== item.folderId || draggedItem.id === item.id) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }

    // Reorder locally
    const folderBlogs = blogs.filter((b) => b.folderId === item.folderId).sort((a, b) => a.sortOrder - b.sortOrder);
    const draggedIndex = folderBlogs.findIndex((b) => b.id === draggedItem.id);
    const dropIndex = folderBlogs.findIndex((b) => b.id === item.id);

    folderBlogs.splice(draggedIndex, 1);
    folderBlogs.splice(dropIndex, 0, draggedItem);

    // Assign new sortOrders
    const updates = folderBlogs.map((b, index) => ({
      id: b.id,
      folder_id: b.folderId,
      sort_order: index,
    }));

    // Optimistic update
    setBlogs((prev) => {
      const newBlogs = [...prev];
      updates.forEach((u) => {
        const idx = newBlogs.findIndex((nb) => nb.id === u.id);
        if (idx !== -1) newBlogs[idx].sortOrder = u.sort_order;
      });
      return newBlogs;
    });

    setDraggedItem(null);
    setDragOverItem(null);

    // Persist
    await fetch('/api/hub/blog-favorites/move', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ updates }),
    });
  };

  // --- Render Helpers ---
  const renderSite = (blog: FavoriteBlogRow) => (
    <div
      key={blog.id}
      className={`${styles['join-site']} ${dragOverItem?.id === blog.id ? 'drag-over' : ''}`}
      draggable
      onDragStart={(e) => handleDragStart(e, blog)}
      onDragOver={(e) => handleDragOver(e, blog)}
      onDrop={(e) => handleDrop(e, blog)}
      style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
    >
      <input
        type="checkbox"
        checked={selectedSiteIds.has(blog.id)}
        onChange={(e) => {
          const newSet = new Set(selectedSiteIds);
          if (e.target.checked) newSet.add(blog.id);
          else newSet.delete(blog.id);
          setSelectedSiteIds(newSet);
        }}
      />
      <div className={styles['join-site-info']} style={{ flex: 1, paddingLeft: 0 }}>
        <div className={styles['site-name']}>
          {blog.profileLogoUrl ? (
            <img src={blog.profileLogoUrl} alt="" />
          ) : (
            <>
              <AppIconAvatar src={blog.profilePictureUrl || null} alt={blog.siteLabel} size={58} />
              <strong>{blog.siteLabel}</strong>
            </>
          )}
          <em>
            {blog.visibilityLabel} {blog.isShutdown ? '(운영중지)' : null}
          </em>
        </div>

        <Anchor href={blog.href} className="button action small">
          블로그 이동
        </Anchor>
      </div>
    </div>
  );

  if (isLoading) return null;
  if (errorMessage)
    return (
      <section className={`paper ${styles.paper}`}>
        <p>{errorMessage}</p>
      </section>
    );
  if (blogs.length === 0) return null;

  const defaultFolderBlogs = blogs.filter((b) => !b.folderId).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className={`paper ${styles.paper} ${styles.join}`}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2>즐겨찾는 블로그</h2>
        <button type="button" className="button small action" onClick={() => setIsAddFolderOpen(true)}>
          폴더 추가
        </button>
      </div>

      <FolderModals
        isAddFolderOpen={isAddFolderOpen}
        setIsAddFolderOpen={setIsAddFolderOpen}
        onAddFolder={handleAddFolder}
        editFolder={editFolder}
        setEditFolder={setEditFolder}
        onEditFolder={handleEditFolder}
        onDeleteFolder={handleDeleteFolder}
        isMoveSitesOpen={isMoveSitesOpen}
        setIsMoveSitesOpen={setIsMoveSitesOpen}
        folders={folders}
        onMoveSites={handleMoveSites}
      />

      <div className={styles['join-sites']}>
        {/* Default Folder */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '1.2em', marginBottom: '8px' }}>기본 폴더</h3>
          {defaultFolderBlogs.length > 0 ? (
            defaultFolderBlogs.map(renderSite)
          ) : (
            <p style={{ color: '#888' }}>항목이 없습니다.</p>
          )}
        </div>

        {/* Custom Folders */}
        {folders.map((folder) => {
          const folderBlogs = blogs.filter((b) => b.folderId === folder.id).sort((a, b) => a.sortOrder - b.sortOrder);
          return (
            <div key={folder.id} style={{ marginBottom: '24px' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}
              >
                <h3 style={{ fontSize: '1.2em' }}>{folder.label}</h3>
                <button type="button" className="button small" onClick={() => setEditFolder(folder)}>
                  폴더 수정
                </button>
              </div>
              {folderBlogs.length > 0 ? folderBlogs.map(renderSite) : <p style={{ color: '#888' }}>항목이 없습니다.</p>}
            </div>
          );
        })}
      </div>

      {/* Floating Move Button */}
      {selectedSiteIds.size > 0 && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#333',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 50,
          }}
        >
          <span>{selectedSiteIds.size}개 사이트 선택됨</span>
          <button
            type="button"
            className="button action"
            onClick={() => setIsMoveSitesOpen(true)}
            style={{ background: '#007aff', color: '#fff', border: 'none' }}
          >
            이동
          </button>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        .drag-over {
          border-top: 2px solid #007aff;
        }
      `,
        }}
      />
    </section>
  );
}
