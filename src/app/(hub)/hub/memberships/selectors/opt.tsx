'use client';

import { useEffect, useState } from 'react';
import { FormControl, FormControlLabel, Radio, RadioGroup, Stack, Typography, Snackbar } from '@mui/material';
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
    <Stack gap={1}>
      <Typography variant="subtitle2">{title}</Typography>
      <Typography variant="body2">{description}</Typography>
      {options.length ? (
        <FormControl>
          <RadioGroup value={value} onChange={(event) => onChange(event.target.value)}>
            {options.map((option) => (
              <FormControlLabel key={option.id} value={option.id} control={<Radio />} label={option.label} />
            ))}
          </RadioGroup>
        </FormControl>
      ) : (
        <Typography variant="body2">선택할 수 있는 대상이 없습니다.</Typography>
      )}
    </Stack>
  );
}

export default function MembershipSelectors() {
  const [data, setData] = useState<SelectorResponse | null>(null);
  const [ownerSiteId, setOwnerSiteId] = useState('');
  const [creatorSiteId, setCreatorSiteId] = useState('');
  const [creatorOwnPostId, setCreatorOwnPostId] = useState('');
  const [creatorOtherPostId, setCreatorOtherPostId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
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
      .catch((error) =>
        setSnackbarMessage(error instanceof Error ? error.message : '라운지 노출 대상을 불러오지 못했습니다.'),
      );
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

  if (!data) return <Typography variant="body2">라운지 노출 대상을 불러오는 중입니다.</Typography>;
  const siteOptions = data.sites.map((site) => ({ id: site.id, label: `${site.siteLabel} (${site.siteKey})` }));
  const postOptions = (posts: Post[]) =>
    posts.map((post) => ({ id: post.id, label: `${post.siteLabel} · ${post.subject}` }));
  const hasOwnerSelection = !data.features.ownerLounge || Boolean(ownerSiteId);
  const hasCreatorSelections =
    !data.features.creatorLounge || Boolean(creatorSiteId && creatorOwnPostId && creatorOtherPostId);
  const canSave =
    (data.features.ownerLounge || data.features.creatorLounge) && hasOwnerSelection && hasCreatorSelections;

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
          <Stack gap={3}>
            <Typography variant="h6">크리에이터 라운지 노출</Typography>
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
          </Stack>
        ) : null}
        {data.features.ownerLounge || data.features.creatorLounge ? (
          <div>
            <button
              type="button"
              className="button medium submit"
              disabled={!canSave || isSaving}
              onClick={handleSubmit}
            >
              저장
            </button>
          </div>
        ) : (
          <Typography variant="body2">라운지 노출 기능을 이용 중인 멤버십이 없습니다.</Typography>
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
