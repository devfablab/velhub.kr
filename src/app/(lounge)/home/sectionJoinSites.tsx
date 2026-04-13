'use client';

import { useEffect, useState } from 'react';
import { Alert, Stack } from '@mui/material';
import ComponentJoinSites from './componentJoinSites';

type JoinSiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  avatar: string | null;
  role: string;
};

type UserResponse = {
  isLoggedIn: boolean;
  role: string | null;
  joinSites: JoinSiteRow[];
};

export default function SectionJoinSites() {
  const [isLoading, setIsLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [joinSites, setJoinSites] = useState<JoinSiteRow[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadUser() {
      try {
        const response = await fetch('/api/user', {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as UserResponse | { error?: string };

        if (!response.ok) {
          throw new Error(
            'error' in result
              ? result.error || '사용자 정보를 불러오지 못했습니다.'
              : '사용자 정보를 불러오지 못했습니다.',
          );
        }

        setIsLoggedIn(Boolean(result.isLoggedIn));
        setJoinSites(Array.isArray(result.joinSites) ? result.joinSites : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '사용자 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('사용자 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadUser();
  }, []);

  if (isLoading) {
    return null;
  }

  if (errorMessage) {
    return <Alert severity="error">{errorMessage}</Alert>;
  }

  if (!isLoggedIn) {
    return null;
  }

  if (joinSites.length === 0) {
    return null;
  }

  const hasBlog = joinSites.some((site) => site.site_type === 'blog');
  const hasCommunity = joinSites.some((site) => site.site_type === 'community');

  if (!hasBlog && !hasCommunity) {
    return null;
  }

  return (
    <Stack spacing={3}>
      {hasBlog ? <ComponentJoinSites siteType="blog" joinSites={joinSites} /> : null}
      {hasCommunity ? <ComponentJoinSites siteType="community" joinSites={joinSites} /> : null}
    </Stack>
  );
}
