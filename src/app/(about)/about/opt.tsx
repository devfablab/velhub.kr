/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { type ThemeMode, useThemeMode } from '@/app/themeProvider';
import styles from '@/app/about.module.sass';

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

const navigationItems = [
  { id: 'space', label: '공간 고르기' },
  { id: 'features', label: '특장점' },
  { id: 'writing', label: '글쓰기' },
  { id: 'blog', label: '블로그' },
  { id: 'community', label: '커뮤니티' },
  { id: 'revenue', label: '수익' },
  { id: 'safety', label: '안심' },
  { id: 'activity', label: '내 활동' },
];

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

export default function Opt() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeId, setActiveId] = useState('');
  const { themeMode, setThemeMode } = useThemeMode();

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
    const revealElements = document.querySelectorAll<HTMLElement>('[data-reveal]');
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute('data-revealed', 'true');
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    function handleScroll() {
      const offset = window.innerHeight * 0.3;
      let currentId = '';

      for (const item of navigationItems) {
        const section = document.getElementById(item.id);

        if (section && section.getBoundingClientRect().top - offset <= 0) {
          currentId = item.id;
        }
      }

      setActiveId(currentId);
    }

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (!activeId) {
      return;
    }

    const chip = document.querySelector<HTMLAnchorElement>(`[data-navigation="${activeId}"]`);
    const list = chip?.parentElement?.parentElement;

    if (chip && list) {
      list.scrollTo({ left: chip.offsetLeft - list.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' });
    }
  }, [activeId]);

  return (
    <nav className={styles.navigation} aria-label="소개 목차">
      <ul>
        {navigationItems.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              data-navigation={item.id}
              className={activeId === item.id ? styles.active : undefined}
              aria-current={activeId === item.id ? 'true' : undefined}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
