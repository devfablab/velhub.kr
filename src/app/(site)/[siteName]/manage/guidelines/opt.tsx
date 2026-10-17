'use client';

import { useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import { IconButton, Stack, TextField, Typography } from '@mui/material';
import PopupMessage from '@/components/PopupMessage';
import ScreenState from '@/components/service/ScreenState';
import Container from '../menu';
import styles from '@/app/manage.module.sass';

type SiteType = 'blog' | 'community';
type GuidelineType = 'common' | 'blog-community' | 'blog-post' | 'board-common' | 'board-specific';

type GuidelineItem = {
  id: string;
  content: string;
  sortOrder: number;
};

type Guideline = {
  id: string;
  type: GuidelineType;
  boardId: string | null;
  items: GuidelineItem[];
};

type Board = {
  id: string;
  key: string;
  label: string;
};

type Permission = {
  canView: boolean;
  canEdit: boolean;
};

type GuidelinesPermissions = {
  common: Permission;
  blogCommunity?: Permission;
  blogPost?: Permission;
  boardCommon?: Permission;
  boardSpecific?: Array<Permission & { boardId: string }>;
};

export type GuidelinesResponse = {
  siteType?: SiteType;
  boards?: Board[];
  guidelines?: Guideline[];
  permissions?: GuidelinesPermissions;
  error?: string;
};

type EditableItem = {
  key: string;
  content: string;
};

const MAX_GUIDELINE_ITEM_COUNT = 9;

function getGuideline(guidelines: Guideline[], type: GuidelineType, boardId?: string | null) {
  return guidelines.find((guideline) => guideline.type === type && guideline.boardId === (boardId ?? null)) ?? null;
}

function toEditableItems(items: GuidelineItem[]) {
  return items.map((item) => ({ key: item.id, content: item.content }));
}

function GuidelineSection({
  siteName,
  title,
  type,
  boardId = null,
  guideline,
  permission,
}: {
  siteName: string;
  title: string;
  type: GuidelineType;
  boardId?: string | null;
  guideline: Guideline | null;
  permission: Permission;
}) {
  const nextItemId = useRef(0);
  const initialItems = guideline?.items ?? [];
  const [items, setItems] = useState(() => toEditableItems(initialItems));
  const [savedItems, setSavedItems] = useState(() => initialItems.map((item) => item.content));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const normalizedItems = items.map((item) => item.content.trim()).filter(Boolean);
  const hasChanges = JSON.stringify(normalizedItems) !== JSON.stringify(savedItems);
  const canSave = permission.canEdit && hasChanges && !isSubmitting;

  function updateItem(index: number, content: string) {
    setItems((previous) => previous.map((item, itemIndex) => (itemIndex === index ? { ...item, content } : item)));
    setError('');
  }

  function removeItem(index: number) {
    setItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    setError('');
  }

  function addItem() {
    if (items.length >= MAX_GUIDELINE_ITEM_COUNT) {
      return;
    }

    nextItemId.current += 1;
    setItems((previous) => [...previous, { key: `new-${nextItemId.current}`, content: '' }]);
  }

  async function save() {
    if (!canSave) return;

    try {
      setIsSubmitting(true);
      setError('');
      const response = await fetch('/api/manage/guidelines', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName, type, boardId, items: normalizedItems }),
      });
      const result = (await response.json()) as { guideline?: Guideline; error?: string };

      if (!response.ok || !result.guideline) {
        throw new Error(result.error ?? '가이드라인을 저장하지 못했습니다.');
      }

      const nextItems = toEditableItems(result.guideline.items);
      setItems(nextItems);
      setSavedItems(nextItems.map((item) => item.content));
      setSuccessMessage('정상적으로 가이드라인이 저장되었습니다.');
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '가이드라인을 저장하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <section className="paper">
        <Typography variant="subtitle2">{title}</Typography>

        {permission.canEdit ? (
          <Stack gap={1}>
            {items.map((item, index) => (
              <Stack key={item.key} direction="row" alignItems="center" gap={1}>
                <Stack
                  justifyContent="center"
                  alignItems="center"
                  sx={{
                    borderRadius: '100%',
                    borderStyle: 'solid',
                    borderWidth: '2px',
                    width: '27px',
                    minWidth: '27px',
                    height: '27px',
                    fontSize: '12px',
                  }}
                >
                  {index + 1}
                </Stack>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="가이드라인"
                  value={item.content}
                  onChange={(event) => updateItem(index, event.target.value)}
                />
                <IconButton aria-label="가이드라인 삭제" onClick={() => removeItem(index)}>
                  <RemoveCircleOutlineRoundedIcon />
                </IconButton>
              </Stack>
            ))}

            {error ? (
              <p className="alert error">
                <ErrorOutlineRoundedIcon />
                <span>{error}</span>
              </p>
            ) : null}

            <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
              <button
                type="button"
                className="button small action"
                onClick={addItem}
                disabled={items.length >= MAX_GUIDELINE_ITEM_COUNT}
              >
                <AddRoundedIcon />
                가이드라인 추가
              </button>
              <button type="button" className="button small submit" disabled={!canSave} onClick={() => void save()}>
                저장
              </button>
            </Stack>
          </Stack>
        ) : guideline?.items.length ? (
          <ol style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {guideline.items.map((item, index) => (
              <li key={item.id}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Stack
                    justifyContent="center"
                    alignItems="center"
                    sx={{
                      borderRadius: '100%',
                      borderStyle: 'solid',
                      borderWidth: '2px',
                      width: '27px',
                      minWidth: '27px',
                      height: '27px',
                      fontSize: '12px',
                    }}
                  >
                    {index + 1}
                  </Stack>
                  <Typography variant="body2">{item.content}</Typography>
                </Stack>
              </li>
            ))}
          </ol>
        ) : (
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>등록된 가이드라인이 없습니다.</span>
          </p>
        )}
      </section>
      <PopupMessage open={Boolean(successMessage)} message={successMessage} onClose={() => setSuccessMessage('')} />
    </>
  );
}

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: GuidelinesResponse | null;
  initialError: string;
}) {
  const params = useParams();
  const siteName = String(params.siteName ?? '');
  const siteType = initialData?.siteType;
  const guidelines = initialData?.guidelines ?? [];
  const boards = initialData?.boards ?? [];
  const permissions = initialData?.permissions;

  if (initialError || !siteType || !permissions) {
    return <ScreenState kind="error">{initialError || '가이드라인을 불러오지 못했습니다.'}</ScreenState>;
  }

  return (
    <Container pageTitle="가이드라인 관리" pageBack={`/${siteName}/manage`}>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {siteType === 'blog' ? (
            <>
              <GuidelineSection
                siteName={siteName}
                title="공통 가이드라인"
                type="common"
                guideline={getGuideline(guidelines, 'common')}
                permission={permissions.common}
              />
              <GuidelineSection
                siteName={siteName}
                title="블로그 커뮤니티 가이드라인"
                type="blog-community"
                guideline={getGuideline(guidelines, 'blog-community')}
                permission={permissions.blogCommunity ?? { canView: false, canEdit: false }}
              />
              <GuidelineSection
                siteName={siteName}
                title="블로그 댓글 가이드라인"
                type="blog-post"
                guideline={getGuideline(guidelines, 'blog-post')}
                permission={permissions.blogPost ?? { canView: false, canEdit: false }}
              />
            </>
          ) : (
            <>
              <GuidelineSection
                siteName={siteName}
                title="공통 가이드라인"
                type="common"
                guideline={getGuideline(guidelines, 'common')}
                permission={permissions.common}
              />
              <GuidelineSection
                siteName={siteName}
                title="게시판 공통 가이드라인"
                type="board-common"
                guideline={getGuideline(guidelines, 'board-common')}
                permission={permissions.boardCommon ?? { canView: false, canEdit: false }}
              />
              <section className="paper">
                <Typography variant="subtitle2">게시판별 가이드라인</Typography>
                <Stack gap={2}>
                  {boards.map((board) => (
                    <GuidelineSection
                      key={board.id}
                      siteName={siteName}
                      title={board.label}
                      type="board-specific"
                      boardId={board.id}
                      guideline={getGuideline(guidelines, 'board-specific', board.id)}
                      permission={
                        permissions.boardSpecific?.find((item) => item.boardId === board.id) ?? {
                          canView: false,
                          canEdit: false,
                        }
                      }
                    />
                  ))}
                </Stack>
              </section>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
