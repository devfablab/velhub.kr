/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import BalanceOutlinedIcon from '@mui/icons-material/BalanceOutlined';
import BusinessCenterOutlinedIcon from '@mui/icons-material/BusinessCenterOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import InterestsOutlinedIcon from '@mui/icons-material/InterestsOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import LightModeIcon from '@mui/icons-material/LightMode';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import LoginOutlinedIcon from '@mui/icons-material/LoginOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
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
import { getSupabaseBrowser } from '@/lib/supabase';
import Anchor from '@/components/Anchor';
import SecondaryMenu from '@/components/header-groups/concierge/SecondaryMenu';
import NotificationButton from '@/components/service/common/NotificationButton';
import { ServiceLogo } from '@/components/Svgs';
import { useConciergeHeader } from '../ConciergeHeaderContext';
import { ThemeMode, useThemeMode } from '@/app/themeProvider';
import styles from '@/app/header.module.sass';

type ContainerProps = {
  children: React.ReactNode;
};

type UserProfile = {
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  isLoggedIn: boolean;
  globalRole: string | null;
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

export default function Container({ children }: ContainerProps) {
  const initialHeader = useConciergeHeader();
  const { themeMode, setThemeMode } = useThemeMode();
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const [isMounted, setIsMounted] = useState(false);
  const [isProfileDrawerOpen, setIsProfileDrawerOpen] = useState(false);
  const userProfile: UserProfile = {
    name: initialHeader?.userName ?? null,
    email: initialHeader?.email ?? null,
    avatarUrl: initialHeader?.avatar ?? null,
    isLoggedIn: initialHeader?.isLoggedIn ?? false,
    globalRole: initialHeader?.globalRole ?? null,
    isAuthor: initialHeader?.isAuthor ?? false,
    creatorHandleName: initialHeader?.creatorHandleName ?? null,
    userHandleName: initialHeader?.userHandleName ?? null,
    hasAffettoMyPosts: initialHeader?.hasAffettoMyPosts ?? false,
  };

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

  if (!isMounted) {
    return null;
  }

  return (
    <>
      {isMobile ? (
        <header
          className={`${styles.appbar} ${styles['header-appbar']} ${isMobile ? '' : styles.hidden}`}
          aria-hidden={isMobile ? undefined : true}
        >
          <div className={styles.top}>
            <h1>
              <Anchor href="/" aria-label="데브허브 velhub">
                <ServiceLogo />
              </Anchor>
            </h1>
            <div className={styles.iconbuttons}>
              <NotificationButton isMobile={true} />
              <IconButton
                onClick={handleOpenProfileDrawer}
                className={styles['theme-mode-button']}
                sx={{ width: 24, height: 24 }}
              >
                <Avatar
                  src={userProfile.avatarUrl || '/broken-image.jpg'}
                  alt={userProfile.name || ''}
                  sx={{ width: 24, height: 24 }}
                />
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

                <ListSubheader className={styles['VhiDrawer-subheader']}>컨시어지</ListSubheader>
                <MenuItem key="home" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/concierge">
                    <SupportAgentOutlinedIcon fontSize="small" />
                    <span>컨시어지 홈</span>
                  </Anchor>
                </MenuItem>
                <MenuItem key="faqs" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/concierge/faqs">
                    <QuestionAnswerOutlinedIcon fontSize="small" />
                    <span>자주하는 질문</span>
                  </Anchor>
                </MenuItem>
                <MenuItem key="guideline" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/concierge/guideline">
                    <GavelOutlinedIcon fontSize="small" />
                    <span>가이드라인</span>
                  </Anchor>
                </MenuItem>
                <MenuItem key="help" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/concierge/help">
                    <ReportOutlinedIcon fontSize="small" />
                    <span>신고센터</span>
                  </Anchor>
                </MenuItem>
                <MenuItem key="contact" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/concierge/contact">
                    <MailOutlineIcon fontSize="small" />
                    <span>문의하기</span>
                  </Anchor>
                </MenuItem>
                <MenuItem key="partnerships" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/concierge/partnerships">
                    <BusinessCenterOutlinedIcon fontSize="small" />
                    <span>제휴 제안</span>
                  </Anchor>
                </MenuItem>
                <MenuItem key="rights" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/concierge/rights">
                    <ShieldOutlinedIcon fontSize="small" />
                    <span>권리보호센터</span>
                  </Anchor>
                </MenuItem>
                <MenuItem key="explains" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/concierge/explains">
                    <BalanceOutlinedIcon fontSize="small" />
                    <span>소명센터</span>
                  </Anchor>
                </MenuItem>
                {userProfile.globalRole === 'admin' ? (
                  <>
                    <MenuItem key="inquiries" onClick={handleCloseProfileDrawer}>
                      <Anchor href="/concierge/inquiries">
                        <SupportAgentOutlinedIcon fontSize="small" />
                        <span>문의 내역</span>
                      </Anchor>
                    </MenuItem>
                    <MenuItem key="reports" onClick={handleCloseProfileDrawer}>
                      <Anchor href="/concierge/reports">
                        <ReportOutlinedIcon fontSize="small" />
                        <span>신고 내역</span>
                      </Anchor>
                    </MenuItem>
                  </>
                ) : null}
                <ListSubheader className={styles['VhiDrawer-subheader']}>기타</ListSubheader>
                {userProfile.isLoggedIn
                  ? [
                      ...(userProfile.isAuthor
                        ? [
                            <MenuItem key="creator-library" onClick={handleCloseProfileDrawer}>
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
                            <MenuItem key="user-library" onClick={handleCloseProfileDrawer}>
                              <Anchor
                                href={
                                  userProfile.userHandleName ? `/user/${userProfile.userHandleName}` : '/user/settings'
                                }
                              >
                                <InterestsOutlinedIcon fontSize="small" />
                                <span>독자의 서재</span>
                              </Anchor>
                            </MenuItem>,
                          ]
                        : []),
                      <MenuItem key="settings" onClick={handleCloseProfileDrawer}>
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
                      <MenuItem key="hub" onClick={handleCloseProfileDrawer}>
                        <Anchor href="/hub">
                          <HubOutlinedIcon fontSize="small" />
                          <span>마이허브</span>
                        </Anchor>
                      </MenuItem>,
                    ]
                  : [
                      <MenuItem key="signin" onClick={handleCloseProfileDrawer}>
                        <Anchor href="/auth/sign-in">
                          <LoginOutlinedIcon fontSize="small" />
                          <span>로그인</span>
                        </Anchor>
                      </MenuItem>,
                      <MenuItem key="signup" onClick={handleCloseProfileDrawer}>
                        <Anchor href="/auth/sign-up">
                          <InterestsOutlinedIcon fontSize="small" />
                          <span>회원가입</span>
                        </Anchor>
                      </MenuItem>,
                    ]}
                <MenuItem key="lounge" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/">
                    <HomeOutlinedIcon fontSize="small" />
                    <span>라운지 이동</span>
                  </Anchor>
                </MenuItem>
                <MenuItem key="heart2hearts" onClick={handleCloseProfileDrawer}>
                  <Anchor href="/luvelhub">
                    <LightbulbOutlinedIcon fontSize="small" />
                    <span>이용안내</span>
                  </Anchor>
                </MenuItem>
              </Drawer>
            </div>
          </div>
          <div className={styles.bottom}>
            <SecondaryMenu isAdmin={userProfile.globalRole === 'admin'} />
          </div>
        </header>
      ) : (
        <header hidden aria-hidden />
      )}
      <main style={{ marginTop: isMobile ? 84 : undefined }}>{children}</main>
    </>
  );
}
