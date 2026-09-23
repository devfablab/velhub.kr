/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import InterestsOutlinedIcon from '@mui/icons-material/InterestsOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Avatar,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import Anchor from '../Anchor';
import PrimaryMenu from '../header-groups/hub/PrimaryMenu';
import SecondaryMenu from '../header-groups/hub/SecondaryMenu';
import { ServiceLogo } from '../Svgs';
import { useHubHeader } from '@/app/(hub)/hub/shared/HubHeaderContext';
import { type ThemeMode, useThemeMode } from '@/app/themeProvider';
import styles from '@/app/header.module.sass';

type UserProfile = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isAuthor?: boolean;
  creatorHandleName?: string | null;
  userHandleName?: string | null;
  hasAffettoMyPosts?: boolean;
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
  const initialHeader = useHubHeader();
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const { themeMode, setThemeMode } = useThemeMode();

  const [isMounted, setIsMounted] = useState(false);
  const [themeModeAnchorElement, setThemeModeAnchorElement] = useState<null | HTMLElement>(null);
  const [profileAnchorElement, setProfileAnchorElement] = useState<null | HTMLElement>(null);
  const [, setIsThemeModeDrawerOpen] = useState(false);
  const [, setIsProfileDrawerOpen] = useState(false);
  const userProfile: UserProfile = {
    name: initialHeader?.userName ?? null,
    email: initialHeader?.email ?? null,
    avatarUrl: initialHeader?.avatar ?? null,
    isAuthor: initialHeader?.isAuthor ?? false,
    creatorHandleName: initialHeader?.creatorHandleName ?? null,
    userHandleName: initialHeader?.userHandleName ?? null,
    hasAffettoMyPosts: initialHeader?.hasAffettoMyPosts ?? false,
  };

  const searchParams = useSearchParams();
  const pathname = usePathname();

  useEffect(() => {
    const search = searchParams.toString();
    const currentPath = search ? `${pathname}?${search}` : pathname;
    sessionStorage.setItem('route:returnPath', currentPath);
  }, [pathname, searchParams]);

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

  if (!isMounted) {
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

                <IconButton onClick={handleOpenProfileMenu}>
                  <Avatar
                    src={userProfile.avatarUrl || '/broken-image.jpg'}
                    alt={userProfile.name || ''}
                    sx={{ width: 24, height: 24 }}
                  />
                </IconButton>

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
                  {userProfile.isAuthor ? (
                    <MenuItem key="creator-library" onClick={handleCloseProfileMenu}>
                      <Anchor
                        href={
                          userProfile.creatorHandleName
                            ? `/creator/${userProfile.creatorHandleName}`
                            : '/creator/settings'
                        }
                      >
                        <MenuBookRoundedIcon fontSize="small" />
                        <span>작가의 서재</span>
                      </Anchor>
                    </MenuItem>
                  ) : null}
                  {userProfile.hasAffettoMyPosts ? (
                    <MenuItem key="user-library" onClick={handleCloseProfileMenu}>
                      <Anchor
                        href={userProfile.userHandleName ? `/user/${userProfile.userHandleName}` : '/user/settings'}
                      >
                        <InterestsOutlinedIcon fontSize="small" />
                        <span>독자의 서재</span>
                      </Anchor>
                    </MenuItem>
                  ) : null}
                  <MenuItem key="settings" onClick={handleCloseProfileMenu}>
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
                </Menu>
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
