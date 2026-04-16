'use client';

import { useMemo } from 'react';
import Link from '@mui/material/Link';
import { Avatar, Chip, Paper, Stack, Typography } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

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

const SUPABASE_AVATAR_PREFIX = 'supabase:';
const AVATAR_BUCKET = 'avatar';

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

function isSupabaseAvatarValue(value: string) {
  return value.startsWith(SUPABASE_AVATAR_PREFIX);
}

function getSupabaseAvatarPath(value: string) {
  return value.replace(SUPABASE_AVATAR_PREFIX, '').trim();
}

export default function ComponentJoinSites({ siteType, joinSites }: Props) {
  const supabase = useMemo(() => getSupabaseBrowser(), []);

  function getAvatarUrl(value: string | null) {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return '/broken-image.jpg';
    }

    if (!isSupabaseAvatarValue(normalizedValue)) {
      return normalizedValue;
    }

    const avatarPath = getSupabaseAvatarPath(normalizedValue);

    if (!avatarPath) {
      return '/broken-image.jpg';
    }

    const publicUrlResult = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(avatarPath);

    return publicUrlResult.data.publicUrl || '/broken-image.jpg';
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
          <Paper key={site.id} elevation={0} sx={{ p: 2 }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar src={getAvatarUrl(site.avatar) ?? '/broken-image.jpg'} alt={site.site_label} />

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
