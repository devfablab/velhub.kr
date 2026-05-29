/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import {
  Avatar,
  Drawer,
  IconButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import InterestsOutlinedIcon from '@mui/icons-material/InterestsOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HearingOutlinedIcon from '@mui/icons-material/HearingOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import { ThemeMode, useThemeMode } from '@/app/themeProvider';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

type ContainerProps = {
  pageTitle: string;
  pageBack: string;
  children: React.ReactNode;
};

type SiteType = 'blog' | 'community';

type HeaderResponse = {
  siteLabel: string | null;
  siteType: SiteType | null;
  themeType: string;
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  globalRole: string | null;
  siteRole: string | null;
  sessionCase?: string | null;
};

type UserProfile = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

function getStoredThemeMode() {
  if (typeof window === 'undefined') {
    return 'system' as ThemeMode;
  }

  const storedThemeMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (isThemeMode(storedThemeMode)) {
    return storedThemeMode;
  }

  return 'system' as ThemeMode;
}

function getResolvedThemeMode(themeMode: ThemeMode) {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeMode(themeMode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', `yellow-${getResolvedThemeMode(themeMode)}`);
}

export default function Container({ pageTitle, pageBack, children }: ContainerProps) {
  const { isReady } = useAuthState();
  const { themeMode, setThemeMode } = useThemeMode();
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const [isMounted, setIsMounted] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: null,
    email: null,
    avatarUrl: null,
  });

  useEffect(() => {
    setThemeMode(getStoredThemeMode());
    setIsMounted(true);
  }, [setThemeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    applyThemeMode(themeMode);

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    function handleSystemThemeModeChange() {
      if (themeMode === 'system') {
        applyThemeMode('system');
      }
    }

    mediaQueryList.addEventListener('change', handleSystemThemeModeChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleSystemThemeModeChange);
    };
  }, [isMounted, themeMode]);

  useEffect(() => {
    async function loadHeader() {
      const response = await fetch('/api/header/settings', {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HeaderResponse | { error?: string };

      if (!response.ok || !('isLoggedIn' in result)) {
        window.location.href = '/auth/sign-in';
        return;
      }

      setUserProfile({
        name: result.userName,
        email: result.email,
        avatarUrl: result.avatar,
      });
    }

    if (!isReady) {
      return;
    }

    void loadHeader();
  }, [isReady]);

  function handleOpenProfileDrawer() {
    setIsProfileDrawerOpen(true);
  }

  function handleCloseProfileDrawer() {
    setIsProfileDrawerOpen(false);
  }

  function handleSelectThemeMode(nextThemeMode: ThemeMode) {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextThemeMode);
    setThemeMode(nextThemeMode);
    applyThemeMode(nextThemeMode);
  }

  async function handleLogout() {
    handleCloseProfileDrawer();

    const supabase = getSupabaseBrowser();
    const signOutResult = await supabase.auth.signOut({
      scope: 'local',
    });

    if (signOutResult.error) {
      return;
    }

    window.location.href = '/';
  }

  useEffect(() => {
    if (!isMobile) {
      setIsProfileDrawerOpen(false);
    }
  }, [isMobile]);

  if (!isMounted || !isReady) {
    return null;
  }

  return (
    <>
      {isMobile ? (
        <header
          className={`${styles.appbar} ${isMobile ? '' : styles.hidden}`}
          aria-hidden={isMobile ? undefined : true}
        >
          <IconButton href={pageBack} aria-label="이전화면으로 이동" sx={{ width: 24, height: 24 }}>
            <ArrowBackIosNewRoundedIcon />
          </IconButton>
          <h1>
            <span>데브공방 {pageTitle !== '마이허브' ? '- 마이허브 ' : null}</span>
            <strong>{pageTitle}</strong>
          </h1>
          <div className={styles.iconbuttons}>
            <IconButton
              onClick={handleOpenProfileDrawer}
              className={styles['theme-mode-button']}
              sx={{ width: 24, height: 24 }}
            >
              <MoreHorizRoundedIcon />
            </IconButton>

            <Drawer
              anchor="right"
              open={isProfileDrawerOpen}
              onClose={handleCloseProfileDrawer}
              className={styles.VhiDrawer}
            >
              <li className={styles['VhiDrawer-header']}>
                <strong>마이 메뉴</strong>
                <IconButton type="button" onClick={handleCloseProfileDrawer} aria-label="메뉴 닫기">
                  <CloseRoundedIcon />
                </IconButton>
              </li>

              <li className={styles['VhiMenu-profile']}>
                <Avatar src={userProfile.avatarUrl || '/broken-image.jpg'} alt={userProfile.name || ''} />
                <div className={styles['VhiMenu-profile-info']}>
                  <em>{userProfile.name}</em>
                  <span>{userProfile.email}</span>
                </div>
              </li>

              <ListSubheader className={styles['VhiDrawer-subheader']}>화면모드 설정</ListSubheader>
              <div className={styles['theme-buttons']}>
                <button
                  type="button"
                  onClick={() => handleSelectThemeMode('light')}
                  className={themeMode === 'light' ? styles.active : undefined}
                >
                  {themeMode === 'light' ? <LightModeIcon /> : <LightModeOutlinedIcon />}
                  <span>라이트 모드</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectThemeMode('system')}
                  className={themeMode === 'system' ? styles.active : undefined}
                >
                  {themeMode === 'system' ? <SettingsBrightnessIcon /> : <SettingsBrightnessOutlinedIcon />}
                  <span>시스템</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectThemeMode('dark')}
                  className={themeMode === 'dark' ? styles.active : undefined}
                >
                  {themeMode === 'dark' ? <DarkModeIcon /> : <DarkModeOutlinedIcon />}
                  <span>다크 모드</span>
                </button>
              </div>

              <ListSubheader className={styles['VhiDrawer-subheader']}>마이허브</ListSubheader>
              <MenuItem key="hub" onClick={handleCloseProfileDrawer}>
                <Anchor href="/hub">
                  <HubOutlinedIcon fontSize="small" />
                  <span>마이허브 홈</span>
                </Anchor>
              </MenuItem>
              <MenuItem key="blogs" onClick={handleCloseProfileDrawer}>
                <Anchor href="/hub/blogs">
                  <MenuBookRoundedIcon fontSize="small" />
                  <span>블로그 허브</span>
                </Anchor>
              </MenuItem>
              <MenuItem key="communities" onClick={handleCloseProfileDrawer}>
                <Anchor href="/hub/communities">
                  <InterestsOutlinedIcon fontSize="small" />
                  <span>커뮤니티 허브</span>
                </Anchor>
              </MenuItem>
              <MenuItem key="purchase" onClick={handleCloseProfileDrawer}>
                <Anchor href="/hub/purchase">
                  <SellOutlinedIcon fontSize="small" />
                  <span>구입내역</span>
                </Anchor>
              </MenuItem>
              <MenuItem key="notifications" onClick={handleCloseProfileDrawer}>
                <Anchor href="/hub/notifications">
                  <NotificationsOutlinedIcon fontSize="small" />
                  <span>알림내역</span>
                </Anchor>
              </MenuItem>

              <ListSubheader className={styles['VhiDrawer-subheader']}>라운지</ListSubheader>
              <MenuItem key="lounge" onClick={handleCloseProfileDrawer}>
                <Anchor href="/">
                  <HomeOutlinedIcon fontSize="small" />
                  <span>라운지 홈</span>
                </Anchor>
              </MenuItem>
              <MenuItem key="concierge" onClick={handleCloseProfileDrawer}>
                <Anchor href="/concierge">
                  <HearingOutlinedIcon fontSize="small" />
                  <span>컨시어지</span>
                </Anchor>
              </MenuItem>
              <MenuItem key="help" onClick={handleCloseProfileDrawer}>
                <Anchor href="/help">
                  <LightbulbOutlinedIcon fontSize="small" />
                  <span>이용안내</span>
                </Anchor>
              </MenuItem>

              <ListSubheader className={styles['VhiDrawer-subheader']}>기타</ListSubheader>
              <MenuItem key="settings" onClick={handleCloseProfileDrawer}>
                <Anchor href="/settings">
                  <SettingsOutlinedIcon fontSize="small" />
                  <span>개인 설정</span>
                </Anchor>
              </MenuItem>
              <MenuItem key="logout" onClick={handleLogout} className={styles.MenuItem}>
                <ListItemIcon className={styles['MenuItem-icon']}>
                  <LogoutOutlinedIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText className={styles['MenuItem-text']}>로그아웃</ListItemText>
              </MenuItem>
            </Drawer>
          </div>
        </header>
      ) : (
        <header hidden aria-hidden />
      )}
      <main style={{ marginTop: isMobile ? 64 : undefined }}>{children}</main>
    </>
  );
}
