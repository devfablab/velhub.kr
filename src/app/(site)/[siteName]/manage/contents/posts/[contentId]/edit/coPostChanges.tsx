'use client';

import { useEffect, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { format } from 'date-fns';
import { type DiffSegment, getTextDiff } from '@/lib/editor/textDiff';
import styles from '@/app/manage.module.sass';

type Snapshot = { subject: string; summary: string; contentMarkdown: string };

type ChangesResponse = {
  hasChanges?: boolean;
  baseline?: Snapshot;
  current?: Snapshot;
  baselineAt?: string | null;
  error?: string;
};

const FIELDS: { key: keyof Snapshot; label: string }[] = [
  { key: 'subject', label: '제목' },
  { key: 'summary', label: '부제목' },
  { key: 'contentMarkdown', label: '내용' },
];

function DiffText({ segments }: { segments: DiffSegment[] }) {
  return (
    <div className={styles['co-post-diff']}>
      {segments.map((segment, index) =>
        segment.type === 'added' ? (
          <ins key={index}>{segment.text}</ins>
        ) : segment.type === 'removed' ? (
          <del key={index}>{segment.text}</del>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </div>
  );
}

export default function CoPostChanges({ coPostId, reloadKey }: { coPostId: string; reloadKey: number }) {
  const [changes, setChanges] = useState<ChangesResponse | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let isActive = true;

    fetch(`/api/co-posts/${coPostId}/changes`, { credentials: 'include' })
      .then((response) => (response.ok ? (response.json() as Promise<ChangesResponse>) : null))
      .then((result) => {
        if (!isActive) return;

        setChanges(result);

        if (!result?.hasChanges) setIsOpen(false);
      })
      .catch(() => undefined);

    return () => {
      isActive = false;
    };
  }, [coPostId, reloadKey]);

  if (!changes?.hasChanges || !changes.baseline || !changes.current) {
    return null;
  }

  const baseline = changes.baseline;
  const current = changes.current;
  const changedFields = FIELDS.filter((field) => baseline[field.key] !== current[field.key]);

  return (
    <Stack gap={1}>
      <Stack direction="row" justifyContent="flex-end">
        <button type="button" className="button small action" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? '변경점 닫기' : '변경점 보기'}
        </button>
      </Stack>

      {isOpen ? (
        <Stack gap={2} className="paper">
          <Typography variant="body2">
            {changes.baselineAt
              ? `내가 마지막으로 작업한 ${format(new Date(changes.baselineAt), 'M월 d일 HH:mm')} 이후 바뀐 내용입니다.`
              : '내가 마지막으로 작업한 이후 바뀐 내용입니다.'}
          </Typography>
          {changedFields.length === 0 ? (
            <Typography variant="body2">상대가 저장했지만 바뀐 내용은 없습니다.</Typography>
          ) : (
            changedFields.map((field) => (
              <Stack key={field.key} gap={0.5}>
                <Typography variant="subtitle2">{field.label}</Typography>
                <DiffText segments={getTextDiff(baseline[field.key], current[field.key])} />
              </Stack>
            ))
          )}
        </Stack>
      ) : null}
    </Stack>
  );
}
