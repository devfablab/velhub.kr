'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Alert, Avatar, Box, Grid, Paper, Stack, Typography } from '@mui/material';
import { formatDateSimple, normalizeText } from '@/lib/utils';

type StaffResponse = {
  site?: {
    avatar: string | null;
    name: string | null;
    createdAt: string | null;
    ownerName: string | null;
  };
  stats?: {
    memberCount: number;
    postCount: number;
  };
  error?: string;
};

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [siteAvatar, setSiteAvatar] = useState<string | null>(null);
  const [siteNameText, setSiteNameText] = useState('');
  const [siteCreatedAt, setSiteCreatedAt] = useState<string | null>(null);
  const [ownerName, setOwnerName] = useState('');
  const [memberCount, setMemberCount] = useState(0);
  const [postCount, setPostCount] = useState(0);

  useEffect(() => {
    async function loadData() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/staff?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as StaffResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '정보를 불러오지 못했습니다.');
        }

        setSiteAvatar(result.site?.avatar ?? null);
        setSiteNameText(result.site?.name ?? '');
        setSiteCreatedAt(result.site?.createdAt ?? null);
        setOwnerName(result.site?.ownerName ?? '');
        setMemberCount(result.stats?.memberCount ?? 0);
        setPostCount(result.stats?.postCount ?? 0);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadData();
  }, [siteName]);

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={2}>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={siteAvatar ?? undefined} alt={siteNameText || '사이트'} sx={{ width: 72, height: 72 }} />

              <Box>
                <Typography variant="h6">{siteNameText}</Typography>
                <Typography variant="body2">SINCE {formatDateSimple(siteCreatedAt)}</Typography>
                <Typography variant="body2">w/ {ownerName}</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>

        <Grid container rowSpacing={1} size={{ xs: 12 }}>
          <Grid size={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="body1">전체 회원수: {memberCount}</Typography>
            </Paper>
          </Grid>
          <Grid size={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="body1">전체 글수: {postCount}</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Grid>
    </Stack>
  );
}
