'use client';

import { type ReactNode, useMemo } from 'react';
import { createTheme, ThemeProvider, useTheme } from '@mui/material';

export default function DarkThemeProvider({ children }: { children: ReactNode }) {
  const parentTheme = useTheme();
  const darkTheme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: 'dark',
        },
        breakpoints: {
          values: parentTheme.breakpoints.values,
        },
        typography: parentTheme.typography,
        components: parentTheme.components,
      }),
    [parentTheme],
  );

  return <ThemeProvider theme={darkTheme}>{children}</ThemeProvider>;
}
