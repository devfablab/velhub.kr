/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAuto';
import LogoutIcon from '@mui/icons-material/Logout';
import HomeIcon from '@mui/icons-material/Home';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import LoginIcon from '@mui/icons-material/Login';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import Anchor from '@/components/Anchor';

type HeaderResponse = {
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  themeMode: ThemeMode | null;
  role: string | null;
};

type UserProfile = {
  isLoggedIn: boolean;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  role: string | null;
};

export default function HeaderConcierge() {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

  const { themeMode, setThemeMode } = useThemeMode();

  const [isMounted, setIsMounted] = useState(false);
  const [themeModeAnchorElement, setThemeModeAnchorElement] = useState<null | HTMLElement>(null);
  const [profileAnchorElement, setProfileAnchorElement] = useState<null | HTMLElement>(null);
  const [isThemeModeDrawerOpen, setIsThemeModeDrawerOpen] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    isLoggedIn: false,
    name: null,
    email: null,
    avatarUrl: null,
    role: null,
  });

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function loadHeader() {
      const response = await fetch('/api/header/concierge', {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HeaderResponse | { error?: string };

      if (!response.ok || !('isLoggedIn' in result)) {
        setUserProfile({
          isLoggedIn: false,
          name: null,
          email: null,
          avatarUrl: null,
          role: null,
        });
        return;
      }

      setUserProfile({
        isLoggedIn: result.isLoggedIn,
        name: result.userName,
        email: result.email,
        avatarUrl: result.avatar,
        role: result.role,
      });
    }

    void loadHeader();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      await loadHeader();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

  function handleOpenThemeModeMenu(event: React.MouseEvent<HTMLElement>) {
    if (isMobile) {
      setIsThemeModeDrawerOpen(true);
      return;
    }

    setThemeModeAnchorElement(event.currentTarget);
  }

  function handleCloseThemeModeMenu() {
    setThemeModeAnchorElement(null);
  }

  function handleCloseThemeModeDrawer() {
    setIsThemeModeDrawerOpen(false);
  }

  function handleSelectThemeMode(nextThemeMode: ThemeMode) {
    setThemeMode(nextThemeMode);
    handleCloseThemeModeMenu();
    handleCloseThemeModeDrawer();
  }

  function handleOpenProfileMenu(event: React.MouseEvent<HTMLElement>) {
    if (isMobile) {
      setIsProfileDrawerOpen(true);
      return;
    }

    setProfileAnchorElement(event.currentTarget);
  }

  function handleCloseProfileMenu() {
    setProfileAnchorElement(null);
  }

  function handleCloseProfileDrawer() {
    setIsProfileDrawerOpen(false);
  }

  async function handleLogout() {
    handleCloseProfileMenu();
    handleCloseProfileDrawer();

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

        {isMobile ? (
          <Drawer anchor="right" open={isThemeModeDrawerOpen} onClose={handleCloseThemeModeDrawer}>
            <Box sx={{ minWidth: 280, py: 1 }}>
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
            </Box>
          </Drawer>
        ) : (
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
        )}

        <IconButton onClick={handleOpenProfileMenu}>
          <Avatar src={userProfile.avatarUrl || '/broken-image.jpg'} alt={userProfile.name || ''} />
        </IconButton>

        {isMobile ? (
          <Drawer anchor="right" open={isProfileDrawerOpen} onClose={handleCloseProfileDrawer}>
            <Box sx={{ minWidth: 320, py: 1 }}>
              {userProfile.isLoggedIn ? (
                <>
                  <Box sx={{ px: 2, py: 1 }}>
                    {userProfile.name ? <Typography>{userProfile.name}</Typography> : null}
                    {userProfile.email ? <Typography>{userProfile.email}</Typography> : null}
                  </Box>

                  <Divider />
                </>
              ) : null}

              <MenuItem onClick={handleCloseProfileDrawer}>
                <ListItemIcon>
                  <HomeIcon fontSize="small" />
                </ListItemIcon>
                <Link href="/" underline="none" sx={{ flex: '1 0 0%' }}>
                  라운지
                </Link>
              </MenuItem>

              {userProfile.role === 'admin' ? (
                <MenuItem onClick={handleCloseProfileDrawer}>
                  <ListItemIcon>
                    <AdminPanelSettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <Link href="/concierge/admin/dashboard" underline="none" sx={{ flex: '1 0 0%' }}>
                    관리
                  </Link>
                </MenuItem>
              ) : null}

              {userProfile.isLoggedIn ? (
                <MenuItem onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>로그아웃</ListItemText>
                </MenuItem>
              ) : (
                <MenuItem onClick={handleCloseProfileDrawer}>
                  <ListItemIcon>
                    <LoginIcon fontSize="small" />
                  </ListItemIcon>
                  <Link href="/auth/sign-in" underline="none" sx={{ flex: '1 0 0%' }}>
                    로그인
                  </Link>
                </MenuItem>
              )}
            </Box>
          </Drawer>
        ) : (
          <Menu anchorEl={profileAnchorElement} open={Boolean(profileAnchorElement)} onClose={handleCloseProfileMenu}>
            {userProfile.isLoggedIn ? (
              <>
                <Box sx={{ px: 2, py: 1 }}>
                  {userProfile.name ? <Typography>{userProfile.name}</Typography> : null}
                  {userProfile.email ? <Typography>{userProfile.email}</Typography> : null}
                </Box>

                <Divider />
              </>
            ) : null}

            <MenuItem onClick={handleCloseProfileMenu}>
              <ListItemIcon>
                <HomeIcon fontSize="small" />
              </ListItemIcon>
              <Link href="/" underline="none" sx={{ flex: '1 0 0%' }}>
                라운지
              </Link>
            </MenuItem>

            {userProfile.role === 'admin' ? (
              <MenuItem onClick={handleCloseProfileMenu}>
                <ListItemIcon>
                  <AdminPanelSettingsIcon fontSize="small" />
                </ListItemIcon>
                <Link href="/concierge/admin/dashboard" underline="none" sx={{ flex: '1 0 0%' }}>
                  관리
                </Link>
              </MenuItem>
            ) : null}

            {userProfile.isLoggedIn ? (
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>로그아웃</ListItemText>
              </MenuItem>
            ) : (
              <MenuItem onClick={handleCloseProfileMenu}>
                <ListItemIcon>
                  <LoginIcon fontSize="small" />
                </ListItemIcon>
                <Link href="/auth/sign-in" underline="none" sx={{ flex: '1 0 0%' }}>
                  로그인
                </Link>
              </MenuItem>
            )}
          </Menu>
        )}
      </Toolbar>
    </AppBar>
  );
}
