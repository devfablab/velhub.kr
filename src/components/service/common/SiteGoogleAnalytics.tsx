'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';

type SiteGoogleAnalyticsProps = {
  measurementId: string;
};

export default function SiteGoogleAnalytics({ measurementId }: SiteGoogleAnalyticsProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isReady, setIsReady] = useState(false);
  const queryString = searchParams.toString();

  useEffect(() => {
    if (!isReady || typeof window.gtag !== 'function') {
      return;
    }

    const pagePath = queryString ? `${pathname}?${queryString}` : pathname;

    window.gtag('config', measurementId, {
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
