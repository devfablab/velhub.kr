/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { getSupabaseBrowser } from '@/lib/supabase';

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

function applyDocumentTheme(themeMode: ThemeMode) {
  if (typeof window === 'undefined') {
    return;
  }

  const resolvedMode = getResolvedMode(themeMode);

  document.documentElement.setAttribute('data-theme-mode', themeMode);
  document.documentElement.style.colorScheme = resolvedMode;

  if (resolvedMode === 'dark') {
    document.body.style.backgroundColor = '#121212';
    document.body.style.color = '#ffffff';
  } else {
    document.body.style.backgroundColor = '#ffffff';
    document.body.style.color = '#000000';
  }
}

export function useThemeMode() {
  return useContext(ThemeModeContext);
}

export default function ThemeProviderClient({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [isMounted, setIsMounted] = useState(false);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    const initialThemeMode = getStoredThemeMode();

    setThemeModeState(initialThemeMode);
    applyDocumentTheme(initialThemeMode);
    setIsMounted(true);

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    function handleSystemChange() {
      const storedThemeMode = getStoredThemeMode();

      if (storedThemeMode === 'system') {
        setThemeModeState('system');
        applyDocumentTheme('system');
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
    applyDocumentTheme(nextThemeMode);

    const supabase = getSupabaseBrowser();

    void (async () => {
      const userResult = await supabase.auth.getUser();

      if (userResult.error || !userResult.data.user) {
        return;
      }

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
    return createTheme({
      palette: {
        mode: getResolvedMode(themeMode),
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
