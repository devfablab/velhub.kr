'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useThemeMode, type ThemeMode } from '@/app/themeProvider';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];

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
  const [isSnackbarOpen, setIsSnackbarOpen] = useState(false);

  useEffect(() => {
    async function loadInfo() {
      try {
        setErrorMessage('');

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
          setErrorMessage(unknownError.message || '추가 설정 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('추가 설정 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadInfo();
  }, [router]);

  function handleThemeModeChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    if (nextValue !== 'light' && nextValue !== 'system' && nextValue !== 'dark') {
      return;
    }

    setLocalThemeMode(nextValue);
  }

  function handleAutoLoginChange(event: InputChangeEvent) {
    setAutoLogin(event.currentTarget.checked);
  }

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
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
      setIsSnackbarOpen(true);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '추가 설정 수정에 실패했습니다.');
      } else {
        setErrorMessage('추가 설정 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCloseSnackbar() {
    setIsSnackbarOpen(false);
  }

  if (isLoading) {
    return null;
  }

  return (
    <>
      <Paper elevation={0} sx={{ p: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h4" component="h1">
            추가 설정
          </Typography>

          <Stack spacing={1}>
            <FormLabel>테마 모드</FormLabel>
            <RadioGroup value={themeMode} onChange={handleThemeModeChange}>
              <FormControlLabel value="light" control={<Radio />} label="라이트" />
              <FormControlLabel value="system" control={<Radio />} label="시스템" />
              <FormControlLabel value="dark" control={<Radio />} label="다크" />
            </RadioGroup>
          </Stack>

          <Stack spacing={1}>
            <FormLabel>자동 로그인</FormLabel>
            <FormControlLabel
              control={<Switch checked={autoLogin} onChange={handleAutoLoginChange} />}
              label={autoLogin ? '사용함 (7일)' : '사용 안함 (24시간)'}
            />
          </Stack>

          <Button type="button" variant="contained" onClick={handleSubmit} disabled={isSubmitting}>
            수정 완료
          </Button>

          {errorMessage ? (
            <Alert severity="error" variant="filled">
              {errorMessage}
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      <Snackbar
        open={isSnackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseSnackbar} severity="success" sx={{ width: '100%' }}>
          설정 수정에 성공했습니다
        </Alert>
      </Snackbar>
    </>
  );
}
