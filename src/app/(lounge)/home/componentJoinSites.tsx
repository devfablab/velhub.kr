'use client';

import { useMemo } from 'react';
import Link from '@mui/material/Link';
import { Chip, Paper, Stack, Typography } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';

type SiteType = 'blog' | 'community';

type JoinSiteRow = {
  id: string;
  site_key: string;
  site_label: string;
  site_type: string;
  avatar: string | null;
  role: string;
};

type Props = {
  siteType: SiteType;
  joinSites: JoinSiteRow[];
};

function getSectionTitle(siteType: SiteType) {
  return siteType === 'blog' ? '블로그' : '커뮤니티';
}

function getRoleLabel(role: string) {
  if (role === 'owner') {
    return '운영자';
  }

  if (role === 'manager') {
    return '매니저';
  }

  if (role === 'member') {
    return '멤버';
  }

  return role;
}

export default function ComponentJoinSites({ siteType, joinSites }: Props) {
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  function getAvatarUrl(value: string | null) {
    const avatarPath = normalizeText(value);

    if (!avatarPath) {
      return null;
    }

    const publicUrlResult = supabase.storage.from('avatar').getPublicUrl(avatarPath);

    return publicUrlResult.data.publicUrl || null;
  }

  const filteredSites = joinSites.filter((site) => site.site_type === siteType);

  if (filteredSites.length === 0) {
    return null;
  }

  return (
    <Stack spacing={1.5}>
      <Typography variant="h6">{getSectionTitle(siteType)}</Typography>

      <Stack spacing={1.5}>
        {filteredSites.map((site) => (
          <Paper key={site.id} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <AppIconAvatar src={getAvatarUrl(site.avatar) || null} alt={site.site_label || null} size={58} />

              <Stack sx={{ minWidth: 0, flex: 1 }}>
                <Link href={`/${site.site_key}`} underline="hover">
                  {site.site_label}
                </Link>
              </Stack>

              <Chip label={getRoleLabel(site.role)} size="small" />
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  );
}
