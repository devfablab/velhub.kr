'use client';

import { useEffect, useState } from 'react';
import { FormControl, FormControlLabel, Radio, RadioGroup, Snackbar, Stack, Typography } from '@mui/material';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/hub.module.sass';

type Site = { id: string; siteKey: string; siteLabel: string; siteType: string };
type Post = { id: string; subject: string; slug: number | null; siteKey: string; siteLabel: string };
type SelectorResponse = {
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
      <Typography variant="subtitle2">{description}</Typography>
      {options.length ? (
        <FormControl>
          <RadioGroup value={value} onChange={(event) => onChange(event.target.value)}>
            {options.map((option) => (
              <FormControlLabel key={option.id} value={option.id} control={<Radio />} label={option.label} />
            ))}
          </RadioGroup>
        </FormControl>
      ) : (
        <ScreenState kind="warning">선택할 수 있는 대상이 없습니다.</ScreenState>
      )}
    </section>
  );
}

export default function MembershipSelectors() {
  const [data, setData] = useState<SelectorResponse | null>(null);
  const [ownerSiteId, setOwnerSiteId] = useState('');
  const [creatorSiteId, setCreatorSiteId] = useState('');
  const [creatorOwnPostId, setCreatorOwnPostId] = useState('');
  const [creatorOtherPostId, setCreatorOtherPostId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const loadData = () => {
    setIsLoading(true);
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
        setSnackbarMessage(message);
      })
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

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
      setSnackbarMessage(body.message);
    } catch (error) {
      setSnackbarMessage(error instanceof Error ? error.message : '라운지 노출 대상을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading)
    return (
      <section className={`paper ${styles.paper}`}>
        <h2>라운지 노출</h2>
        <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
          <LoadingIndicator />
        </Stack>
      </section>
    );

  if (fetchError || !data) {
    return (
      <section className={`paper ${styles.paper}`}>
        <h2>라운지 노출</h2>
        <ScreenState kind="error">
          {fetchError || '데이터를 불러오지 못했습니다.'} 일시적인 문제일 수 있으니 잠시 후 다시 시도해 주세요.
        </ScreenState>
        <button type="button" className="button small warning" onClick={loadData}>
          다시 시도
        </button>
      </section>
    );
  }

  if (!data.features.ownerLounge && !data.features.creatorLounge) {
    return (
      <section className={`paper ${styles.paper}`}>
        <ScreenState kind="warning">
          라운지에 사이트나 연재글을 노출하려면 먼저 오너 멤버십 또는 크리에이터 멤버십 가입이 필요합니다.
        </ScreenState>
        <Stack direction="row">
          <Anchor href="/memberships/creator" className="button small action">
            자세히 알아보기
          </Anchor>
        </Stack>
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
  const canSave = hasChanges;

  return (
    <>
      <Stack gap={4}>
        {data.features.ownerLounge ? (
          <SelectorGroup
            title="오너 라운지 노출"
            description="운영 중인 본인 사이트 중 라운지에 노출할 사이트 1개를 선택하세요."
            value={ownerSiteId}
            options={siteOptions}
            onChange={setOwnerSiteId}
          />
        ) : null}
        {data.features.creatorLounge ? (
          <section className={`paper ${styles.paper}`}>
            <h2>크리에이터 라운지 노출</h2>
            <SelectorGroup
              title="본인 사이트"
              description="운영 중인 본인 사이트 중 라운지에 노출할 사이트 1개를 선택하세요."
              value={creatorSiteId}
              options={siteOptions}
              onChange={setCreatorSiteId}
            />
            <SelectorGroup
              title="본인 사이트 연재글"
              description="본인 사이트에 작성한 연재글 1개를 선택하세요."
              value={creatorOwnPostId}
              options={postOptions(data.ownPosts)}
              onChange={setCreatorOwnPostId}
            />
            <SelectorGroup
              title="다른 사이트 연재글"
              description="다른 사이트에 작성한 연재글 1개를 선택하세요."
              value={creatorOtherPostId}
              options={postOptions(data.otherPosts)}
              onChange={setCreatorOtherPostId}
            />
          </section>
        ) : null}
        {data.features.ownerLounge || data.features.creatorLounge ? (
          <Stack direction="row" justifyContent="flex-end">
            <button
              type="button"
              className="button medium submit"
              disabled={!canSave || isSaving}
              onClick={handleSubmit}
            >
              저장
            </button>
          </Stack>
        ) : (
          <ScreenState kind="warning">라운지 노출 기능을 이용 중인 멤버십이 없습니다.</ScreenState>
        )}
      </Stack>
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2700}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </>
  );
}
