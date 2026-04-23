'use client';

import { useEffect, useState } from 'react';
import Link from '@mui/material/Link';
import { Alert, Button, Paper, Stack, Typography } from '@mui/material';
import { formatDateTimeFull } from '@/lib/utils';

type PendingInviteRow = {
  id: string;
  siteName: string;
  siteLabel: string;
  siteType: string;
  siteTypeLabel: string;
  token: string;
  expiresAt: string | null;
  href: string;
};

type PendingInviteResponse = {
  invites?: PendingInviteRow[];
  error?: string;
};

export default function SectionPendingInvites() {
  const [invites, setInvites] = useState<PendingInviteRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadPendingInvites() {
      try {
        setErrorMessage('');

        const response = await fetch('/api/home/pending-invites', {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as PendingInviteResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '초대 정보를 불러오지 못했습니다.');
        }

        setInvites(Array.isArray(result.invites) ? result.invites : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '초대 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('초대 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPendingInvites();
  }, []);

  if (isLoading) {
    return null;
  }

  if (errorMessage) {
    return (
      <Alert severity="error" variant="filled">
        {errorMessage}
      </Alert>
    );
  }

  if (invites.length === 0) {
    return null;
  }

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6" component="h2">
          초대장이 날라왔어요 😎
        </Typography>

        {invites.map((invite) => (
          <Paper key={invite.id} variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" justifyContent="space-between">
                <Typography variant="subtitle2">
                  {invite.siteLabel} ({invite.siteTypeLabel})
                </Typography>
                <Button
                  component={Link}
                  href={invite.href}
                  underline="none"
                  variant="outlined"
                  color="inherit"
                  size="small"
                >
                  가입하러 가기
                </Button>
              </Stack>

              {invite.expiresAt ? (
                <Typography variant="body2">
                  {formatDateTimeFull(invite.expiresAt)}까지 초대에 응하실 수 있어요!
                </Typography>
              ) : null}
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Paper>
  );
}
