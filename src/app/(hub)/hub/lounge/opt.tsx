'use client';

import { useState } from 'react';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { FormControl, FormControlLabel, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import PopupMessage from '@/components/PopupMessage';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/hub.module.sass';

type Site = { id: string; siteKey: string; siteLabel: string; siteType: string };
type Post = { id: string; subject: string; slug: number | null; siteKey: string; siteLabel: string };
export type SelectorResponse = {
  features: { ownerLounge: boolean; creatorLounge: boolean };
  sites: Site[];
  ownPosts: Post[];
  otherPosts: Post[];
  selections: Partial<Record<'owner_site' | 'creator_site' | 'creator_own_post' | 'creator_other_post', string>>;
};

function SelectorGroup({
  title,
  description,
  value,
  options,
  onChange,
}: {
  title: string;
  description: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <section className={`paper ${styles.paper}`}>
      <h2>{title}</h2>
      {options.length ? (
        <>
          <Typography variant="subtitle2">{description}</Typography>
          <FormControl>
            <RadioGroup value={value} onChange={(event) => onChange(event.target.value)}>
              {options.map((option) => (
                <FormControlLabel key={option.id} value={option.id} control={<Radio />} label={option.label} />
              ))}
            </RadioGroup>
          </FormControl>
        </>
      ) : (
        <p className="alert warning">
          <WarningAmberRoundedIcon />
          <span>선택할 수 있는 대상이 없습니다.</span>
        </p>
      )}
    </section>
  );
}

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: SelectorResponse | null;
  initialError: string;
}) {
  const [data, setData] = useState<SelectorResponse | null>(initialData);
  const [ownerSiteId, setOwnerSiteId] = useState('');
  const [creatorSiteId, setCreatorSiteId] = useState('');
  const [creatorOwnPostId, setCreatorOwnPostId] = useState('');
  const [creatorOtherPostId, setCreatorOtherPostId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [fetchError, setFetchError] = useState(initialError);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarKind, setSnackbarKind] = useState<'info' | 'error'>('info');

  const loadData = () => {
    setFetchError('');
    fetch('/api/memberships/selectors')
      .then(async (response) => ({ response, body: await response.json() }))
      .then(({ response, body }) => {
        if (!response.ok) throw new Error(body.message ?? '라운지 노출 대상을 불러오지 못했습니다.');
        setData(body);
        setOwnerSiteId(body.selections.owner_site ?? '');
        setCreatorSiteId(body.selections.creator_site ?? '');
        setCreatorOwnPostId(body.selections.creator_own_post ?? '');
        setCreatorOtherPostId(body.selections.creator_other_post ?? '');
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '라운지 노출 대상을 불러오지 못했습니다.';
        setFetchError(message);
        setSnackbarKind('error');
        setSnackbarMessage(message);
      });
  };

  async function handleSubmit() {
    setIsSaving(true);
    try {
      const response = await fetch('/api/memberships/selectors', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerSiteId, creatorSiteId, creatorOwnPostId, creatorOtherPostId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? '라운지 노출 대상을 저장하지 못했습니다.');
      setSnackbarKind('info');
      setSnackbarMessage(body.message);
    } catch (error) {
      setSnackbarKind('error');
      setSnackbarMessage(error instanceof Error ? error.message : '라운지 노출 대상을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  if (fetchError || !data) {
    return (
      <section className={`paper ${styles.paper}`}>
        <h2>라운지 노출</h2>
        <ScreenState
          kind="error"
          action={
            <button type="button" className="button medium action" onClick={loadData}>
              다시 시도
            </button>
          }
        >
          {fetchError || '데이터를 불러오지 못했습니다.'} 일시적인 문제일 수 있으니 잠시 후 다시 시도해 주세요.
        </ScreenState>
      </section>
    );
  }

  if (!data.features.ownerLounge && !data.features.creatorLounge) {
    return (
      <section className={`paper ${styles.paper}`}>
        <ScreenState
          kind="warning"
          action={
            <Anchor href="/memberships/creator" className="button medium action">
              자세히 알아보기
            </Anchor>
          }
        >
          라운지에 사이트나 연재글을 노출하려면 먼저 오너 멤버십 또는 크리에이터 멤버십 가입이 필요합니다.
        </ScreenState>
      </section>
    );
  }

  const siteOptions = data.sites.map((site) => ({ id: site.id, label: `${site.siteLabel} (${site.siteKey})` }));
  const postOptions = (posts: Post[]) =>
    posts.map((post) => ({ id: post.id, label: `${post.siteLabel}  ·  ${post.subject}` }));
  const hasChanges =
    ownerSiteId !== (data.selections.owner_site ?? '') ||
    creatorSiteId !== (data.selections.creator_site ?? '') ||
    creatorOwnPostId !== (data.selections.creator_own_post ?? '') ||
    creatorOtherPostId !== (data.selections.creator_other_post ?? '');

  return (
    <Stack
      component="form"
      gap={4}
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <section className={`paper ${styles.paper}`}>
        {data.features.ownerLounge ? (
          <>
            <h2>오너 라운지 노출</h2>
            <SelectorGroup
              title="노출할 내 사이트 선택"
              description="운영 중인 본인 사이트 중 라운지에 노출할 사이트 1개를 선택하세요."
              value={ownerSiteId}
              options={siteOptions}
              onChange={setOwnerSiteId}
            />
          </>
        ) : null}
        {data.features.creatorLounge ? (
          <>
            <h2>크리에이터 라운지 노출</h2>
            <SelectorGroup
              title="노출할 내 사이트 선택"
              description="운영 중인 내 사이트 중 라운지에 노출할 사이트 1개를 선택하세요."
              value={creatorSiteId}
              options={siteOptions}
              onChange={setCreatorSiteId}
            />
            <SelectorGroup
              title="노출할 내 사이트의 연재글 선택"
              description="내 사이트에서 작성한 연재글 1개를 선택하세요."
              value={creatorOwnPostId}
              options={postOptions(data.ownPosts)}
              onChange={setCreatorOwnPostId}
            />
            <SelectorGroup
              title="다른 사이트의 연재글 선택"
              description="다른 사이트에 작성한 연재글 1개를 선택하세요."
              value={creatorOtherPostId}
              options={postOptions(data.otherPosts)}
              onChange={setCreatorOtherPostId}
            />
          </>
        ) : null}
        {data.features.ownerLounge || data.features.creatorLounge ? (
          <Stack direction="row" justifyContent="flex-end">
            <button type="submit" className="button medium submit" disabled={!hasChanges || isSaving}>
              {isSaving ? <LoadingIndicator size={20} /> : null}
              저장
            </button>
          </Stack>
        ) : (
          <ScreenState kind="warning">라운지 노출 기능을 이용 중인 멤버십이 없습니다.</ScreenState>
        )}
      </section>
      <PopupMessage
        open={Boolean(snackbarMessage)}
        message={snackbarMessage}
        onClose={() => setSnackbarMessage('')}
        kind={snackbarKind}
      />
    </Stack>
  );
}
