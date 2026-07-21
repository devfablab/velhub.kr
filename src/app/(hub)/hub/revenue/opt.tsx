'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Alert, FormControl, InputLabel, MenuItem, Select, Tab, Tabs } from '@mui/material';
import RevenueList from '@/app/(site)/[siteName]/payments/RevenueList';
import RevenueSummary from '@/app/(site)/[siteName]/payments/RevenueSummary';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import styles from '@/app/hub.module.sass';

type RevenueSite = {
  id: string;
  siteName: string;
  siteLabel: string;
  siteType: string | null;
};

type RevenueSitesResponse = {
  sites?: RevenueSite[];
  error?: string;
};

type RevenueListType = 'transactions' | 'refunds' | 'scheduled' | 'confirmed' | 'completed';
type RevenueView = 'summary' | RevenueListType;

const views: { value: RevenueView; label: string }[] = [
  { value: 'summary', label: '수익정산 홈' },
  { value: 'transactions', label: '전체 거래 내역' },
  { value: 'refunds', label: '전체 환불 내역' },
  { value: 'scheduled', label: '정산 예정' },
  { value: 'confirmed', label: '정산 확정' },
  { value: 'completed', label: '정산 완료' },
];

const filterKeys = ['page', 'rangeType', 'year', 'quarter', 'half', 'startYear', 'startMonth', 'endYear', 'endMonth'];

function isRevenueView(value: string | null): value is RevenueView {
  return views.some((view) => view.value === value);
}

function getSiteTypeLabel(siteType: string | null) {
  if (siteType === 'blog') {
    return '블로그';
  }

  if (siteType === 'community') {
    return '커뮤니티';
  }

  return null;
}

export default function RevenueHub() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<RevenueSite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const requestedSiteName = searchParams.get('siteName') ?? '';
  const selectedSiteName = useMemo(() => {
    if (sites.some((site) => site.siteName === requestedSiteName)) {
      return requestedSiteName;
    }

    return sites[0]?.siteName ?? '';
  }, [requestedSiteName, sites]);
  const requestedView = searchParams.get('view');
  const selectedView: RevenueView = isRevenueView(requestedView) ? requestedView : 'summary';

  useEffect(() => {
    async function loadSites() {
      try {
        const response = await fetch('/api/hub/revenue/sites', {
          method: 'GET',
          credentials: 'include',
        });
        const result = (await response.json()) as RevenueSitesResponse;

        if (!response.ok) {
          throw new Error(result.error || '수입/정산 사이트를 불러오지 못했습니다.');
        }

        setSites(Array.isArray(result.sites) ? result.sites : []);
        setErrorMessage('');
      } catch (unknownError) {
        setErrorMessage(
          unknownError instanceof Error ? unknownError.message : '수입/정산 사이트를 불러오지 못했습니다.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadSites();
  }, []);

  useEffect(() => {
    if (isLoading || !selectedSiteName || requestedSiteName === selectedSiteName) {
      return;
    }

    const nextSearchParams = new URLSearchParams(searchParams.toString());
    nextSearchParams.set('siteName', selectedSiteName);
    router.replace(`?${nextSearchParams.toString()}`);
  }, [isLoading, requestedSiteName, router, searchParams, selectedSiteName]);

  function updateSelection(key: 'siteName' | 'view', value: string) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    nextSearchParams.set(key, value);
    filterKeys.forEach((filterKey) => nextSearchParams.delete(filterKey));
    router.replace(`?${nextSearchParams.toString()}`);
  }

  return (
    <div className={`container ${styles['revenue-container']}`}>
      <div className={`content ${styles.content} ${styles['revenue-content']}`}>
        {isLoading ? (
          <div className="paper">
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        ) : null}

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}

        {!isLoading && !errorMessage && sites.length === 0 ? (
          <Alert severity="info">수입 또는 정산 내역이 있는 사이트가 없습니다.</Alert>
        ) : null}

        {!isLoading && !errorMessage && selectedSiteName ? (
          <>
            <section className={`paper ${styles['revenue-selector']}`}>
              <FormControl fullWidth size="small">
                <InputLabel id="revenue-site-select-label">사이트</InputLabel>
                <Select
                  labelId="revenue-site-select-label"
                  value={selectedSiteName}
                  label="사이트"
                  onChange={(event) => updateSelection('siteName', event.target.value)}
                >
                  {sites.map((site) => {
                    const siteTypeLabel = getSiteTypeLabel(site.siteType);

                    return (
                      <MenuItem key={site.id} value={site.siteName}>
                        {site.siteLabel}
                        {siteTypeLabel ? ` · ${siteTypeLabel}` : ''}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            </section>

            <Tabs
              value={selectedView}
              variant="scrollable"
              scrollButtons="auto"
              aria-label="수입 및 정산 내역"
              className={`paper ${styles['revenue-tabs']}`}
              onChange={(_event, value: RevenueView) => updateSelection('view', value)}
            >
              {views.map((view) => (
                <Tab key={view.value} value={view.value} label={view.label} />
              ))}
            </Tabs>

            {selectedView === 'summary' ? (
              <RevenueSummary siteName={selectedSiteName} apiPath="/api/hub/revenue/summary" />
            ) : (
              <RevenueList siteName={selectedSiteName} type={selectedView} apiBasePath="/api/hub/revenue" />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
