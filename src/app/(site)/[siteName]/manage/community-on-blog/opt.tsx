'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FormControlLabel, Stack, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import FormErrorDialog from '@/components/FormErrorDialog';
import ScreenState from '@/components/service/ScreenState';
import Container from '../menu';
import styles from '@/app/manage.module.sass';

export type BlogCommunityManageResponse = {
  feature?: {
    isPersonalBlog: boolean;
    hasBeenOpenFor15Days: boolean;
    seriesPostCount: number;
    isEligible: boolean;
    hasStarted: boolean;
    isEnabled: boolean;
    isOwner: boolean;
    isIdentityVerified: boolean;
    isAtLeastAge14: boolean;
    canEnable: boolean;
  };
  deletedPosts?: Array<{ slug: string; content: string; createdAt: string; deletedAt: string | null }>;
  error?: string;
};

export default function Opt({
  initialData,
  initialError,
}: {
  initialData: BlogCommunityManageResponse | null;
  initialError: string;
}) {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);
  const feature = initialData?.feature;
  const [isEnabled, setIsEnabled] = useState(Boolean(feature?.isEnabled));
  const [hasStarted, setHasStarted] = useState(Boolean(feature?.hasStarted));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(initialError || initialData?.error || null);

  async function handleChange(nextEnabled: boolean) {
    if (isSaving || !feature?.canEnable) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/site/${siteName}/community-on-blog`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isEnabled: nextEnabled }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || '커뮤니티 사용 여부를 저장하지 못했습니다.');
      setIsEnabled(nextEnabled);
      setHasStarted(true);
      router.refresh();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '커뮤니티 사용 여부를 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  }

  if (initialError || initialData?.error) {
    return (
      <Container pageEnterance>
        <ScreenState kind="error">{initialError || initialData?.error}</ScreenState>
      </Container>
    );
  }
  if (!feature?.isOwner || !feature.isPersonalBlog) {
    return (
      <Container pageEnterance>
        <ScreenState>현재 사용할 수 없는 메뉴입니다.</ScreenState>
      </Container>
    );
  }

  const unavailableMessage =
    !feature.hasBeenOpenFor15Days && feature.seriesPostCount < 5
      ? '블로그 개설한지 15일이 되지 않았으며 연재글도 5개 미만입니다. 커뮤니티를 시작할 수 없습니다.'
      : !feature.hasBeenOpenFor15Days
        ? '블로그 개설한지 15일이 되지 않았으므로 커뮤니티를 시작할 수 없습니다.'
        : feature.seriesPostCount < 5
          ? '연재글이 5개 미만이므로 커뮤니티를 시작할 수 없습니다.'
          : !feature.isIdentityVerified
            ? '본인인증 후 사용할 수 있습니다.'
            : !feature.isAtLeastAge14
              ? '만 14세 미만은 커뮤니티를 생성할 수 없어요'
              : '';

  return (
    <Container pageTitle="커뮤니티 관리" pageBack={`/${siteName}/manage`} menu="community">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          {unavailableMessage ? (
            <ScreenState kind="error">{unavailableMessage}</ScreenState>
          ) : (
            <Stack sx={{ p: 2 }}>
              {hasStarted ? (
                <FormControlLabel
                  label="커뮤니티 메뉴 사용"
                  disabled={isSaving}
                  control={
                    <IOSSwitch
                      sx={{ m: 1 }}
                      checked={isEnabled}
                      disabled={isSaving}
                      onChange={(event) => void handleChange(event.currentTarget.checked)}
                    />
                  }
                />
              ) : (
                <button
                  type="button"
                  className="button medium submit"
                  disabled={isSaving}
                  onClick={() => void handleChange(true)}
                >
                  커뮤니티 시작하기
                </button>
              )}
            </Stack>
          )}
          {hasStarted ? (
            <section className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">삭제한 글</Typography>
              {initialData?.deletedPosts?.length ? (
                <ul>
                  {initialData.deletedPosts.map((post) => (
                    <li key={post.slug}>{post.content}</li>
                  ))}
                </ul>
              ) : (
                <Typography variant="body2">삭제한 글이 아직 없습니다.</Typography>
              )}
            </section>
          ) : null}
        </div>
      </div>
      <FormErrorDialog
        open={Boolean(error)}
        title="커뮤니티 관리"
        messages={error ? [error] : []}
        onClose={() => setError(null)}
      />
    </Container>
  );
}
