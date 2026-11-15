'use client';

import SiteSearchAutocomplete from './SiteSearchAutocomplete';

type Props = {
  siteName: string;
  isBlog: boolean;
};

export default function BlogSearch({ siteName, isBlog }: Props) {
  if (!isBlog) {
    return null;
  }

  return (
    <SiteSearchAutocomplete
      historyKey={`site:${siteName}`}
      historyApiPath={`/api/search-histories/${siteName}`}
      searchPath={`/${siteName}/b`}
      legend="블로그 검색폼"
      placeholder="글 검색"
      ariaLabel="블로그 검색어"
    />
  );
}
