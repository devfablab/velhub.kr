'use client';

import { type SubmitEventHandler, useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

type Props = {
  onNavigate?: () => void;
};

export default function LoungeSearch({ onNavigate }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword') ?? '';
  const [keyword, setKeyword] = useState(urlKeyword);
  const [isNavigating, startNavigation] = useTransition();
  const trimmedKeyword = keyword.trim();
  const isValidKeyword = trimmedKeyword.length >= 2;

  useEffect(() => {
    setKeyword(urlKeyword);
  }, [urlKeyword]);

  function handleSubmit(event: Parameters<SubmitEventHandler<HTMLFormElement>>[0]) {
    event.preventDefault();

    if (!isValidKeyword) {
      return;
    }

    onNavigate?.();
    startNavigation(() => router.push(`/lounge/search?keyword=${encodeURIComponent(trimmedKeyword)}`));
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <fieldset className={styles.search}>
        <legend>라운지 검색폼</legend>
        <div className={styles['form-group']}>
          <div className={styles['form-control']}>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.currentTarget.value)}
              placeholder="블로그, 커뮤니티 검색"
              aria-label="라운지 검색어"
              minLength={2}
            />
          </div>
          {keyword ? (
            <button
              type="button"
              className={styles['search-reset']}
              onClick={() => setKeyword('')}
              aria-label="검색어 지우기"
            >
              <CloseRoundedIcon />
            </button>
          ) : null}
          {pathname === '/lounge/search' ? (
            <Anchor href="/" aria-label="검색취소" onClick={onNavigate}>
              <CloseRoundedIcon />
            </Anchor>
          ) : null}
          <button
            type="submit"
            className={styles['search-submit']}
            disabled={!isValidKeyword || isNavigating}
            aria-label="검색"
          >
            <SearchRoundedIcon />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
