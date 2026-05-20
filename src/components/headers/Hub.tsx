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
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HearingOutlinedIcon from '@mui/icons-material/HearingOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import InterestsOutlinedIcon from '@mui/icons-material/InterestsOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import NotificationsOutlinedIcon from '@mui/icons-material/NotificationsOutlined';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '../Anchor';
import { ServiceLogo } from '../Svgs';
import PrimaryMenu from '../header-groups/hub/PrimaryMenu';
import SecondaryMenu from '../header-groups/hub/SecondaryMenu';
import styles from '@/app/header.module.sass';

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

export default function HeaderHub() {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const { isReady } = useAuthState();
  const { themeMode, setThemeMode } = useThemeMode();

  const [isMounted, setIsMounted] = useState(false);
  const [themeModeAnchorElement, setThemeModeAnchorElement] = useState<null | HTMLElement>(null);
  const [profileAnchorElement, setProfileAnchorElement] = useState<null | HTMLElement>(null);
  const [isThemeModeDrawerOpen, setIsThemeModeDrawerOpen] = useState(false);
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
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextThemeMode);
    setThemeMode(nextThemeMode);
    applyThemeMode(nextThemeMode);
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

    const supabase = getSupabaseBrowser();
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

    return <SettingsBrightnessIcon />;
  }

  if (!isMounted || !isReady) {
    return null;
  }

  return (
    <>
      {isMobile ? (
        <header hidden aria-hidden />
      ) : (
        <header className={styles.header}>
          <div className={styles.container}>
            <div className={styles.top}>
              <div className={styles.gnb}>
                <h1>
                  <Anchor href="/" aria-label="데브허브 velhub">
                    <ServiceLogo />
                  </Anchor>
                </h1>
                {!isMobile ? <PrimaryMenu /> : null}
              </div>

              <div className={styles.iconbuttons}>
                <IconButton onClick={handleOpenThemeModeMenu} className={styles['theme-mode-button']}>
                  {renderThemeModeIcon()}
                </IconButton>

                {isMobile ? (
                  <Drawer
                    anchor="right"
                    open={isThemeModeDrawerOpen}
                    onClose={handleCloseThemeModeDrawer}
                    className={styles.VhiDrawer}
                  >
                    <li className={styles['VhiMenu-theme']}>
                      <strong>다크모드 설정</strong>
                    </li>
                    <MenuItem onClick={() => handleSelectThemeMode('light')} className={styles.theme}>
                      <ListItemIcon className={styles['theme-icon']}>
                        <LightModeIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText className={styles['theme-text']}>라이트모드</ListItemText>
                    </MenuItem>

                    <MenuItem onClick={() => handleSelectThemeMode('system')} className={styles.theme}>
                      <ListItemIcon className={styles['theme-icon']}>
                        <SettingsBrightnessIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText className={styles['theme-text']}>시스템</ListItemText>
                    </MenuItem>

                    <MenuItem onClick={() => handleSelectThemeMode('dark')} className={styles.theme}>
                      <ListItemIcon className={styles['theme-icon']}>
                        <DarkModeIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText className={styles['theme-text']}>다크모드</ListItemText>
                    </MenuItem>
                  </Drawer>
                ) : (
                  <Menu
                    anchorEl={themeModeAnchorElement}
                    open={Boolean(themeModeAnchorElement)}
                    onClose={handleCloseThemeModeMenu}
                    className={styles.VhiMenu}
                  >
                    <MenuItem onClick={() => handleSelectThemeMode('light')} className={styles.theme}>
                      <ListItemIcon className={styles['theme-icon']}>
                        <LightModeIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText className={styles['theme-text']}>라이트모드</ListItemText>
                    </MenuItem>

                    <MenuItem onClick={() => handleSelectThemeMode('system')} className={styles.theme}>
                      <ListItemIcon className={styles['theme-icon']}>
                        <SettingsBrightnessIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText className={styles['theme-text']}>시스템</ListItemText>
                    </MenuItem>

                    <MenuItem onClick={() => handleSelectThemeMode('dark')} className={styles.theme}>
                      <ListItemIcon className={styles['theme-icon']}>
                        <DarkModeIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText className={styles['theme-text']}>다크모드</ListItemText>
                    </MenuItem>
                  </Menu>
                )}

                <IconButton onClick={handleOpenProfileMenu}>
                  <Avatar src={userProfile.avatarUrl || '/broken-image.jpg'} alt={userProfile.name || ''} />
                </IconButton>

                {isMobile ? (
                  <Drawer
                    anchor="right"
                    open={isProfileDrawerOpen}
                    onClose={handleCloseProfileDrawer}
                    className={styles.VhiDrawer}
                  >
                    <li className={styles['VhiMenu-profile']}>
                      <Avatar src={userProfile.avatarUrl || '/broken-image.jpg'} alt={userProfile.name || ''} />
                      <div className={styles['VhiMenu-profile-info']}>
                        <em>{userProfile.name}</em>
                        <span>{userProfile.email}</span>
                      </div>
                    </li>
                    <ListSubheader className={styles['VhiDrawer-subheader']}>마이허브</ListSubheader>
                    <MenuItem key="hub" onClick={handleCloseProfileMenu}>
                      <Anchor href="/hub">
                        <HubOutlinedIcon fontSize="small" />
                        <span>마이허브 홈</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="blogs" onClick={handleCloseProfileMenu}>
                      <Anchor href="/hub/blogs">
                        <MenuBookRoundedIcon fontSize="small" />
                        <span>블로그 허브</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="communities" onClick={handleCloseProfileMenu}>
                      <Anchor href="/hub/communities">
                        <InterestsOutlinedIcon fontSize="small" />
                        <span>커뮤니티 허브</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="purchase" onClick={handleCloseProfileMenu}>
                      <Anchor href="/hub/purchase">
                        <SellOutlinedIcon fontSize="small" />
                        <span>구입내역</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="notifications" onClick={handleCloseProfileMenu}>
                      <Anchor href="/hub/notifications">
                        <NotificationsOutlinedIcon fontSize="small" />
                        <span>알림내역</span>
                      </Anchor>
                    </MenuItem>
                    <ListSubheader className={styles['VhiDrawer-subheader']}>라운지</ListSubheader>
                    <MenuItem key="lounge" onClick={handleCloseProfileMenu}>
                      <Anchor href="/">
                        <HomeOutlinedIcon fontSize="small" />
                        <span>라운지 홈</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="concierge" onClick={handleCloseProfileMenu}>
                      <Anchor href="/concierge">
                        <HearingOutlinedIcon fontSize="small" />
                        <span>컨시어지</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="help" onClick={handleCloseProfileMenu}>
                      <Anchor href="/help">
                        <LightbulbOutlinedIcon fontSize="small" />
                        <span>이용안내</span>
                      </Anchor>
                    </MenuItem>
                    <ListSubheader className={styles['VhiDrawer-subheader']}>기타</ListSubheader>
                    <MenuItem key="settings" onClick={handleCloseProfileMenu}>
                      <Anchor href="/settings">
                        <SettingsOutlinedIcon fontSize="small" />
                        <span>개인 설정</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="logout" onClick={handleLogout} className={styles.logout}>
                      <ListItemIcon className={styles['logout-icon']}>
                        <LogoutOutlinedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText className={styles['logout-text']}>로그아웃</ListItemText>
                    </MenuItem>
                  </Drawer>
                ) : (
                  <Menu
                    anchorEl={profileAnchorElement}
                    open={Boolean(profileAnchorElement)}
                    onClose={handleCloseProfileMenu}
                    className={styles.VhiMenu}
                  >
                    <li className={styles['VhiMenu-profile']}>
                      <Avatar src={userProfile.avatarUrl || '/broken-image.jpg'} alt={userProfile.name || ''} />
                      <div className={styles['VhiMenu-profile-info']}>
                        <em>{userProfile.name}</em>
                        <span>{userProfile.email}</span>
                      </div>
                    </li>
                    <MenuItem key="lounge" onClick={handleCloseProfileMenu}>
                      <Anchor href="/">
                        <HomeOutlinedIcon fontSize="small" />
                        <span>라운지 이동</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="settings" onClick={handleCloseProfileMenu}>
                      <Anchor href="/settings">
                        <SettingsOutlinedIcon fontSize="small" />
                        <span>개인 설정</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="logout" onClick={handleLogout} className={styles.logout}>
                      <ListItemIcon className={styles['logout-icon']}>
                        <LogoutOutlinedIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText className={styles['logout-text']}>로그아웃</ListItemText>
                    </MenuItem>
                  </Menu>
                )}
              </div>
            </div>
            {!isMobile ? (
              <div className={styles.bottom}>
                <SecondaryMenu />
              </div>
            ) : null}
          </div>
        </header>
      )}
    </>
  );
}
