/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { type SubmitEventHandler, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { Autocomplete, Tooltip } from '@mui/material';
import Anchor from '@/components/Anchor';
import { useAuthState } from '@/components/auth/AuthStateProvider';
import styles from '@/app/header.module.sass';

type Props = {
  historyKey: string;
  historyApiPath: string;
  searchPath: string;
  cancelHref?: string;
  isCancelVisible?: boolean;
  minLength?: number;
  onNavigate?: () => void;
  legend: string;
  placeholder: string;
  ariaLabel: string;
};

const SEARCH_HISTORY_LIMIT = 10;

function getStorageKey(historyKey: string) {
  return `velhub-search-history:${historyKey}`;
}

function readStoredHistories(historyKey: string) {
  try {
    const storedValue = JSON.parse(window.localStorage.getItem(getStorageKey(historyKey)) ?? '[]') as unknown;
    return Array.isArray(storedValue) ? storedValue.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeStoredHistories(historyKey: string, histories: string[]) {
  try {
    window.localStorage.setItem(getStorageKey(historyKey), JSON.stringify(histories));
  } catch {
    return;
  }
}

export default function SiteSearchAutocomplete({
  historyKey,
  historyApiPath,
  searchPath,
  cancelHref,
  isCancelVisible,
  minLength = 1,
  onNavigate,
  legend,
  placeholder,
  ariaLabel,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword') ?? '';
  const { isAuthenticated } = useAuthState();
  const [keyword, setKeyword] = useState(urlKeyword);
  const [histories, setHistories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const loadedKeyReference = useRef('');

  useEffect(() => {
    setKeyword(urlKeyword);
  }, [urlKeyword]);

  async function loadHistories() {
    const loadKey = `${historyKey}:${isAuthenticated ? 'member' : 'guest'}`;

    if (loadedKeyReference.current === loadKey) {
      return;
    }

    loadedKeyReference.current = loadKey;

    if (!isAuthenticated) {
      setHistories(readStoredHistories(historyKey));
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(historyApiPath, {
        credentials: 'include',
        cache: 'no-store',
      });
      const result = (await response.json()) as { keywords?: string[] };

      if (!response.ok) {
        throw new Error();
      }

      setHistories(result.keywords ?? []);
    } catch {
      loadedKeyReference.current = '';
    } finally {
      setIsLoading(false);
    }
  }

  function saveHistory(searchKeyword: string) {
    const nextHistories = [searchKeyword, ...histories.filter((history) => history !== searchKeyword)].slice(
      0,
      SEARCH_HISTORY_LIMIT,
    );

    setHistories(nextHistories);

    if (!isAuthenticated) {
      writeStoredHistories(
        historyKey,
        [searchKeyword, ...readStoredHistories(historyKey).filter((history) => history !== searchKeyword)].slice(
          0,
          SEARCH_HISTORY_LIMIT,
        ),
      );
      return;
    }

    void fetch(historyApiPath, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ keyword: searchKeyword }),
    })
      .then((response) => (response.ok ? (response.json() as Promise<{ keywords?: string[] }>) : null))
      .then((result) => {
        if (result?.keywords) {
          setHistories(result.keywords);
        }
      })
      .catch(() => null);
  }

  function search(rawKeyword: string) {
    const trimmedKeyword = rawKeyword.trim();

    if (trimmedKeyword.length < minLength) {
      return;
    }

    setKeyword(trimmedKeyword);
    saveHistory(trimmedKeyword);
    onNavigate?.();
    startNavigation(() => router.push(`${searchPath}?keyword=${encodeURIComponent(trimmedKeyword)}`));
  }

  function handleSubmit(event: Parameters<SubmitEventHandler<HTMLFormElement>>[0]) {
    event.preventDefault();
    search(keyword);
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <fieldset className={styles.search}>
        <legend>{legend}</legend>
        <div className={styles['form-group']}>
          <Autocomplete
            freeSolo
            options={histories}
            loading={isLoading}
            loadingText="최근 검색어를 불러오는 중입니다."
            inputValue={keyword}
            onInputChange={(_, value) => setKeyword(value)}
            onOpen={() => void loadHistories()}
            onChange={(_, value, reason) => {
              if (reason === 'selectOption' && typeof value === 'string') {
                search(value);
              }
            }}
            renderOption={(optionProps, option) => {
              const { key, ...restOptionProps } = optionProps;

              return (
                <li
                  key={key}
                  {...restOptionProps}
                  className={`${restOptionProps.className ?? ''} ${styles['search-history']}`}
                >
                  <HistoryRoundedIcon fontSize="small" />
                  <span>{option}</span>
                </li>
              );
            }}
            className={styles['form-control']}
            renderInput={(parameters) => (
              <div ref={parameters.InputProps.ref}>
                <input
                  {...parameters.inputProps}
                  type="search"
                  placeholder={placeholder}
                  aria-label={ariaLabel}
                  minLength={minLength}
                />
              </div>
            )}
          />
          {keyword ? (
            <Tooltip title="검색어 지우기">
              <button type="button" className={styles['search-reset']} onClick={() => setKeyword('')}>
                <CloseRoundedIcon />
              </button>
            </Tooltip>
          ) : null}
          {(isCancelVisible ?? Boolean(urlKeyword)) ? (
            <Tooltip title="검색취소">
              <Anchor href={cancelHref ?? searchPath} onClick={onNavigate}>
                <CloseRoundedIcon />
              </Anchor>
            </Tooltip>
          ) : null}
          <Tooltip title="검색">
            <button
              type="submit"
              className={styles['search-submit']}
              disabled={keyword.trim().length < minLength || isNavigating}
            >
              <SearchRoundedIcon />
            </button>
          </Tooltip>
        </div>
      </fieldset>
    </form>
  );
}
