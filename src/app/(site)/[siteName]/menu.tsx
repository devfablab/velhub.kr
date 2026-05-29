/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import ArrowBackIosNewRoundedIcon from '@mui/icons-material/ArrowBackIosNewRounded';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import { getSupabaseBrowser } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '@/components/Anchor';
import BlogSearch from '@/components/header-groups/site/BlogSearch';
import CommunitySearch from '@/components/header-groups/site/CommunitySearch';
import DrawerMenu from '@/components/header-groups/site/DrawerMenu';
import DrawerManage from '@/components/header-groups/site/DrawerManage';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import styles from '@/app/header.module.sass';

type ContainerProps = {
  pageTitle?: string;
  pageBack?: string;
  pageFin?: boolean;
  children: React.ReactNode;
};

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
  isLoggedIn: boolean;
  globalRole: string | null;
  siteRole: string | null;
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

export default function Container({ pageTitle, pageBack, pageFin, children }: ContainerProps) {
  const params = useParams();
  const pathname = usePathname();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const { isReady } = useAuthState();
  const { themeMode, setThemeMode } = useThemeMode();
  const [profileLogoUrl, setProfileLogoUrl] = useState<string | null>(null);
  const [siteLabel, setSiteLabel] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isThemeModeDrawerOpen, setIsThemeModeDrawerOpen] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const [siteType, setSiteType] = useState<SiteType | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: null,
    email: null,
    avatarUrl: null,
    isLoggedIn: false,
    globalRole: null,
    siteRole: null,
  });

  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);

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
      if (!siteName) {
        return;
      }

      const response = await fetch(`/api/header/site?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HeaderResponse | { error?: string };

      if (!response.ok || !('isLoggedIn' in result)) {
        clearBlogFontSettings();
        setSiteType(null);
        setUserProfile({
          name: null,
          email: null,
          avatarUrl: null,
          isLoggedIn: false,
          globalRole: null,
          siteRole: null,
        });
        setSiteLabel('');
        setProfilePictureUrl(null);
        setProfileLogoUrl(null);
        return;
      }

      applyColorSet(result.themeType);
      applyBlogFontSettings(result.siteType, result.blogFontSettings);
      setSiteType(result.siteType);

      setUserProfile({
        name: result.userName,
        email: result.email,
        avatarUrl: result.avatar,
        isLoggedIn: result.isLoggedIn,
        globalRole: result.globalRole,
        siteRole: result.siteRole,
      });
      setSiteLabel(result.siteLabel || result.siteName || '');
      setProfilePictureUrl(result.profilePictureUrl);
      setProfileLogoUrl(result.profileLogoUrl);
    }

    if (!isReady) {
      return;
    }

    void loadHeader();
  }, [isReady, siteName]);

  function renderThemeModeIcon() {
    if (themeMode === 'light') {
      return <LightModeIcon />;
    }

    if (themeMode === 'dark') {
      return <DarkModeIcon />;
    }

    return <SettingsBrightnessIcon />;
  }

  function handleOpenProfileDrawer() {
    setIsProfileDrawerOpen(true);
  }

  function handleOpenThemeModeMenu() {
    setIsThemeModeDrawerOpen(true);
  }

  function handleCloseThemeModeDrawer() {
    setIsThemeModeDrawerOpen(false);
  }

  function handleSelectThemeMode(nextThemeMode: ThemeMode) {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextThemeMode);
    setThemeMode(nextThemeMode);
    applyThemeMode(nextThemeMode);
    handleCloseThemeModeDrawer();
  }

  function handleCloseProfileDrawer() {
    setIsProfileDrawerOpen(false);
  }

  function handleOpenSearchDrawer() {
    setIsSearchDrawerOpen(true);
  }

  function handleCloseSearchDrawer() {
    setIsSearchDrawerOpen(false);
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

  const home = pathname === `/${siteName}` ? true : false;

  const isSiteStaff = isStaffRole(userProfile.siteRole);
  const isBlog = siteType === 'blog' ? true : false;

  if (!isMounted || !isReady) {
    return null;
  }

  return (
    <>
      <header className={`${styles.appbar} ${isMobile ? '' : styles.hidden}`} aria-hidden={isMobile ? undefined : true}>
        {isMobile ? (
          <>
            {pageBack ? (
              <div className={styles.location}>
                <IconButton href={pageBack} aria-label="이전화면으로 이동">
                  <ArrowBackIosNewRoundedIcon />
                </IconButton>
              </div>
            ) : (
              <i style={{ width: 120, height: 1, display: 'inline-flex' }} aria-hidden />
            )}
            <h1>
              {home ? (
                <strong>
                  {profileLogoUrl ? (
                    <img src={profileLogoUrl} alt={siteLabel} aria-hidden="true" />
                  ) : (
                    <>
                      {profilePictureUrl ? <AppIconAvatar src={profilePictureUrl || null} alt="" size={52} /> : null}
                      {siteLabel}
                    </>
                  )}
                  {pageTitle}
                </strong>
              ) : (
                <>
                  <span>{siteLabel} </span>
                  <strong>{pageTitle}</strong>
                </>
              )}
            </h1>
            <div className={styles.iconbuttons}>
              {pageFin ? (
                <IconButton onClick={handleOpenProfileDrawer} sx={{ width: 40, height: 40 }}>
                  <MoreHorizRoundedIcon />
                </IconButton>
              ) : (
                <>
                  <IconButton onClick={handleOpenSearchDrawer} sx={{ width: 40, height: 40 }}>
                    <SearchOutlinedIcon />
                  </IconButton>
                  <Drawer
                    anchor="top"
                    open={isSearchDrawerOpen}
                    onClose={handleCloseSearchDrawer}
                    className={styles['VhiDrawer-search']}
                  >
                    <div className={styles['mobile-search']}>
                      <IconButton
                        className={styles['icon-button']}
                        onClick={handleCloseSearchDrawer}
                        aria-label="검색 닫기"
                      >
                        <CloseRoundedIcon />
                      </IconButton>

                      {siteType === 'blog' ? (
                        <BlogSearch siteName={siteName} isBlog={isBlog} />
                      ) : (
                        <CommunitySearch siteName={siteName} isBlog={isBlog} />
                      )}
                    </div>
                  </Drawer>
                  <IconButton onClick={handleOpenThemeModeMenu} sx={{ width: 40, height: 40 }}>
                    {renderThemeModeIcon()}
                  </IconButton>
                  <Drawer
                    anchor="right"
                    open={isThemeModeDrawerOpen}
                    onClose={handleCloseThemeModeDrawer}
                    className={styles.VhiDrawer}
                  >
                    <Box role="presentation">
                      <List>
                        <li className={styles['VhiDrawer-header']}>
                          <strong>화면모드 설정</strong>
                          <IconButton type="button" onClick={handleCloseThemeModeDrawer} aria-label="메뉴 닫기">
                            <CloseRoundedIcon />
                          </IconButton>
                        </li>
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
                      </List>
                    </Box>
                  </Drawer>
                  <IconButton
                    onClick={handleOpenProfileDrawer}
                    className={styles['theme-mode-button']}
                    sx={{ width: 40, height: 40 }}
                  >
                    <MenuRoundedIcon />
                  </IconButton>
                </>
              )}

              <Drawer
                anchor="right"
                open={isProfileDrawerOpen}
                onClose={handleCloseProfileDrawer}
                className={styles.VhiDrawer}
              >
                <Box role="presentation">
                  <List>
                    <li className={styles['VhiDrawer-header']}>
                      <strong>{pageFin ? '설정 및 메뉴' : '마이 메뉴'}</strong>
                      <IconButton type="button" onClick={handleCloseProfileDrawer} aria-label="메뉴 닫기">
                        <CloseRoundedIcon />
                      </IconButton>
                    </li>

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

                    {pageFin ? (
                      <>
                        <li className={styles.searchform}>
                          {siteType === 'blog' ? (
                            <BlogSearch siteName={siteName} isBlog={isBlog} />
                          ) : (
                            <CommunitySearch siteName={siteName} isBlog={isBlog} />
                          )}
                        </li>

                        <ListSubheader className={styles['VhiDrawer-subheader']}>화면모드 설정</ListSubheader>
                        <li className={styles['theme-buttons']}>
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
                        </li>
                      </>
                    ) : null}

                    {isSiteStaff ? (
                      <>
                        <ListSubheader className={styles['VhiDrawer-subheader']}>
                          {isBlog ? '블로그' : '커뮤니티'} 관리
                        </ListSubheader>
                        <DrawerManage siteName={siteName} siteType={siteType} onClose={handleCloseProfileDrawer} />
                      </>
                    ) : null}

                    <ListSubheader className={styles['VhiDrawer-subheader']}>서비스화면</ListSubheader>
                    <DrawerMenu siteName={siteName} isBlog={isBlog} onClose={handleCloseProfileDrawer} />

                    {userProfile.isLoggedIn ? (
                      <>
                        <ListSubheader className={styles['VhiDrawer-subheader']}>기타</ListSubheader>
                        <MenuItem onClick={handleCloseProfileDrawer}>
                          <Anchor href="/">
                            <HomeOutlinedIcon fontSize="small" />
                            <span>라운지</span>
                          </Anchor>
                        </MenuItem>

                        <MenuItem onClick={handleCloseProfileDrawer}>
                          <Anchor href="/hub">
                            <HubOutlinedIcon fontSize="small" />
                            <span>마이허브</span>
                          </Anchor>
                        </MenuItem>

                        <MenuItem onClick={handleCloseProfileDrawer}>
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
                      </>
                    ) : (
                      <>
                        <ListSubheader className={styles['VhiDrawer-subheader']}>기타</ListSubheader>
                        <MenuItem onClick={handleCloseProfileDrawer}>
                          <Anchor href="/auth/sign-in">
                            <LoginOutlinedIcon fontSize="small" />
                            <span>로그인</span>
                          </Anchor>
                        </MenuItem>

                        <MenuItem onClick={handleCloseProfileDrawer}>
                          <Anchor href="/auth/sign-up">
                            <CheckOutlinedIcon fontSize="small" />
                            <span>회원가입</span>
                          </Anchor>
                        </MenuItem>
                      </>
                    )}
                  </List>
                </Box>
              </Drawer>
            </div>
          </>
        ) : null}
      </header>
      <main style={{ marginTop: isMobile ? 64 : undefined }}>{children}</main>
    </>
  );
}
