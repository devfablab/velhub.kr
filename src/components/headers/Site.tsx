/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import InterestsOutlinedIcon from '@mui/icons-material/InterestsOutlined';
import InterestsRoundedIcon from '@mui/icons-material/InterestsRounded';
import LightModeIcon from '@mui/icons-material/LightMode';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import {
  Avatar,
  Box,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '../Anchor';
import AppIconAvatar from '../custom-ui/AppIconAvatar';
import BlogSearch from '../header-groups/site/BlogSearch';
import CommunitySearch from '../header-groups/site/CommunitySearch';
import NavManage from '../header-groups/site/NavManage';
import NavMenu from '../header-groups/site/NavMenu';
import NavPayments from '../header-groups/site/NavPayments';
import PrimaryMenu from '../header-groups/site/PrimaryMenu';
import NotificationButton from '../service/common/NotificationButton';
import { ServiceLogo } from '../Svgs';
import { type ThemeMode, useThemeMode } from '@/app/themeProvider';
import styles from '@/app/header.module.sass';

type SiteType = 'blog' | 'community';

type HeaderResponse = {
  siteName: string | null;
  siteLabel: string | null;
  siteType: SiteType | null;
  blogType: string | null;
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
  siteRoleLabels: string[];
  nickname: string | null;
  isApproval: boolean | null;
  invite: boolean;
  join: boolean;
  sessionCase?: string | null;
  isAuthor?: boolean;
  creatorHandleName?: string | null;
  userHandleName?: string | null;
  hasAffettoMyPosts?: boolean;
};

type UserProfile = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isLoggedIn: boolean;
  globalRole: string | null;
  siteRole: string | null;
  siteRoleLabels: string[];
  nickname: string | null;
  isApproval: boolean | null;
  invite: boolean;
  join: boolean;
  isAuthor?: boolean;
  creatorHandleName?: string | null;
  userHandleName?: string | null;
  hasAffettoMyPosts?: boolean;
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

const DEFAULT_BLOG_FONT_SETTINGS = {
  subjectFontFamily: 'neo',
  subjectLetterSpacing: -0.005,
  subjectLineHeight: 1.5,
  descriptionFontFamily: 'pre',
  descriptionLetterSpacing: -0.005,
  descriptionLineHeight: 1.5,
  descriptionFontSize: 16,
  descriptionMargin: 16,
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
  setCssVariable('--blog-subject-font-family', getBlogFontFamily(DEFAULT_BLOG_FONT_SETTINGS.subjectFontFamily));
  setCssVariable('--blog-subject-letter-spacing', `${DEFAULT_BLOG_FONT_SETTINGS.subjectLetterSpacing}em`);
  setCssVariable('--blog-subject-line-height', DEFAULT_BLOG_FONT_SETTINGS.subjectLineHeight);
  setCssVariable('--blog-description-font-family', getBlogFontFamily(DEFAULT_BLOG_FONT_SETTINGS.descriptionFontFamily));
  setCssVariable('--blog-description-letter-spacing', `${DEFAULT_BLOG_FONT_SETTINGS.descriptionLetterSpacing}em`);
  setCssVariable('--blog-description-line-height', DEFAULT_BLOG_FONT_SETTINGS.descriptionLineHeight);
  setCssVariable('--blog-description-font-size', `${DEFAULT_BLOG_FONT_SETTINGS.descriptionFontSize}px`);
  setCssVariable('--blog-description-margin', `${DEFAULT_BLOG_FONT_SETTINGS.descriptionMargin}px`);
}

function applyBlogFontSettings(siteType: SiteType | null, blogFontSettings: BlogFontSettings | null) {
  if (siteType !== 'blog') {
    clearBlogFontSettings();
    return;
  }

  document.documentElement.setAttribute('data-site-type', 'blog');

  setCssVariable(
    '--blog-subject-font-family',
    getBlogFontFamily(blogFontSettings?.subjectFontFamily ?? DEFAULT_BLOG_FONT_SETTINGS.subjectFontFamily),
  );
  setCssVariable(
    '--blog-subject-letter-spacing',
    `${blogFontSettings?.subjectLetterSpacing ?? DEFAULT_BLOG_FONT_SETTINGS.subjectLetterSpacing}em`,
  );
  setCssVariable('--blog-subject-line-height', blogFontSettings?.subjectLineHeight ?? DEFAULT_BLOG_FONT_SETTINGS.subjectLineHeight);

  setCssVariable(
    '--blog-description-font-family',
    getBlogFontFamily(blogFontSettings?.descriptionFontFamily ?? DEFAULT_BLOG_FONT_SETTINGS.descriptionFontFamily),
  );
  setCssVariable(
    '--blog-description-letter-spacing',
    `${blogFontSettings?.descriptionLetterSpacing ?? DEFAULT_BLOG_FONT_SETTINGS.descriptionLetterSpacing}em`,
  );
  setCssVariable(
    '--blog-description-line-height',
    blogFontSettings?.descriptionLineHeight ?? DEFAULT_BLOG_FONT_SETTINGS.descriptionLineHeight,
  );
  setCssVariable(
    '--blog-description-font-size',
    `${blogFontSettings?.descriptionFontSize ?? DEFAULT_BLOG_FONT_SETTINGS.descriptionFontSize}px`,
  );
  setCssVariable(
    '--blog-description-margin',
    `${blogFontSettings?.descriptionMargin ?? DEFAULT_BLOG_FONT_SETTINGS.descriptionMargin}px`,
  );
}

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

function isStaffRole(role: string | null) {
  return (
    role === 'owner' ||
    role === 'manager' ||
    role === 'community-manager' ||
    role === 'board-manager' ||
    role === 'board-general-manager' ||
    role === 'board-assistant-manager'
  );
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
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const { isReady } = useAuthState();
  const { themeMode, setThemeMode } = useThemeMode();

  const [isMounted, setIsMounted] = useState(false);
  const [themeModeAnchorElement, setThemeModeAnchorElement] = useState<null | HTMLElement>(null);
  const [profileAnchorElement, setProfileAnchorElement] = useState<null | HTMLElement>(null);
  const [siteType, setSiteType] = useState<SiteType | null>(null);
  const [blogType, setBlogType] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile>({
    name: null,
    email: null,
    avatarUrl: null,
    isLoggedIn: false,
    globalRole: null,
    siteRole: null,
    siteRoleLabels: [],
    nickname: null,
    isApproval: null,
    invite: false,
    join: false,
    isAuthor: false,
    creatorHandleName: null,
    userHandleName: null,
    hasAffettoMyPosts: false,
  });

  const [siteLabel, setSiteLabel] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [profileLogoUrl, setProfileLogoUrl] = useState<string | null>(null);

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isManagePage = pathname === `/${siteName}/manage` || pathname.startsWith(`/${siteName}/manage/`);
  const isPaymentPage = pathname === `/${siteName}/payments` || pathname.startsWith(`/${siteName}/payments/`);

  const lastScrollY = useRef(0);
  const [isUpScroll, setIsUpScroll] = useState(false);

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
    const search = searchParams.toString();
    const currentPath = search ? `${pathname}?${search}` : pathname;
    sessionStorage.setItem('route:returnPath', currentPath);
  }, [pathname, searchParams]);

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
        setBlogType(null);
        setUserProfile({
          name: null,
          email: null,
          avatarUrl: null,
          isLoggedIn: false,
          globalRole: null,
          siteRole: null,
          siteRoleLabels: [],
          nickname: null,
          isApproval: null,
          invite: false,
          join: false,
          isAuthor: false,
          creatorHandleName: null,
          userHandleName: null,
          hasAffettoMyPosts: false,
        });
        setSiteLabel('');
        setProfilePictureUrl(null);
        setProfileLogoUrl(null);
        return;
      }

      applyColorSet(result.themeType);
      applyBlogFontSettings(result.siteType, result.blogFontSettings);
      setSiteType(result.siteType);
      setBlogType(result.blogType);

      setUserProfile({
        name: result.userName,
        email: result.email,
        avatarUrl: result.avatar,
        isLoggedIn: result.isLoggedIn,
        globalRole: result.globalRole,
        siteRole: result.siteRole,
        siteRoleLabels: Array.isArray(result.siteRoleLabels) ? result.siteRoleLabels : [],
        nickname: result.nickname,
        isApproval: result.isApproval,
        invite: result.invite,
        join: result.join,
        isAuthor: result.isAuthor,
        creatorHandleName: result.creatorHandleName,
        userHandleName: result.userHandleName,
        hasAffettoMyPosts: result.hasAffettoMyPosts,
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
    setThemeModeAnchorElement(event.currentTarget);
  }

  function handleCloseThemeModeMenu() {
    setThemeModeAnchorElement(null);
  }

  function handleSelectThemeMode(nextThemeMode: ThemeMode) {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextThemeMode);
    setThemeMode(nextThemeMode);
    applyThemeMode(nextThemeMode);
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

  const isSiteStaff = userProfile.globalRole === 'admin' || isStaffRole(userProfile.siteRole);
  const isBlog = siteType === 'blog' ? true : false;

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
                    <Anchor
                      href={siteLabel ? `/${siteName}` : '/'}
                      aria-label={profileLogoUrl ? siteLabel : '데브허브 velhub'}
                    >
                      {siteLabel ? (
                        <>
                          {profileLogoUrl ? (
                            <Box component="img" src={profileLogoUrl} alt="" aria-hidden="true" />
                          ) : (
                            <>
                              {profilePictureUrl ? (
                                <AppIconAvatar src={profilePictureUrl || null} alt="" size={40} />
                              ) : null}
                              <span>{siteLabel}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <ServiceLogo />
                      )}
                    </Anchor>
                  </h1>
                  {siteLabel ? (
                    <>
                      <PrimaryMenu siteName={siteName} isBlog={isBlog} isSiteStaff={isSiteStaff} />
                      {siteType === 'blog' ? (
                        <BlogSearch siteName={siteName} isBlog={isBlog} />
                      ) : (
                        <CommunitySearch siteName={siteName} isBlog={isBlog} />
                      )}
                    </>
                  ) : null}
                </div>

                <div className={styles.iconbuttons}>
                  <IconButton onClick={handleOpenThemeModeMenu} className={styles['icon-button']}>
                    {renderThemeModeIcon()}
                  </IconButton>
                  <NotificationButton isMobile={false} />
                  <IconButton onClick={handleOpenProfileMenu}>
                    <Avatar
                      src={userProfile.avatarUrl || '/broken-image.jpg'}
                      alt={userProfile.name || ''}
                      sx={{ width: 24, height: 24 }}
                    />
                  </IconButton>
                </div>
              </div>
              {siteLabel ? (
                <div className={styles.bottom}>
                  {isManagePage && siteType ? (
                    <NavManage
                      siteName={siteName}
                      siteType={siteType}
                      isTeamBlog={blogType === 'team'}
                      isSiteStaff={isSiteStaff}
                      siteRole={userProfile.siteRole}
                      globalRole={userProfile.globalRole}
                    />
                  ) : isPaymentPage ? (
                    <NavPayments />
                  ) : (
                    <NavMenu siteName={siteName} isBlog={isBlog} />
                  )}
                </div>
              ) : null}
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
                    <Anchor
                      href={siteLabel ? `/${siteName}` : '/'}
                      aria-label={profileLogoUrl ? siteLabel : '데브허브 velhub'}
                    >
                      {siteLabel ? (
                        <>
                          {profileLogoUrl ? (
                            <Box component="img" src={profileLogoUrl} alt="" aria-hidden="true" />
                          ) : (
                            <>
                              {profilePictureUrl ? (
                                <AppIconAvatar src={profilePictureUrl || null} alt="" size={24} />
                              ) : null}
                              <span>{siteLabel}</span>
                            </>
                          )}
                        </>
                      ) : (
                        <ServiceLogo />
                      )}
                    </Anchor>
                  </h1>
                  {siteLabel ? (
                    <>
                      {isManagePage && siteType ? (
                        <NavManage
                          siteName={siteName}
                          siteType={siteType}
                          isTeamBlog={blogType === 'team'}
                          isSiteStaff={isSiteStaff}
                          siteRole={userProfile.siteRole}
                          globalRole={userProfile.globalRole}
                        />
                      ) : isPaymentPage ? (
                        <NavPayments />
                      ) : (
                        <NavMenu siteName={siteName} isBlog={isBlog} />
                      )}
                    </>
                  ) : null}
                </div>

                <div className={styles.iconbuttons}>
                  <IconButton onClick={handleOpenThemeModeMenu} className={styles['icon-button']}>
                    {renderThemeModeIcon()}
                  </IconButton>
                  <NotificationButton isMobile={false} />
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
            {userProfile.isLoggedIn && userProfile.join ? (
              <li className={styles['VhiMenu-profile']}>
                <AppIconAvatar src={profilePictureUrl || null} alt="" size={40} />
                <div className={styles['VhiMenu-profile-info']}>
                  <em>{siteLabel}</em>
                  <span>
                    {userProfile.isApproval === true
                      ? userProfile.nickname || userProfile.name
                      : userProfile.isApproval === false
                        ? '승인을 기다려요'
                        : userProfile.invite
                          ? '초대에 응해 주세요'
                          : null}
                  </span>
                  {userProfile.isApproval === true
                    ? userProfile.siteRoleLabels.map((siteRoleLabel) => (
                        <span key={siteRoleLabel}>{siteRoleLabel}</span>
                      ))
                    : null}
                </div>
              </li>
            ) : null}
            {userProfile.isLoggedIn && userProfile.join === false && siteType === 'community' ? (
              <li className={styles['VhiMenu-profile']}>
                <AppIconAvatar src={profilePictureUrl || null} alt="" size={40} />
                <div className={styles['VhiMenu-profile-info']}>
                  <em>{siteLabel}</em>
                  <span>가입해 주세요</span>
                  {userProfile.isApproval === true
                    ? userProfile.siteRoleLabels.map((siteRoleLabel) => (
                        <span key={siteRoleLabel}>{siteRoleLabel}</span>
                      ))
                    : null}
                </div>
              </li>
            ) : null}

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
                      {isBlog ? <MenuBookRoundedIcon fontSize="small" /> : <InterestsRoundedIcon fontSize="small" />}
                      <span>{isBlog ? '블로그' : '커뮤니티'} 홈</span>
                    </Anchor>
                  </MenuItem>,
                ]}

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
                  ...(userProfile.isAuthor
                    ? [
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
                        </MenuItem>,
                      ]
                    : []),
                  ...(userProfile.hasAffettoMyPosts
                    ? [
                        <MenuItem key="user-library" onClick={handleCloseProfileMenu}>
                          <Anchor
                            href={userProfile.userHandleName ? `/user/${userProfile.userHandleName}` : '/user/settings'}
                          >
                            <InterestsOutlinedIcon fontSize="small" />
                            <span>독자의 서재</span>
                          </Anchor>
                        </MenuItem>,
                      ]
                    : []),
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
