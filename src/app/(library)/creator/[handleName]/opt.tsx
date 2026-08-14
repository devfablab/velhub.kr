'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Avatar, Box, Stack, styled, TextField, Typography } from '@mui/material';
import NearbyErrorRoundedIcon from '@mui/icons-material/NearbyErrorRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { formatTimeAgo } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import { ThemeMode, useThemeMode } from '@/app/themeProvider';
import styles from '@/app/new.module.sass';

type Post = {
  id: string;
  subject: string;
  url: string;
  siteLabel: string;
  seriesLabel: string;
  publishedAt: string | null;
};
type CreatorLink = { id?: string; label: string; url: string };
type CreatorProfile = {
  id?: string;
  handleName: string;
  coverImage: string | null;
  introduction: string | null;
  links: CreatorLink[];
};
type Response = {
  creator: CreatorProfile & { activityName: string; profileImage: string | null };
  posts: Post[];
  total: number;
  page: number;
  isOwner: boolean;
};

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

function getStoredThemeMode() {
  if (typeof window === 'undefined') {
    return 'system' as ThemeMode;
  }

  const storedThemeMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (isThemeMode(storedThemeMode)) {
    return storedThemeMode;
  }

  return 'system' as ThemeMode;
}

function getResolvedThemeMode(themeMode: ThemeMode) {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeMode(themeMode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', `yellow-${getResolvedThemeMode(themeMode)}`);
}

const MAX_FILE_SIZE = 1024 * 1024;

function withProtocol(value: string) {
  const text = value.trim();
  return text && !/^[a-z][a-z\d+.-]*:\/\//i.test(text) ? `https://${text}` : text;
}

async function toCoverImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('png, jpg, webp 이미지만 등록할 수 있습니다.');
  if (file.size >= MAX_FILE_SIZE) throw new Error('이미지는 1MB 미만이어야 합니다.');
  const source = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 1270;
  canvas.height = 270;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('이미지를 처리하지 못했습니다.');
  const ratio = Math.max(canvas.width / source.width, canvas.height / source.height);
  const width = source.width * ratio;
  const height = source.height * ratio;
  context.drawImage(source, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  source.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
  if (!blob) throw new Error('이미지를 처리하지 못했습니다.');
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '')}.webp`, { type: 'image/webp' });
}

type SortableCreatorLink = CreatorLink & { _sortId: string };

function SortableLinkItem({
  link,
  index,
  updateLink,
  moveLinkToTop,
  removeLink,
}: {
  link: SortableCreatorLink;
  index: number;
  updateLink: (index: number, key: keyof CreatorLink, value: string) => void;
  moveLinkToTop: (index: number) => void;
  removeLink: (index: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: link._sortId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Stack ref={setNodeRef} style={style} gap={1} className="paper">
      <Stack direction="row" alignItems="flex-start" gap={1}>
        <div {...attributes} {...listeners} style={{ cursor: 'grab' }}>
          <DragIndicatorIcon sx={{ width: 20, height: 20 }} />
        </div>
        <Stack gap={1} flex={1}>
          <Stack gap={1}>
            <Typography variant="subtitle2">레이블</Typography>
            <TextField
              size="small"
              value={link.label}
              onChange={(event) => updateLink(index, 'label', event.target.value)}
            />
          </Stack>
          <Stack gap={1}>
            <Typography variant="subtitle2">링크</Typography>
            <TextField
              size="small"
              value={link.url}
              onChange={(event) => updateLink(index, 'url', event.target.value)}
            />
          </Stack>
        </Stack>
      </Stack>
      <Stack direction="row" gap={1} justifyContent="space-between">
        {index > 0 ? (
          <button type="button" className="button small action" onClick={() => moveLinkToTop(index)}>
            메인 링크로 설정
          </button>
        ) : (
          <p className="alert info">
            <InfoOutlineRoundedIcon />
            <span>메인 링크입니다</span>
          </p>
        )}
        <button type="button" className="button small danger" onClick={() => removeLink(index)}>
          삭제
        </button>
      </Stack>
    </Stack>
  );
}

function ProfileForm({
  profile,
  onCancel,
  onSaved,
}: {
  profile: CreatorProfile;
  onCancel: () => void;
  onSaved: (profile: CreatorProfile) => void;
}) {
  const [introduction, setIntroduction] = useState(profile.introduction ?? '');
  const [coverImage, setCoverImage] = useState(profile.coverImage ?? '');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [links, setLinks] = useState<SortableCreatorLink[]>(
    profile.links.map((link) => ({ ...link, _sortId: link.id ?? crypto.randomUUID() })),
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const updateLink = (index: number, key: keyof CreatorLink, value: string) =>
    setLinks((current) => current.map((link, linkIndex) => (linkIndex === index ? { ...link, [key]: value } : link)));
  const moveLinkToTop = (index: number) =>
    setLinks((current) => [current[index], ...current.filter((_, linkIndex) => linkIndex !== index)]);

  const selectCover = async (file: File | undefined) => {
    if (!file) return;
    try {
      const nextFile = await toCoverImage(file);
      setCoverFile(nextFile);
      setCoverImage(URL.createObjectURL(nextFile));
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '이미지를 처리하지 못했습니다.');
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLinks((items) => {
        const oldIndex = items.findIndex((item) => item._sortId === active.id);
        const newIndex = items.findIndex((item) => item._sortId === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      let nextCoverImage = coverImage;
      if (coverFile) {
        const formData = new FormData();
        formData.append('file', coverFile);
        const uploadResponse = await fetch('/api/creator/profile/cover', {
          method: 'POST',
          body: formData,
        });
        const uploadPayload = await uploadResponse.json();
        if (!uploadResponse.ok) {
          throw new Error(uploadPayload.message ?? '커버 이미지를 업로드하지 못했습니다.');
        }
        nextCoverImage = uploadPayload.url;
      }
      const response = await fetch('/api/creator/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handleName: profile.handleName,
          introduction,
          coverImage: nextCoverImage,
          links: links.map((link) => ({ id: link.id, label: link.label, url: withProtocol(link.url) })),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message ?? '작가 프로필을 저장하지 못했습니다.');
      onSaved({
        ...payload.creator,
        links: links.map((link) => ({ id: link.id, label: link.label, url: withProtocol(link.url) })),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '작가 프로필을 저장하지 못했습니다.');
      setSaving(false);
    }
  };

  return (
    <div className="paper" style={{ marginTop: 23 }}>
      <h1>바이오 수정</h1>
      <VisuallyHiddenInput
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => selectCover(event.target.files?.[0])}
      />
      <Stack gap={1}>
        <Typography variant="subtitle2">커버 이미지</Typography>
        {coverImage ? (
          <Box
            component="img"
            src={coverImage}
            alt=""
            sx={{ width: '100%', aspectRatio: '1270 / 270', objectFit: 'cover', bgcolor: 'transparent' }}
          />
        ) : null}
        <Stack direction="row" gap={1}>
          <button type="button" className="button small action" onClick={() => fileRef.current?.click()}>
            이미지 선택
          </button>
          {coverImage ? (
            <button
              type="button"
              className="button small danger"
              onClick={() => {
                setCoverImage('');
                setCoverFile(null);
              }}
            >
              이미지 삭제
            </button>
          ) : null}
        </Stack>
        <Typography variant="body2">가로 1270, 세로 270의 png, jpg, webp 이미지를 등록할 수 있습니다.</Typography>
      </Stack>
      <Stack gap={1}>
        <Typography variant="subtitle2">소개</Typography>
        <TextField
          size="small"
          multiline
          minRows={4}
          value={introduction}
          onChange={(event) => setIntroduction(event.target.value)}
        />
      </Stack>
      <Stack gap={2}>
        <Typography variant="subtitle2">링크</Typography>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={links.map((l) => l._sortId)} strategy={verticalListSortingStrategy}>
            {links.map((link, index) => (
              <SortableLinkItem
                key={link._sortId}
                link={link}
                index={index}
                updateLink={updateLink}
                moveLinkToTop={moveLinkToTop}
                removeLink={(i) => setLinks((current) => current.filter((_, idx) => idx !== i))}
              />
            ))}
          </SortableContext>
        </DndContext>
        {links.length < 5 ? (
          <Stack direction="row">
            <button
              type="button"
              className="button small action"
              onClick={() => setLinks((current) => [...current, { label: '', url: '', _sortId: crypto.randomUUID() }])}
            >
              링크 추가
            </button>
          </Stack>
        ) : null}
      </Stack>
      {message ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{message}</span>
        </p>
      ) : null}
      <Stack direction="row" justifyContent="flex-end" gap={1}>
        <button type="button" className="button medium close" disabled={saving} onClick={onCancel}>
          취소
        </button>
        <button type="button" className="button medium submit" disabled={saving} onClick={save}>
          {saving ? '저장 중' : '저장'}
        </button>
      </Stack>
    </div>
  );
}

function openPost(url: string) {
  window.open(
    url,
    'creator-post',
    [
      'popup=yes',
      'width=960',
      'height=760',
      'left=80',
      'top=80',
      'resizable=yes',
      'scrollbars=yes',
      'toolbar=no',
      'menubar=no',
      'location=no',
      'status=no',
    ].join(','),
  );
}

export default function Opt({ handleName }: { handleName: string }) {
  const [data, setData] = useState<Response | null>(null);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const { themeMode, setThemeMode } = useThemeMode();

  const load = useCallback(
    async (nextPage: number) => {
      try {
        setMessage('');
        const response = await fetch(`/api/creator/${handleName}?page=${nextPage}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message ?? '작가 정보를 불러오지 못했습니다.');
        setData(payload);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '작가 정보를 불러오지 못했습니다.');
      }
    },
    [handleName],
  );

  useEffect(() => {
    void load(page);
  }, [load, page]);

  useEffect(() => {
    setThemeMode(getStoredThemeMode());
    setIsMounted(true);
  }, [setThemeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    applyThemeMode(themeMode);

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    function handleSystemThemeModeChange() {
      if (themeMode === 'system') {
        applyThemeMode('system');
      }
    }

    mediaQueryList.addEventListener('change', handleSystemThemeModeChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleSystemThemeModeChange);
    };
  }, [isMounted, themeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
  }, [isMounted]);

  if (message)
    return (
      <main className={styles['my-library']}>
        <div className={styles.container}>
          <div className={`content ${styles.content}`}>
            <div className="paper page-error">
              <NearbyErrorRoundedIcon />
              <p className="alert error">
                <span>{message}</span>
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  if (!data) return null;

  const totalPages = Math.ceil(data.total / 50);
  const creator = data.creator;
  return (
    <main className={styles['my-library']}>
      <div className={styles.back}>
        <Anchor href="/" className={styles.backlink}>
          <ArrowBackRoundedIcon />
          <span>라운지로 돌아가기</span>
        </Anchor>
      </div>
      <div className={`${styles['user-cover']} ${creator.coverImage ? styles['user-cover-image-container'] : ''}`}>
        {creator.coverImage ? (
          <div className={styles['user-cover-image']} style={{ backgroundImage: `url(${creator.coverImage})` }}>
            <div className={styles['dummy-before']} />
            <div className={styles['dummy-after']} />
          </div>
        ) : null}
      </div>
      <div className={styles.container}>
        <div className={`content ${styles.content}`}>
          <div className={styles['user-bio']}>
            {editing && data.isOwner ? (
              <ProfileForm
                profile={creator}
                onCancel={() => setEditing(false)}
                onSaved={(next) => {
                  setData((current) => (current ? { ...current, creator: { ...current.creator, ...next } } : current));
                  setEditing(false);
                }}
              />
            ) : (
              <>
                <Avatar
                  src={creator.profileImage || '/broken-image.jpg'}
                  alt={creator.activityName}
                  sx={{ width: 72, height: 72 }}
                />
                <div className={styles['user-bio-name']}>
                  <h1>{creator.activityName} 작가</h1>
                  <Typography variant="subtitle2">@{creator.handleName}</Typography>
                </div>
                {data.isOwner ? (
                  <div className={styles['user-bio-action']}>
                    <button type="button" className="button small action" onClick={() => setEditing(true)}>
                      수정
                    </button>
                  </div>
                ) : null}

                {creator.introduction ? (
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {creator.introduction}
                  </Typography>
                ) : null}
                {creator.links.length ? (
                  <ul className={styles['user-bio-links']}>
                    {creator.links.map((link) => (
                      <li key={link.id ?? link.url}>
                        <Anchor href={link.url}>{link.label}</Anchor>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            )}
          </div>
          <Stack gap={2}>
            {data.posts.length ? (
              <ul className={`paper ${styles['user-posts']}`}>
                {data.posts.map((post) => (
                  <li key={post.id}>
                    <button type="button" onClick={() => openPost(post.url)} className="paper">
                      <strong>{post.subject}</strong>
                      <span className={styles['post-label']}>
                        <span>{post.seriesLabel}</span> / <span>{post.siteLabel}</span>
                      </span>
                      <time>{post.publishedAt ? formatTimeAgo(post.publishedAt) : '-'}</time>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Typography variant="body2">작성한 글이 없습니다.</Typography>
            )}
            {totalPages > 1 ? (
              <Stack direction="row" justifyContent="center" gap={1}>
                <button
                  type="button"
                  className="button small action"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  이전
                </button>
                <Typography variant="body2">
                  {page} / {totalPages}
                </Typography>
                <button
                  type="button"
                  className="button small action"
                  disabled={page >= totalPages}
                  onClick={() => setPage((current) => current + 1)}
                >
                  다음
                </button>
              </Stack>
            ) : null}
          </Stack>
        </div>
      </div>
    </main>
  );
}
