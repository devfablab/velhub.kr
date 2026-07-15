/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
  Avatar,
  Box,
  Breadcrumbs,
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
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import { getSupabaseBrowser } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { detectAdult } from '@/lib/service/detectAdult.client';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import Anchor from '@/components/Anchor';
import DrawerMenu from '@/components/header-groups/site/DrawerMenu';
import DrawerManage from '@/components/header-groups/site/DrawerManage';
import DrawerPayments from '@/components/header-groups/site/DrawerPayments';
import BlogSearch from '@/components/header-groups/site/BlogSearch';
import CommunitySearch from '@/components/header-groups/site/CommunitySearch';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import styles from '@/app/header.module.sass';

type ContainerProps = {
  pageTitle?: string;
  pageBack?: string;
  pageEnterance?: boolean;
  menu?: 'contents' | 'design' | 'join' | 'members' | 'settings' | 'team' | 'payments' | 'stats' | 'reports';
  children: React.ReactNode;
};

type TabMenuItem = {
  href: string;
  label: string;
  startsWith?: boolean;
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
  nickname: string | null;
  isApproval: boolean | null;
  invite: boolean;
  join: boolean;
  sessionCase?: string | null;
};

type UserProfile = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isLoggedIn: boolean;
  globalRole: string | null;
  siteRole: string | null;
  nickname: string | null;
  isApproval: boolean | null;
  invite: boolean;
  join: boolean;
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

type BreadcrumbItem = {
  label: string;
  href?: string;
};

function createBreadcrumbItems(pathname: string): BreadcrumbItem[] {
  const segments = pathname.split('/').filter(Boolean);

  const siteName = segments[0];

  if (!siteName) {
    return [];
  }

  const contentsIndex = segments.indexOf('contents');

  if (contentsIndex === -1) {
    return [];
  }

  const basePath = `/${siteName}/manage/contents`;
  const rest = segments.slice(contentsIndex + 1);

  const section = rest[0];

  if (!section) {
    return [];
  }

  if (section === 'pages') {
    const contentId = rest[1];
    const action = rest[2];

    if (!contentId) {
      return [];
    }

    const items: BreadcrumbItem[] = [
      {
        label: '페이지 관리',
        href: `${basePath}/pages`,
      },
    ];

    if (contentId === 'new') {
      items.push({
        label: '페이지 생성',
      });

      return items;
    }

    items.push({
      label: action === 'edit' ? '페이지 보기' : '페이지 보기',
      href: action === 'edit' ? `${basePath}/pages/${contentId}` : undefined,
    });

    if (action === 'edit') {
      items.push({
        label: '페이지 수정',
      });
    }

    return items;
  }

  if (section === 'posts') {
    const second = rest[1];

    if (!second) {
      return [];
    }

    const items: BreadcrumbItem[] = [
      {
        label: '글 관리',
        href: `${basePath}/posts`,
      },
    ];

    if (second === 'new') {
      items.push({
        label: '글 쓰기',
      });

      return items;
    }

    if (second === 'category') {
      items.push({
        label: '카테고리 관리',
      });

      return items;
    }

    if (second === 'series') {
      items.push({
        label: '연재 관리',
      });

      return items;
    }

    if (second === 'c') {
      const boardName = rest[2];
      const third = rest[3];
      const fourth = rest[4];

      items.push({
        label: '게시판 목록',
        href: `${basePath}/posts/c`,
      });

      if (!boardName) {
        return items;
      }

      if (boardName === 'new') {
        items.push({
          label: '게시판 생성',
        });

        return items;
      }

      items.push({
        label: boardName,
        href: `${basePath}/posts/c/${boardName}`,
      });

      if (!third) {
        items.push({
          label: '글 목록',
        });

        return items;
      }

      if (third === 'new') {
        items.push({
          label: '글 쓰기',
        });

        return items;
      }

      if (third === 'edit') {
        items.push({
          label: '게시판 수정',
        });

        return items;
      }

      if (third === 'prefix') {
        items.push({
          label: '말머리 관리',
        });

        return items;
      }

      if (third === 'series') {
        items.push({
          label: '연재 관리',
        });

        return items;
      }

      items.push({
        label: fourth === 'edit' ? '글 보기' : '글 보기',
        href: fourth === 'edit' ? `${basePath}/posts/c/${boardName}/${third}` : undefined,
      });

      if (fourth === 'edit') {
        items.push({
          label: '글 수정',
        });
      }

      return items;
    }

    const contentId = second;
    const action = rest[2];

    items.push({
      label: action === 'edit' ? '글 보기' : '글 보기',
      href: action === 'edit' ? `${basePath}/posts/${contentId}` : undefined,
    });

    if (action === 'edit') {
      items.push({
        label: '글 수정',
      });
    }

    return items;
  }

  return [];
}

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

function getSiteRoleLabel(role: string) {
  if (role === 'owner') {
    return '운영자';
  }

  if (role === 'manager') {
    return '매니저';
  }

  if (role === 'community-manager') {
    return '커뮤니티 매니저';
  }

  if (role === 'board-manager') {
    return '전체 게시판 매니저';
  }

  if (role === 'board-general-manager') {
    return '개별 게시판 총괄 매니저';
  }

  if (role === 'board-assistant-manager') {
    return '개별 게시판 부 매니저';
  }

  if (role === 'member') {
    return '멤버';
  }

  return role;
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

function isCurrentTab(pathname: string, item: TabMenuItem) {
  if (item.startsWith) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return pathname === item.href;
}

export default function Container({ pageTitle, pageBack, pageEnterance, menu, children }: ContainerProps) {
  const params = useParams();
  const pathname = usePathname();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;
  const breadcrumbs = createBreadcrumbItems(pathname);

  const { isReady } = useAuthState();
  const { themeMode, setThemeMode } = useThemeMode();
  const [siteLabel, setSiteLabel] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(null);
  const [isAdult, setIsAdult] = useState<boolean>(false);

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
    nickname: null,
    isApproval: null,
    invite: false,
    join: false,
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
          nickname: null,
          isApproval: null,
          invite: false,
          join: false,
        });
        setSiteLabel('');
        setProfilePictureUrl('');
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
        nickname: result.nickname,
        isApproval: result.isApproval,
        invite: result.invite,
        join: result.join,
      });
      setSiteLabel(result.siteLabel || result.siteName || '');
      setProfilePictureUrl(result.profilePictureUrl);
      setIsAdult(await detectAdult(siteName));
    }

    if (!isReady) {
      return;
    }

    void loadHeader();
  }, [isReady, siteName]);

  function handleOpenProfileDrawer() {
    setIsProfileDrawerOpen(true);
  }

  function handleSelectThemeMode(nextThemeMode: ThemeMode) {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextThemeMode);
    setThemeMode(nextThemeMode);
    applyThemeMode(nextThemeMode);
  }

  function handleCloseProfileDrawer() {
    setIsProfileDrawerOpen(false);
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

  const isSiteStaff = isStaffRole(userProfile.siteRole);
  const isBlog = siteType === 'blog' ? true : false;
  function getTabMenuItems(menu: ContainerProps['menu'], siteName: string, isBlog: boolean): TabMenuItem[] {
    if (menu === 'contents') {
      return [
        { href: `/${siteName}/manage/contents/posts`, label: '글', startsWith: true },
        { href: `/${siteName}/manage/contents/pages`, label: '페이지', startsWith: true },
      ];
    }

    if (menu === 'design') {
      if (isBlog) {
        return [
          { href: `/${siteName}/manage/design/blog/fonts`, label: '기본 서체' },
          { href: `/${siteName}/manage/design/blog/comment`, label: '댓글' },
          { href: `/${siteName}/manage/design/blog/menu`, label: '메뉴' },
          { href: `/${siteName}/manage/design/blog/links`, label: '링크' },
        ];
      }

      return [
        { href: `/${siteName}/manage/design/community/home`, label: '홈 설정' },
        { href: `/${siteName}/manage/design/community/menu`, label: '메뉴 설정' },
      ];
    }

    if (menu === 'join') {
      return [
        { href: `/${siteName}/manage/join/conditions`, label: '가입정보' },
        { href: `/${siteName}/manage/join/approved`, label: '가입신청' },
        { href: `/${siteName}/manage/join/invite`, label: '초대관리' },
        { href: `/${siteName}/manage/join/banned`, label: '가입불가' },
        { href: `/${siteName}/manage/join/managers`, label: '매니저' },
      ];
    }

    if (menu === 'members') {
      return [
        { href: `/${siteName}/manage/members/entirety`, label: '활동멤버' },
        { href: `/${siteName}/manage/members/blocked`, label: '활동정지' },
        { href: `/${siteName}/manage/members/withdrawn`, label: '탈퇴멤버' },
        { href: `/${siteName}/manage/members/levels`, label: '멤버등급' },
      ];
    }

    if (menu === 'payments') {
      return [
        { href: `/${siteName}/manage/payments/billing`, label: '요금제' },
        { href: `/${siteName}/manage/payments/donation`, label: '후원' },
        ...(siteType === 'blog' ? [{ href: `/${siteName}/manage/payments/membership`, label: '멤버십' }] : []),
        { href: `/${siteName}/manage/payments/subscriptions`, label: '구독' },
      ];
    }

    if (menu === 'settings') {
      return [
        { href: `/${siteName}/manage/settings/general`, label: '기본설정' },
        { href: `/${siteName}/manage/settings/advanced`, label: '추가설정' },
      ];
    }

    if (menu === 'team') {
      return [
        { href: `/${siteName}/manage/team/members`, label: '팀원 목록' },
        { href: `/${siteName}/manage/team/info`, label: '팀원 정보', startsWith: true },
      ];
    }

    if (menu === 'stats') {
      return [
        { href: `/${siteName}/manage/stats/dashboard`, label: '대시보드' },
        ...(siteType === 'blog'
          ? [
              { href: `/${siteName}/manage/stats/hot-post`, label: '인기글 순위' },
              { href: `/${siteName}/manage/stats/repeat-visit`, label: '재방문율' },
            ]
          : [
              { href: `/${siteName}/manage/stats/join`, label: '가입자수' },
              { href: `/${siteName}/manage/stats/inactive-user`, label: '비활동 유저' },
            ]),
      ];
    }

    if (menu === 'reports') {
      return [
        { href: `/${siteName}/manage/reports/boards`, label: '게시판 신고' },
        { href: `/${siteName}/manage/reports/posts`, label: '게시물 신고' },
        { href: `/${siteName}/manage/reports/comments`, label: '댓글 신고' },
      ];
    }

    return [];
  }

  const tabMenuItems = getTabMenuItems(menu, siteName, isBlog);

  if (!isMounted || !isReady) {
    return null;
  }

  return (
    <>
      <header className={`${styles.appbar} ${isMobile ? '' : styles.hidden}`} aria-hidden={isMobile ? undefined : true}>
        {isMobile ? (
          <>
            <div className={styles.location}>
              {pageEnterance ? (
                <IconButton href={`/${siteName}`} aria-label={isBlog ? '블로그로 이동' : '커뮤니티로 이동'}>
                  <CloseRoundedIcon />
                </IconButton>
              ) : (
                <>
                  {pageBack ? (
                    <IconButton href={pageBack} aria-label="이전화면으로 이동">
                      <ArrowBackIosNewRoundedIcon />
                    </IconButton>
                  ) : null}
                </>
              )}
            </div>
            <h1>
              <span>
                {siteLabel} {pageEnterance ? null : '- 관리 홈 '}
              </span>
              {pageEnterance ? <strong>관리 홈</strong> : <strong>{pageTitle}</strong>}
            </h1>
            <div className={styles.iconbuttons}>
              <IconButton onClick={handleOpenProfileDrawer} sx={{ width: 40, height: 40 }}>
                <MoreHorizRoundedIcon />
              </IconButton>
              <Drawer
                anchor="right"
                open={isProfileDrawerOpen}
                onClose={handleCloseProfileDrawer}
                className={styles.VhiDrawer}
              >
                <Box role="presentation">
                  <List>
                    <li className={styles['VhiDrawer-header']}>
                      <strong>마이 메뉴</strong>
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
                          {userProfile.isApproval === true && userProfile.siteRole ? (
                            <span>{getSiteRoleLabel(userProfile.siteRole)}</span>
                          ) : null}
                        </div>
                      </li>
                    ) : null}
                    {userProfile.isLoggedIn && userProfile.join === false && siteType === 'community' ? (
                      <li className={styles['VhiMenu-profile']}>
                        <AppIconAvatar src={profilePictureUrl || null} alt="" size={40} />
                        <div className={styles['VhiMenu-profile-info']}>
                          <em>{siteLabel}</em>
                          <span>가입해 주세요</span>
                          {userProfile.isApproval === true && userProfile.siteRole ? (
                            <span>{getSiteRoleLabel(userProfile.siteRole)}</span>
                          ) : null}
                        </div>
                      </li>
                    ) : null}
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

                    <ListSubheader className={styles['VhiDrawer-subheader']}>서비스화면</ListSubheader>
                    <DrawerMenu siteName={siteName} isBlog={isBlog} onClose={handleCloseProfileDrawer} />

                    {isAdult ? (
                      <>
                        <ListSubheader className={styles['VhiDrawer-subheader']}>수익/정산</ListSubheader>
                        <DrawerPayments siteName={siteName} onClose={handleCloseProfileDrawer} />
                      </>
                    ) : null}

                    {isSiteStaff ? (
                      <>
                        <ListSubheader className={styles['VhiDrawer-subheader']}>
                          {isBlog ? '블로그' : '커뮤니티'} 관리
                        </ListSubheader>
                        <DrawerManage
                          siteName={siteName}
                          siteType={siteType}
                          siteRole={userProfile.siteRole}
                          onClose={handleCloseProfileDrawer}
                        />
                      </>
                    ) : null}

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
      <main style={{ marginTop: isMobile ? 47 : undefined }} className={styles.manage}>
        {tabMenuItems.length > 0 ? (
          <div className={`container ${styles.tabs}`}>
            <ul className="content">
              {tabMenuItems.map((item) => {
                const isCurrent = isCurrentTab(pathname, item);
                return (
                  <li
                    key={item.href}
                    className={isCurrent ? styles.current : undefined}
                    aria-current={isCurrent ? 'page' : undefined}
                  >
                    <Anchor href={item.href}>{item.label}</Anchor>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
        {isMobile ? null : (
          <>
            {breadcrumbs.length > 0 && (
              <div className={`container ${styles.breadcrumbs}`}>
                <Breadcrumbs
                  separator={<NavigateNextRoundedIcon fontSize="small" />}
                  aria-label="breadcrumb"
                  className="content"
                >
                  {breadcrumbs.map((item, index) => {
                    const isLast = index === breadcrumbs.length - 1;

                    if (isLast || !item.href) {
                      return <span key={`${item.label}-${index}`}>{item.label}</span>;
                    }

                    return (
                      <Anchor key={`${item.label}-${index}`} href={item.href}>
                        {item.label}
                      </Anchor>
                    );
                  })}
                </Breadcrumbs>
              </div>
            )}
          </>
        )}
        {children}
      </main>
    </>
  );
}
