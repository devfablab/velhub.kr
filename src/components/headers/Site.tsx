/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AppBar,
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
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { useParams } from 'next/navigation';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import LoginIcon from '@mui/icons-material/Login';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonIcon from '@mui/icons-material/Person';
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
import { getSupabaseBrowser } from '@/lib/supabase';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import Anchor from '../Anchor';

type SiteType = 'blog' | 'community';

type HeaderResponse = {
  siteName: string | null;
  siteType: SiteType | null;
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  themeMode: ThemeMode | null;
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

function normalizeText(value: string | string[] | undefined) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value[0]?.trim() ?? '';
  }

  return '';
}

function isStaffRole(role: string | null) {
  return role === 'owner' || role === 'manager';
}

export default function HeaderSite() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));
  const isMobile = !isNotMobile;

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

  const supabase = useMemo(() => getSupabaseBrowser(), []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

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
        setSiteType(null);
        setUserProfile({
          name: null,
          email: null,
          avatarUrl: null,
          isLoggedIn: false,
          globalRole: null,
          siteRole: null,
        });
        return;
      }

      setSiteType(result.siteType);

      setUserProfile({
        name: result.userName,
        email: result.email,
        avatarUrl: result.avatar,
        isLoggedIn: result.isLoggedIn,
        globalRole: result.globalRole,
        siteRole: result.siteRole,
      });

      if (result.themeMode) {
        setThemeMode(result.themeMode);
      }
    }

    void loadHeader();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async () => {
      await loadHeader();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [setThemeMode, siteName, supabase]);

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
    setThemeMode(nextThemeMode);
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

  if (!isMounted) {
    return null;
  }

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        color: 'text.primary',
        borderBottom: 1,
        borderColor: 'divider',
      }}
    >
      <Toolbar>
        <Box sx={{ flexGrow: 1 }}>
          <Anchor href={`/${siteName}`}>데브허브</Anchor>
        </Box>

        <IconButton color="inherit" onClick={handleOpenThemeModeMenu}>
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
          {userProfile.avatarUrl ? (
            <Avatar src={userProfile.avatarUrl} alt={userProfile.name || '프로필'} />
          ) : (
            <Avatar>
              <PersonIcon />
            </Avatar>
          )}
        </IconButton>

        {isMobile ? (
          <Drawer anchor="right" open={isProfileDrawerOpen} onClose={handleCloseProfileDrawer}>
            <Box sx={{ minWidth: 320, py: 1 }}>
              {userProfile.isLoggedIn && (
                <>
                  <Box sx={{ px: 2, py: 1 }}>
                    {userProfile.name ? <Typography>{userProfile.name}</Typography> : null}
                    {userProfile.email ? <Typography>{userProfile.email}</Typography> : null}
                  </Box>

                  <Divider />
                </>
              )}

              {isSiteStaff ? (
                <>
                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      <DashboardIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href={`/${siteName}/staff`} underline="none" sx={{ flex: '1 0 0%' }}>
                      관리 홈
                    </Link>
                  </MenuItem>

                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      {siteType === 'blog' ? <ArticleIcon fontSize="small" /> : <ForumIcon fontSize="small" />}
                    </ListItemIcon>
                    <Link href={`/${siteName}/manage`} underline="none" sx={{ flex: '1 0 0%' }}>
                      {siteType === 'blog' ? '블로그 운영' : '커뮤니티 운영'}
                    </Link>
                  </MenuItem>

                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      {siteType === 'blog' ? <FontDownloadIcon fontSize="small" /> : <MenuBookIcon fontSize="small" />}
                    </ListItemIcon>
                    <Link
                      href={
                        siteType === 'blog' ? `/${siteName}/design/blog/fonts` : `/${siteName}/design/community/menu`
                      }
                      underline="none"
                      sx={{ flex: '1 0 0%' }}
                    >
                      {siteType === 'blog' ? '블로그 폰트' : '커뮤니티 메뉴'}
                    </Link>
                  </MenuItem>

                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      <BarChartIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href={`/${siteName}/stats`} underline="none" sx={{ flex: '1 0 0%' }}>
                      통계
                    </Link>
                  </MenuItem>

                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      {siteType === 'blog' ? <GroupsIcon fontSize="small" /> : <PeopleIcon fontSize="small" />}
                    </ListItemIcon>
                    <Link
                      href={siteType === 'blog' ? `/${siteName}/team` : `/${siteName}/members`}
                      underline="none"
                      sx={{ flex: '1 0 0%' }}
                    >
                      {siteType === 'blog' ? '팀원 관리' : '멤버 관리'}
                    </Link>
                  </MenuItem>

                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      <ReportGmailerrorredIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href={`/${siteName}/filtered`} underline="none" sx={{ flex: '1 0 0%' }}>
                      제한된 콘텐츠
                    </Link>
                  </MenuItem>

                  <Divider />
                </>
              ) : null}

              {userProfile.isLoggedIn ? (
                <>
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
                </>
              ) : (
                <>
                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      <LoginIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href="/auth/sign-in" underline="none" sx={{ flex: '1 0 0%' }}>
                      로그인
                    </Link>
                  </MenuItem>

                  <MenuItem onClick={handleCloseProfileDrawer}>
                    <ListItemIcon>
                      <PersonAddIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href="/auth/sign-up" underline="none" sx={{ flex: '1 0 0%' }}>
                      회원가입
                    </Link>
                  </MenuItem>
                </>
              )}
            </Box>
          </Drawer>
        ) : (
          <Menu anchorEl={profileAnchorElement} open={Boolean(profileAnchorElement)} onClose={handleCloseProfileMenu}>
            {userProfile.isLoggedIn && (
              <Box sx={{ px: 2, py: 1 }}>
                {userProfile.name ? <Typography>{userProfile.name}</Typography> : null}
                {userProfile.email ? <Typography>{userProfile.email}</Typography> : null}
              </Box>
            )}

            {userProfile.isLoggedIn && <Divider />}

            {isSiteStaff
              ? [
                  <MenuItem key="staff-home" onClick={handleCloseProfileMenu}>
                    <ListItemIcon>
                      <DashboardIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href={`/${siteName}/staff`} underline="none" sx={{ flex: '1 0 0%' }}>
                      사이트 설정
                    </Link>
                  </MenuItem>,
                ]
              : null}

            {userProfile.isLoggedIn
              ? [
                  <MenuItem key="settings" onClick={handleCloseProfileMenu}>
                    <ListItemIcon>
                      <SettingsIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href="/settings" underline="none" sx={{ flex: '1 0 0%' }}>
                      개인 설정
                    </Link>
                  </MenuItem>,
                  <MenuItem key="lounge" onClick={handleCloseProfileMenu}>
                    <ListItemIcon>
                      <HomeIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href="/" underline="none" sx={{ flex: '1 0 0%' }}>
                      라운지 이동
                    </Link>
                  </MenuItem>,
                  <MenuItem key="logout" onClick={handleLogout}>
                    <ListItemIcon>
                      <LogoutIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>로그아웃</ListItemText>
                  </MenuItem>,
                ]
              : [
                  <MenuItem key="signin" onClick={handleCloseProfileMenu}>
                    <ListItemIcon>
                      <LoginIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href="/auth/sign-in" underline="none" sx={{ flex: '1 0 0%' }}>
                      로그인
                    </Link>
                  </MenuItem>,
                  <MenuItem key="signup" onClick={handleCloseProfileMenu}>
                    <ListItemIcon>
                      <PersonAddIcon fontSize="small" />
                    </ListItemIcon>
                    <Link href="/auth/sign-up" underline="none" sx={{ flex: '1 0 0%' }}>
                      회원가입
                    </Link>
                  </MenuItem>,
                ]}
          </Menu>
        )}
      </Toolbar>
    </AppBar>
  );
}
