/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, useMediaQuery, useTheme } from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import InterestsOutlinedIcon from '@mui/icons-material/InterestsOutlined';
import { getSupabaseBrowser } from '@/lib/supabase';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import Anchor from '@/components/Anchor';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import { ServiceLogo } from '../Svgs';
import PrimaryMenu from '../header-groups/lounge/PrimaryMenu';
import SecondaryMenu from '../header-groups/lounge/SecondaryMenu';
import styles from '@/app/header.module.sass';

type HeaderResponse = {
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  themeMode: ThemeMode | null;
};

type UserProfile = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isLoggedIn: boolean;
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

export default function HeaderLounge() {
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const lastScrollY = useRef(0);
  const [isUpScroll, setIsUpScroll] = useState(false);

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
    isLoggedIn: false,
  });

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      if (currentY < 100) {
        setIsUpScroll(false);
      } else {
        setIsUpScroll(currentY < lastScrollY.current);
      }
      lastScrollY.current = currentY;
    };
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

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
      const response = await fetch('/api/header/lounge', {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HeaderResponse | { error?: string };

      if (!response.ok || !('isLoggedIn' in result)) {
        setUserProfile({
          name: null,
          email: null,
          avatarUrl: null,
          isLoggedIn: false,
        });
        return;
      }

      setUserProfile({
        name: result.userName,
        email: result.email,
        avatarUrl: result.avatar,
        isLoggedIn: result.isLoggedIn,
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
        <>
          <header className={styles.header} inert={isUpScroll ? true : undefined}>
            <div className={styles.container}>
              <div className={styles.top}>
                <div className={styles.gnb}>
                  <h1>
                    <Anchor href="/" aria-label="데브허브 velhub">
                      <ServiceLogo />
                    </Anchor>
                  </h1>
                  <PrimaryMenu />
                </div>

                <div className={styles.iconbuttons}>
                  <IconButton onClick={handleOpenThemeModeMenu} className={styles['theme-mode-button']}>
                    {renderThemeModeIcon()}
                  </IconButton>

                  <IconButton onClick={handleOpenProfileMenu}>
                    <Avatar
                      src={userProfile.avatarUrl || '/broken-image.jpg'}
                      alt={userProfile.name || ''}
                      sx={{ width: 24, height: 24 }}
                    />
                  </IconButton>
                </div>
              </div>
              <div className={styles.bottom}>
                <SecondaryMenu />
              </div>
            </div>
          </header>
          <header
            className={`${styles.header} ${styles['header-mini']} ${isUpScroll ? styles['header-mini-visible'] : ''}`}
            inert={isUpScroll ? undefined : true}
          >
            <div className={styles.container}>
              <div className={styles.top}>
                <div className={styles.gnb}>
                  <h1>
                    <Anchor href="/" aria-label="데브허브 velhub">
                      <ServiceLogo />
                    </Anchor>
                  </h1>
                  <SecondaryMenu />
                </div>

                <div className={styles.iconbuttons}>
                  <IconButton onClick={handleOpenThemeModeMenu} className={styles['theme-mode-button']}>
                    {renderThemeModeIcon()}
                  </IconButton>

                  <IconButton onClick={handleOpenProfileMenu}>
                    <Avatar
                      src={userProfile.avatarUrl || '/broken-image.jpg'}
                      alt={userProfile.name || ''}
                      sx={{ width: 24, height: 24 }}
                    />
                  </IconButton>
                </div>
              </div>
            </div>
          </header>
          <Menu
            anchorEl={themeModeAnchorElement}
            open={Boolean(themeModeAnchorElement)}
            onClose={handleCloseThemeModeMenu}
            className={styles.VhiMenu}
          >
            <MenuItem onClick={() => handleSelectThemeMode('light')} className={styles.MenuItem}>
              <ListItemIcon className={styles['MenuItem-icon']}>
                <LightModeIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText className={styles['MenuItem-text']}>라이트모드</ListItemText>
            </MenuItem>

            <MenuItem onClick={() => handleSelectThemeMode('system')} className={styles.MenuItem}>
              <ListItemIcon className={styles['MenuItem-icon']}>
                <SettingsBrightnessIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText className={styles['MenuItem-text']}>시스템</ListItemText>
            </MenuItem>

            <MenuItem onClick={() => handleSelectThemeMode('dark')} className={styles.MenuItem}>
              <ListItemIcon className={styles['MenuItem-icon']}>
                <DarkModeIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText className={styles['MenuItem-text']}>다크모드</ListItemText>
            </MenuItem>
          </Menu>
          <Menu
            anchorEl={profileAnchorElement}
            open={Boolean(profileAnchorElement)}
            onClose={handleCloseProfileMenu}
            className={styles.VhiMenu}
          >
            {userProfile.isLoggedIn ? (
              <li className={styles['VhiMenu-profile']}>
                <Avatar src={userProfile.avatarUrl || '/broken-image.jpg'} alt={userProfile.name || ''} />
                <div className={styles['VhiMenu-profile-info']}>
                  <em>{userProfile.name}</em>
                  <span>{userProfile.email}</span>
                </div>
              </li>
            ) : (
              <li className={styles['VhiMenu-profile']}>
                <Avatar src="" alt="" />
                <div className={styles['VhiMenu-profile-info']}>
                  <em>로그인이 필요합니다</em>
                </div>
              </li>
            )}
            {userProfile.isLoggedIn
              ? [
                  <MenuItem key="lounge" onClick={handleCloseProfileMenu}>
                    <Anchor href="/">
                      <HomeOutlinedIcon fontSize="small" />
                      <span>라운지 이동</span>
                    </Anchor>
                  </MenuItem>,
                  <MenuItem key="hub" onClick={handleCloseProfileMenu}>
                    <Anchor href="/hub">
                      <HubOutlinedIcon fontSize="small" />
                      <span>마이허브</span>
                    </Anchor>
                  </MenuItem>,
                  <MenuItem key="settings" onClick={handleCloseProfileMenu}>
                    <Anchor href="/settings">
                      <SettingsOutlinedIcon fontSize="small" />
                      <span>개인 설정</span>
                    </Anchor>
                  </MenuItem>,
                  <MenuItem key="logout" onClick={handleLogout} className={styles.MenuItem}>
                    <ListItemIcon className={styles['MenuItem-icon']}>
                      <LogoutOutlinedIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText className={styles['MenuItem-text']}>로그아웃</ListItemText>
                  </MenuItem>,
                ]
              : [
                  <MenuItem key="signin" onClick={handleCloseProfileMenu}>
                    <Anchor href="/auth/sign-in">
                      <LoginOutlinedIcon fontSize="small" />
                      <span>로그인</span>
                    </Anchor>
                  </MenuItem>,
                  <MenuItem key="signup" onClick={handleCloseProfileMenu}>
                    <Anchor href="/auth/sign-up">
                      <InterestsOutlinedIcon fontSize="small" />
                      <span>회원가입</span>
                    </Anchor>
                  </MenuItem>,
                ]}
          </Menu>
        </>
      )}
    </>
  );
}
