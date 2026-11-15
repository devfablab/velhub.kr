'use client';

import SiteSearchAutocomplete from './SiteSearchAutocomplete';

type Props = {
  siteName: string;
  isBlog: boolean;
};

export default function CommunitySearch({ siteName, isBlog }: Props) {
  if (isBlog) {
    return null;
  }

  return (
    <SiteSearchAutocomplete
      historyKey={`site:${siteName}`}
      historyApiPath={`/api/search-histories/${siteName}`}
      searchPath={`/${siteName}/board`}
      legend="커뮤니티 검색폼"
      placeholder="글 전체 검색"
      ariaLabel="커뮤니티 검색어"
    />
  );
}
