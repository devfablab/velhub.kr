/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { useAuthState } from '@/components/auth/AuthStateProvider';

export type ThemeMode = 'light' | 'system' | 'dark';

type ThemeModeContextValue = {
  themeMode: ThemeMode;
  setThemeMode: (nextThemeMode: ThemeMode) => void;
};

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

const ThemeModeContext = createContext<ThemeModeContextValue>({
  themeMode: 'system',
  setThemeMode: () => {},
});

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

function getStoredThemeMode() {
  if (typeof window === 'undefined') {
    return 'system' as ThemeMode;
  }

  const storedValue = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (isThemeMode(storedValue)) {
    return storedValue;
  }

  return 'system' as ThemeMode;
}

function getResolvedMode(themeMode: ThemeMode) {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

export default function ThemeProviderClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isAuthenticated } = useAuthState();

  const [isMounted, setIsMounted] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    const initialThemeMode = getStoredThemeMode();
    setThemeModeState(initialThemeMode);
    setIsMounted(true);

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    function handleSystemChange() {
      if (getStoredThemeMode() === 'system') {
        setThemeModeState('system');
      }
    }

    mediaQueryList.addEventListener('change', handleSystemChange);
    return () => {
      mediaQueryList.removeEventListener('change', handleSystemChange);
    };
  }, []);

  function setThemeMode(nextThemeMode: ThemeMode) {
    window.localStorage.setItem(THEME_MODE_STORAGE_KEY, nextThemeMode);
    setThemeModeState(nextThemeMode);

    if (!isAuthenticated) {
      return;
    }

    void (async () => {
      try {
        await fetch('/api/theme-mode', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            themeMode: nextThemeMode,
          }),
        });
      } catch {
        return;
      }
    })();
  }

  const theme = useMemo(() => {
    const mode = getResolvedMode(themeMode);

    return createTheme({
      palette: {
        mode,
      },
      typography: {
        fontFamily: 'var(--pre)',
      },
      components: {
        MuiTypography: {
          styleOverrides: {
            h1: {
              fontFamily: 'var(--neo)',
              fontWeight: 600,
              fontVariationSettings: '"wght" 600',
            },
            h2: {
              fontFamily: 'var(--neo)',
              fontWeight: 600,
              fontVariationSettings: '"wght" 600',
            },
            h3: {
              fontFamily: 'var(--neo)',
              fontWeight: 700,
              fontVariationSettings: '"wght" 700',
            },
            h4: {
              fontFamily: 'var(--neo)',
              fontWeight: 700,
              fontVariationSettings: '"wght" 700',
            },
            h5: {
              fontFamily: 'var(--neo)',
              fontWeight: 700,
              fontVariationSettings: '"wght" 700',
            },
            h6: {
              fontFamily: 'var(--neo)',
              fontWeight: 700,
              fontVariationSettings: '"wght" 700',
            },
            subtitle1: {
              fontFamily: 'var(--neo)',
              fontWeight: 400,
              fontVariationSettings: '"wght" 400',
            },
            subtitle2: {
              fontFamily: 'var(--neo)',
              fontWeight: 700,
              fontVariationSettings: '"wght" 700',
            },
            body1: {
              fontFamily: 'var(--pre)',
              fontWeight: 400,
              fontVariationSettings: '"wght" 400',
            },
            body2: {
              fontFamily: 'var(--pre)',
              fontWeight: 400,
              fontVariationSettings: '"wght" 400',
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            head: {
              fontFamily: 'var(--neo)',
              fontWeight: 700,
              fontVariationSettings: '"wght" 700',
            },
          },
        },
        MuiFormLabel: {
          styleOverrides: {
            root: {
              fontFamily: 'var(--neo)',
              fontWeight: 600,
              fontVariationSettings: '"wght" 600',
            },
          },
        },
      },
    });
  }, [themeMode]);

  const contextValue = useMemo(
    () => ({
      themeMode,
      setThemeMode,
    }),
    [themeMode],
  );

  if (!isMounted) {
    return null;
  }

  return (
    <ThemeModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}
