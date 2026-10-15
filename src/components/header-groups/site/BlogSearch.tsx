'use client';

import { type SubmitEventHandler, useEffect, useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

type Props = {
  siteName: string;
  isBlog: boolean;
};

export default function BlogSearch({ siteName, isBlog }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlKeyword = searchParams.get('keyword') ?? '';
  const [keyword, setKeyword] = useState(urlKeyword);
  const [isNavigating, startNavigation] = useTransition();

  useEffect(() => {
    setKeyword(urlKeyword);
  }, [urlKeyword]);

  function handleSubmit(event: Parameters<SubmitEventHandler<HTMLFormElement>>[0]) {
    event.preventDefault();

    const trimmedKeyword = keyword.trim();

    if (!isBlog || !siteName || !trimmedKeyword) {
      return;
    }

    startNavigation(() => router.push(`/${siteName}/b?keyword=${trimmedKeyword}`));
  }

  if (!isBlog) {
    return null;
  }

  return (
    <form onSubmit={handleSubmit} className="form">
      <fieldset className={styles.search}>
        <legend>블로그 검색폼</legend>
        <div className={styles['form-group']}>
          <div className={styles['form-control']}>
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.currentTarget.value)}
              placeholder="글 검색"
              aria-label="블로그 검색어"
            />
          </div>
          <button type="submit" disabled={!keyword.trim() || isNavigating} aria-label="검색">
            <SearchRoundedIcon />
          </button>
          <Anchor href={`/${siteName}/b`} aria-label="검색취소">
            <CloseRoundedIcon />
          </Anchor>
        </div>
      </fieldset>
    </form>
  );
}
