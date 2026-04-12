/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import Anchor from '@/components/Anchor';

type UserProfile = {
  name: string;
  email: string;
  avatarUrl: string | null;
};

function getDisplayName(userMetadata: Record<string, unknown> | undefined, email: string | undefined) {
  const name =
    typeof userMetadata?.name === 'string'
      ? userMetadata.name
      : typeof userMetadata?.full_name === 'string'
        ? userMetadata.full_name
        : typeof userMetadata?.user_name === 'string'
          ? userMetadata.user_name
          : typeof userMetadata?.preferred_username === 'string'
            ? userMetadata.preferred_username
            : '';

  if (name.trim()) {
    return name.trim();
  }

  if (email) {
    return email.split('@')[0] ?? '사용자';
  }

  return '';
}

function getAvatarUrl(userMetadata: Record<string, unknown> | undefined) {
  const avatarUrl =
    typeof userMetadata?.avatar_url === 'string'
      ? userMetadata.avatar_url
      : typeof userMetadata?.picture === 'string'
        ? userMetadata.picture
        : typeof userMetadata?.avatar === 'string'
          ? userMetadata.avatar
          : null;

  return avatarUrl;
}

export default function HeaderSettings() {
  const { themeMode, setThemeMode } = useThemeMode();

  const [isMounted, setIsMounted] = useState(false);
  const [themeModeAnchorElement, setThemeModeAnchorElement] = useState<null | HTMLElement>(null);
  const [profileAnchorElement, setProfileAnchorElement] = useState<null | HTMLElement>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: '',
    email: '',
    avatarUrl: null,
  });

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function loadUserProfile() {
      const userResult = await supabase.auth.getUser();

      if (userResult.error || !userResult.data.user) {
        return;
      }

      const authUser = userResult.data.user;
      const userMetadata = authUser.user_metadata as Record<string, unknown> | undefined;

      setUserProfile({
        name: getDisplayName(userMetadata, authUser.email),
        email: authUser.email ?? '',
        avatarUrl: getAvatarUrl(userMetadata),
      });
    }

    void loadUserProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        return;
      }

      const authUser = session.user;
      const userMetadata = authUser.user_metadata as Record<string, unknown> | undefined;

      setUserProfile({
        name: getDisplayName(userMetadata, authUser.email),
        email: authUser.email ?? '',
        avatarUrl: getAvatarUrl(userMetadata),
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function handleOpenThemeModeMenu(event: React.MouseEvent<HTMLElement>) {
    setThemeModeAnchorElement(event.currentTarget);
  }

  function handleCloseThemeModeMenu() {
    setThemeModeAnchorElement(null);
  }

  function handleSelectThemeMode(nextThemeMode: ThemeMode) {
    setThemeMode(nextThemeMode);
    handleCloseThemeModeMenu();
  }

  function handleOpenProfileMenu(event: React.MouseEvent<HTMLElement>) {
    setProfileAnchorElement(event.currentTarget);
  }

  function handleCloseProfileMenu() {
    setProfileAnchorElement(null);
  }

  async function handleLogout() {
    handleCloseProfileMenu();

    const signOutResult = await supabase.auth.signOut({
      scope: 'local',
    });

    if (signOutResult.error) {
      return;
    }

    window.location.href = '/';
  }

  function renderThemeModeIcon() {
    if (themeMode === 'light') {
      return <LightModeIcon />;
    }

    if (themeMode === 'dark') {
      return <DarkModeIcon />;
    }

    return <BrightnessAutoIcon />;
  }

  if (!isMounted) {
    return null;
  }

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar>
        <Box sx={{ flexGrow: 1 }}>
          <Anchor href="/">데브허브</Anchor>
        </Box>

        <IconButton color="inherit" onClick={handleOpenThemeModeMenu}>
          {renderThemeModeIcon()}
        </IconButton>

        <Menu
          anchorEl={themeModeAnchorElement}
          open={Boolean(themeModeAnchorElement)}
          onClose={handleCloseThemeModeMenu}
        >
          <MenuItem onClick={() => handleSelectThemeMode('light')}>
            <ListItemIcon>
              <LightModeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>라이트모드</ListItemText>
          </MenuItem>

          <MenuItem onClick={() => handleSelectThemeMode('system')}>
            <ListItemIcon>
              <BrightnessAutoIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>시스템</ListItemText>
          </MenuItem>

          <MenuItem onClick={() => handleSelectThemeMode('dark')}>
            <ListItemIcon>
              <DarkModeIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>다크모드</ListItemText>
          </MenuItem>
        </Menu>

        <IconButton onClick={handleOpenProfileMenu}>
          {userProfile.avatarUrl ? (
            <Avatar src={userProfile.avatarUrl} alt={userProfile.name || '프로필'} />
          ) : (
            <Avatar>
              <PersonIcon />
            </Avatar>
          )}
        </IconButton>

        <Menu anchorEl={profileAnchorElement} open={Boolean(profileAnchorElement)} onClose={handleCloseProfileMenu}>
          <Box sx={{ px: 2, py: 1 }}>
            {userProfile.name ? <Typography>{userProfile.name}</Typography> : null}
            <Typography>{userProfile.email}</Typography>
          </Box>

          <Divider />

          <MenuItem onClick={handleCloseProfileMenu}>
            <ListItemIcon>
              <HomeIcon fontSize="small" />
            </ListItemIcon>
            <Link href="/" underline="none" sx={{ flex: '1 0 0%' }}>
              라운지
            </Link>
          </MenuItem>

          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>로그아웃</ListItemText>
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
