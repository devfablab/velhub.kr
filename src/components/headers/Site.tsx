/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
  Avatar,
  Box,
  Divider,
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
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import HomeIcon from '@mui/icons-material/Home';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import InterestsRoundedIcon from '@mui/icons-material/InterestsRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import { getSupabaseBrowser } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '../Anchor';
import BlogSearch from '../header-groups/site/BlogSearch';
import CommunitySearch from '../header-groups/site/CommunitySearch';
import NavMenu from '../header-groups/site/NavMenu';
import NavManage from '../header-groups/site/NavManage';
import DrawerMenu from '../header-groups/site/DrawerMenu';
import DrawerManage from '../header-groups/site/DrawerManage';
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
  const [siteType, setSiteType] = useState<SiteType | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: null,
    email: null,
    avatarUrl: null,
    isLoggedIn: false,
    globalRole: null,
    siteRole: null,
  });

  const [siteLabel, setSiteLabel] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [profileLogoUrl, setProfileLogoUrl] = useState<string | null>(null);
  const [isSearchDrawerOpen, setIsSearchDrawerOpen] = useState(false);

  const pathname = usePathname();

  const isManagePage = pathname === `/${siteName}/manage` || pathname.startsWith(`/${siteName}/manage/`);

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

  function handleOpenSearchDrawer() {
    setIsSearchDrawerOpen(true);
  }

  function handleCloseSearchDrawer() {
    setIsSearchDrawerOpen(false);
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

  const isSiteStaff = isStaffRole(userProfile.siteRole);
  const isBlog = siteType === 'blog' ? true : false;

  if (!isMounted || !isReady) {
    return null;
  }

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.top}>
          <div className={styles.gnb}>
            <h1>
              <Anchor href={`/${siteName}`} aria-label={profileLogoUrl ? siteLabel : undefined}>
                {profileLogoUrl ? (
                  <Box component="img" src={profileLogoUrl} alt="" aria-hidden="true" />
                ) : (
                  <>
                    {profilePictureUrl ? <Avatar src={profilePictureUrl} alt="" aria-hidden="true" /> : null}
                    <span>{siteLabel}</span>
                  </>
                )}
              </Anchor>
            </h1>
            {!isMobile ? (
              <>
                {siteType === 'blog' ? (
                  <BlogSearch siteName={siteName} isBlog={isBlog} />
                ) : (
                  <CommunitySearch siteName={siteName} isBlog={isBlog} />
                )}
              </>
            ) : null}
          </div>

          <div className={styles.iconbuttons}>
            {isMobile ? (
              <IconButton className={styles['icon-button']} onClick={handleOpenSearchDrawer}>
                <SearchOutlinedIcon />
              </IconButton>
            ) : null}
            {isMobile ? (
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
            ) : null}

            <IconButton onClick={handleOpenThemeModeMenu} className={styles['icon-button']}>
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
              <Avatar
                src={userProfile.avatarUrl || '/broken-image.jpg'}
                alt={userProfile.name || ''}
                sx={{ width: 24, height: 24 }}
              />
            </IconButton>
            {isMobile ? (
              <Drawer
                anchor="right"
                open={isProfileDrawerOpen}
                onClose={handleCloseProfileDrawer}
                className={styles.VhiDrawer}
              >
                <Box sx={{ minWidth: 320, py: 1 }}>
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

                  {isSiteStaff ? (
                    <>
                      <ListSubheader className={styles['VhiDrawer-subheader']}>커뮤니티 관리</ListSubheader>
                      <DrawerManage siteName={siteName} siteType={siteType} onClose={handleCloseProfileDrawer} />
                      <Divider />
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

                      <MenuItem key="logout" onClick={handleLogout} className={styles.logout}>
                        <ListItemIcon className={styles['logout-icon']}>
                          <LogoutOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText className={styles['logout-text']}>로그아웃</ListItemText>
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
                </Box>
              </Drawer>
            ) : (
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

                {userProfile.isLoggedIn && <Divider />}

                {isSiteStaff && !isManagePage
                  ? [
                      <MenuItem key="staff-home" onClick={handleCloseProfileMenu}>
                        <Anchor href={`/${siteName}/manage`}>
                          <DashboardOutlinedIcon fontSize="small" />
                          <span>사이트 설정</span>
                        </Anchor>
                      </MenuItem>,
                    ]
                  : [
                      <MenuItem key="staff-home" onClick={handleCloseProfileMenu}>
                        <Anchor href={`/${siteName}`}>
                          {isBlog ? (
                            <MenuBookRoundedIcon fontSize="small" />
                          ) : (
                            <InterestsRoundedIcon fontSize="small" />
                          )}
                          <span>{isBlog ? '블로그' : '커뮤니티'} 홈</span>
                        </Anchor>
                      </MenuItem>,
                    ]}

                {userProfile.isLoggedIn
                  ? [
                      <MenuItem key="lounge" onClick={handleCloseProfileMenu}>
                        <Anchor href="/">
                          <HomeIcon fontSize="small" />
                          <span>라운지 이동</span>
                        </Anchor>
                      </MenuItem>,
                      <MenuItem key="settings" onClick={handleCloseProfileMenu}>
                        <Anchor href="/settings">
                          <SettingsIcon fontSize="small" />
                          <span>개인 설정</span>
                        </Anchor>
                      </MenuItem>,
                      <MenuItem key="logout" onClick={handleLogout} className={styles.logout}>
                        <ListItemIcon className={styles['logout-icon']}>
                          <LogoutOutlinedIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText className={styles['logout-text']}>로그아웃</ListItemText>
                      </MenuItem>,
                    ]
                  : [
                      <MenuItem key="signin" onClick={handleCloseProfileMenu}>
                        <Anchor href="/auth/sign-in">
                          <LoginIcon fontSize="small" />
                          <span>로그인</span>
                        </Anchor>
                      </MenuItem>,
                      <MenuItem key="signup" onClick={handleCloseProfileMenu}>
                        <Anchor href="/auth/sign-up">
                          <PersonAddIcon fontSize="small" />
                          <span>회원가입</span>
                        </Anchor>
                      </MenuItem>,
                    ]}
              </Menu>
            )}
          </div>
        </div>
        {!isMobile ? (
          <div className={styles.bottom}>
            {isManagePage ? <NavManage /> : <NavMenu siteName={siteName} isBlog={isBlog} />}
          </div>
        ) : null}
      </div>
    </header>
  );
}
