'use client';

import { usePathname } from 'next/navigation';
import SiteSearchAutocomplete from '@/components/header-groups/site/SiteSearchAutocomplete';

type Props = {
  onNavigate?: () => void;
};

export default function LoungeSearch({ onNavigate }: Props) {
  const pathname = usePathname();

  return (
    <SiteSearchAutocomplete
      historyKey="lounge"
      historyApiPath="/api/search-histories"
      searchPath="/lounge/search"
      cancelHref="/"
      isCancelVisible={pathname === '/lounge/search'}
      minLength={2}
      onNavigate={onNavigate}
      legend="라운지 검색폼"
      placeholder="블로그, 커뮤니티 검색"
      ariaLabel="라운지 검색어"
    />
  );
}
