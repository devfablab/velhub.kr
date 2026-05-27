'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  FormLabel,
  Snackbar,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';
import { LoadingIndicator } from '@/components/LoadingIndicator';

type AdvancedUserResponse = {
  profile?: {
    theme_mode: ThemeMode;
    auto_login: boolean;
  };
  error?: string;
};

export default function Opt() {
  const router = useRouter();
  const { setThemeMode } = useThemeMode();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [themeMode, setLocalThemeMode] = useState<ThemeMode>('system');
  const [autoLogin, setAutoLogin] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);

  useEffect(() => {
    async function loadInfo() {
      try {
        setErrorMessage('');
        setSuccessMessage('');

        const response = await fetch('/api/info/advanced/user', {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as AdvancedUserResponse;

        if (response.status === 401) {
          router.replace('/');
          return;
        }

        if (!response.ok || !result.profile) {
          throw new Error(result.error ?? '추가 설정 정보를 불러오지 못했습니다.');
        }

        setLocalThemeMode(result.profile.theme_mode);
        setAutoLogin(result.profile.auto_login);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setIsSnackbarOpen(true);
          setErrorMessage(unknownError.message || '추가 설정 정보를 불러오지 못했습니다.');
        } else {
          setIsSnackbarOpen(true);
          setErrorMessage('추가 설정 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadInfo();
  }, [router]);

  function handleThemeModeChange(_event: React.MouseEvent<HTMLElement>, nextValue: ThemeMode | null) {
    if (!nextValue) {
      return;
    }

    setLocalThemeMode(nextValue);
  }

  function handleAutoLoginChange(event: React.ChangeEvent<HTMLInputElement>) {
    setAutoLogin(event.currentTarget.checked);
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setSuccessMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/info/advanced/user/edit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          theme_mode: themeMode,
          auto_login: autoLogin,
        }),
      });

      const result = (await response.json()) as AdvancedUserResponse;

      if (response.status === 401) {
        router.replace('/');
        return;
      }

      if (!response.ok) {
        throw new Error(result.error ?? '추가 설정 수정에 실패했습니다.');
      }

      setThemeMode(themeMode);
      setSuccessMessage('설정 수정에 성공했습니다');
      setIsSnackbarOpen(true);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setIsSnackbarOpen(true);
        setErrorMessage(unknownError.message || '추가 설정 수정에 실패했습니다.');
      } else {
        setIsSnackbarOpen(true);
        setErrorMessage('추가 설정 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCloseSnackbar() {
    setSuccessMessage('');
    setErrorMessage('');
    setIsSnackbarOpen(false);
  }

  if (isLoading) {
    return (
      <Stack sx={{ marginTop: 12 }} justifyContent="center" alignItems="center">
        <LoadingIndicator />
      </Stack>
    );
  }

  return (
    <Stack gap={3} sx={{ marginTop: 3 }}>
      <Stack gap={1}>
        <FormLabel>테마 모드</FormLabel>

        <Box sx={{ width: '100%' }}>
          <ToggleButtonGroup
            value={themeMode}
            exclusive
            onChange={handleThemeModeChange}
            fullWidth
            aria-label="테마 모드"
          >
            <ToggleButton value="light" aria-label="라이트모드">
              <Stack direction="row" gap={1} alignItems="center">
                <LightModeIcon fontSize="small" />
                <Typography>Light</Typography>
              </Stack>
            </ToggleButton>

            <ToggleButton value="system" aria-label="시스템설정">
              <Stack direction="row" gap={1} alignItems="center">
                <SettingsBrightnessIcon fontSize="small" />
                <Typography>System</Typography>
              </Stack>
            </ToggleButton>

            <ToggleButton value="dark" aria-label="다크모드">
              <Stack direction="row" gap={1} alignItems="center">
                <DarkModeIcon fontSize="small" />
                <Typography>Dark</Typography>
              </Stack>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Stack>

      <Stack gap={1}>
        <FormLabel>자동 로그인</FormLabel>
        <FormControlLabel
          control={<Switch checked={autoLogin} onChange={handleAutoLoginChange} />}
          label={autoLogin ? '사용함 (7일)' : '사용 안함 (24시간)'}
        />
      </Stack>

      <Button type="button" variant="contained" size="large" onClick={handleSubmit} disabled={isSubmitting}>
        수정 완료
      </Button>

      <Snackbar
        open={isSnackbarOpen}
        onClose={handleCloseSnackbar}
        autoHideDuration={2700}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        message={errorMessage ? undefined : successMessage || undefined}
      >
        {errorMessage ? (
          <Alert onClose={handleCloseSnackbar} severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : undefined}
      </Snackbar>
    </Stack>
  );
}
