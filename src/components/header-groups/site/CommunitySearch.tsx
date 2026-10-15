'use client';

import { type SubmitEventHandler, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import SearchIcon from '@mui/icons-material/Search';
import styles from '@/app/header.module.sass';

type Props = {
  siteName: string;
  isBlog: boolean;
};

export default function CommunitySearch({ siteName, isBlog }: Props) {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [isNavigating, startNavigation] = useTransition();

  function handleSubmit(event: Parameters<SubmitEventHandler<HTMLFormElement>>[0]) {
    event.preventDefault();

    const trimmedKeyword = keyword.trim();

    if (isBlog || !siteName || !trimmedKeyword) {
      return;
    }

    startNavigation(() => router.push(`/${siteName}/board?keyword=${trimmedKeyword}`));
  }

  if (isBlog) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <fieldset className={styles.search}>
        <legend>커뮤니티 검색폼</legend>
        <div className={styles['form-group']}>
          <div className={styles['form-control']}>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.currentTarget.value)}
              placeholder="글 전체 검색"
              aria-label="커뮤니티 검색어"
            />
          </div>
          <button type="submit" disabled={!keyword.trim() || isNavigating} aria-label="검색">
            <SearchIcon />
          </button>
        </div>
      </fieldset>
    </form>
  );
}
