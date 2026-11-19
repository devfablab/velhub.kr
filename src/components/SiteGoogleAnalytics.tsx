'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Script from 'next/script';

type SiteGoogleAnalyticsProps = {
  measurementId: string;
};

type GoogleTag = (command: string, ...argumentsList: unknown[]) => void;

export default function SiteGoogleAnalytics({ measurementId }: SiteGoogleAnalyticsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isReady, setIsReady] = useState(false);
  const queryString = searchParams.toString();

  useEffect(() => {
    const googleTag = (window as Window & { gtag?: GoogleTag }).gtag;

    if (!isReady || typeof googleTag !== 'function') {
      return;
    }

    const pagePath = queryString ? `${pathname}?${queryString}` : pathname;

    googleTag('config', measurementId, {
      page_path: pagePath,
    });
  }, [isReady, measurementId, pathname, queryString]);

  return (
    <>
      <Script id={`google-analytics-init-${measurementId}`} strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          window.gtag = window.gtag || function () {
            window.dataLayer.push(arguments);
          };
          window.gtag('js', new Date());
        `}
      </Script>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`}
        strategy="afterInteractive"
        onReady={() => setIsReady(true)}
      />
    </>
  );
}
