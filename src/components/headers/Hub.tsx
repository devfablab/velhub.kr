/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
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
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HomeIcon from '@mui/icons-material/Home';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ArticleIcon from '@mui/icons-material/Article';
import ForumIcon from '@mui/icons-material/Forum';
import FontDownloadIcon from '@mui/icons-material/FontDownload';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import BarChartIcon from '@mui/icons-material/BarChart';
import GroupsIcon from '@mui/icons-material/Groups';
import PeopleIcon from '@mui/icons-material/People';
import ReportGmailerrorredIcon from '@mui/icons-material/ReportGmailerrorred';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import { getSupabaseBrowser } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '../Anchor';
import BlogSearch from '../header-groups/site/BlogSearch';
import CommunitySearch from '../header-groups/site/CommunitySearch';
import MenuItems from '../header-groups/site/Menu';
import SecondaryMenu from '../header-groups/hub/SecondaryMenu';
import { ServiceLogo } from '../Svgs';
import PrimaryMenu from '../header-groups/hub/PrimaryMenu';
import styles from '@/app/header.module.sass';

type SiteType = 'blog' | 'community';

type HeaderResponse = {
  siteName: string | null;
  siteLabel: string | null;
  siteType: SiteType | null;
  themeType: string;
  profilePictureUrl: string | null;
  profileLogoUrl: string | null;
  blogFontSettings: BlogFontSettings | null;
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

type BlogFontSettings = {
  subjectFontFamily: string | null;
  subjectLetterSpacing: number | null;
  subjectLineHeight: number | null;
  descriptionFontFamily: string | null;
  descriptionLetterSpacing: number | null;
  descriptionLineHeight: number | null;
  descriptionFontSize: number | null;
  descriptionMargin: number | null;
};

function getBlogFontFamily(value: string | null) {
  if (value === 'neo') {
    return 'var(--neo)';
  }

  if (value === 'pre') {
    return 'var(--pre)';
  }

  if (value === 'sans') {
    return 'var(--sans)';
  }

  if (value === 'serif') {
    return 'var(--serif)';
  }

  if (value === 'ham') {
    return 'var(--ham)';
  }

  return '';
}

function setCssVariable(name: string, value: string | number | null) {
  if (value === null || value === '') {
    document.documentElement.style.removeProperty(name);
    return;
  }

  document.documentElement.style.setProperty(name, String(value));
}

function clearBlogFontSettings() {
  document.documentElement.removeAttribute('data-site-type');
  document.documentElement.style.removeProperty('--blog-subject-font-family');
  document.documentElement.style.removeProperty('--blog-subject-letter-spacing');
  document.documentElement.style.removeProperty('--blog-subject-line-height');
  document.documentElement.style.removeProperty('--blog-description-font-family');
  document.documentElement.style.removeProperty('--blog-description-letter-spacing');
  document.documentElement.style.removeProperty('--blog-description-line-height');
  document.documentElement.style.removeProperty('--blog-description-font-size');
  document.documentElement.style.removeProperty('--blog-description-margin');
}

function applyBlogFontSettings(siteType: SiteType | null, blogFontSettings: BlogFontSettings | null) {
  if (siteType !== 'blog') {
    clearBlogFontSettings();
    return;
  }

  document.documentElement.setAttribute('data-site-type', 'blog');

  setCssVariable('--blog-subject-font-family', getBlogFontFamily(blogFontSettings?.subjectFontFamily ?? null));
  setCssVariable(
    '--blog-subject-letter-spacing',
    blogFontSettings?.subjectLetterSpacing !== null && blogFontSettings?.subjectLetterSpacing !== undefined
      ? `${blogFontSettings.subjectLetterSpacing}em`
      : null,
  );
  setCssVariable('--blog-subject-line-height', blogFontSettings?.subjectLineHeight ?? null);

  setCssVariable('--blog-description-font-family', getBlogFontFamily(blogFontSettings?.descriptionFontFamily ?? null));
  setCssVariable(
    '--blog-description-letter-spacing',
    blogFontSettings?.descriptionLetterSpacing !== null && blogFontSettings?.descriptionLetterSpacing !== undefined
      ? `${blogFontSettings.descriptionLetterSpacing}em`
      : null,
  );
  setCssVariable('--blog-description-line-height', blogFontSettings?.descriptionLineHeight ?? null);
  setCssVariable(
    '--blog-description-font-size',
    blogFontSettings?.descriptionFontSize !== null && blogFontSettings?.descriptionFontSize !== undefined
      ? `${blogFontSettings.descriptionFontSize}px`
      : null,
  );
  setCssVariable(
    '--blog-description-margin',
    blogFontSettings?.descriptionMargin !== null && blogFontSettings?.descriptionMargin !== undefined
      ? `${blogFontSettings.descriptionMargin}px`
      : null,
  );
}

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

function isStaffRole(role: string | null) {
  return role === 'owner' || role === 'manager';
}

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

function applyColorSet(themeType: string) {
  document.documentElement.setAttribute('data-colorset', themeType);
}

export default function HeaderSite() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
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
  }, [isReady, siteName]);

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
    <header className={styles.header}>
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
                      <SettingsBrightnessIcon fontSize="small" />
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
                    <SettingsBrightnessIcon fontSize="small" />
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
                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      <HomeIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href="/" underline="none" sx={{ flex: '1 0 0%' }}>
                      라운지
                    </Link>
                  </MenuItem>

                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      <SettingsIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href="/settings" underline="none" sx={{ flex: '1 0 0%' }}>
                      개인 설정
                    </Link>
                  </MenuItem>

                  <MenuItem onClick={handleLogout}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>로그아웃</ListItemText>
                  </MenuItem>
                </Box>
              </Drawer>
            ) : (
              <Menu
                anchorEl={profileAnchorElement}
                open={Boolean(profileAnchorElement)}
                onClose={handleCloseProfileMenu}
              >
                <Box sx={{ px: 2, py: 1 }}>
                  {userProfile.name ? <Typography>{userProfile.name}</Typography> : null}
                  {userProfile.email ? <Typography>{userProfile.email}</Typography> : null}
                </Box>
                <Divider />
                <MenuItem key="settings" onClick={handleCloseProfileMenu}>
                  <ListItemIcon>
                    <SettingsIcon fontSize="small" />
                  </ListItemIcon>
                  <Link href="/settings" underline="none" sx={{ flex: '1 0 0%' }}>
                    개인 설정
                  </Link>
                </MenuItem>
                <MenuItem key="lounge" onClick={handleCloseProfileMenu}>
                  <ListItemIcon>
                    <HomeIcon fontSize="small" />
                  </ListItemIcon>
                  <Link href="/" underline="none" sx={{ flex: '1 0 0%' }}>
                    라운지 이동
                  </Link>
                </MenuItem>
                <MenuItem key="logout" onClick={handleLogout}>
                  <ListItemIcon>
                    <LogoutIcon fontSize="small" />
                  </ListItemIcon>
                  <ListItemText>로그아웃</ListItemText>
                </MenuItem>
              </Menu>
            )}
          </div>
        </div>
        <div className={styles.bottom}>
          <SecondaryMenu />
        </div>
      </div>
    </header>
  );
}
