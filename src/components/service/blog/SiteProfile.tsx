'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import styles from '@/app/aside.module.sass';

type SiteInfo = {
  site_label: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  summary: string | null;
};

type SiteProfileResponse = {
  siteInfo?: SiteInfo;
  profilePictureUrl?: string;
  profileLogoUrl?: string;
  error?: string;
};

export default function SiteProfile() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [profileLogoUrl, setProfileLogoUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadSiteProfile() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/info/general/site/${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as SiteProfileResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '사이트 정보를 불러오지 못했습니다.');
        }

        if (!result.siteInfo) {
          throw new Error('사이트 정보를 불러오지 못했습니다.');
        }

        setSiteInfo(result.siteInfo);
        setProfilePictureUrl(normalizeText(result.profilePictureUrl));
        setProfileLogoUrl(normalizeText(result.profileLogoUrl));
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '사이트 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('사이트 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadSiteProfile();
  }, [siteName]);

  if (isLoading) {
    return (
      <div className="paper">
        <div className="loading-container">
          <LoadingIndicator />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return <div className="paper paper-error">{errorMessage}</div>;
  }

  if (!siteInfo) {
    return null;
  }

  return (
    <div className={styles['site-profile']}>
      <div className={styles['site-profile-avatar']}>
        <AppIconAvatar src={profilePictureUrl || null} alt={siteInfo.site_label || ''} size={72} />
      </div>
      <div className={styles['site-profile-info']}>
        {profileLogoUrl ? <img src={profileLogoUrl} alt="" /> : null}
        <strong>{siteInfo.site_label}</strong>
        {siteInfo.summary ? <p>{siteInfo.summary}</p> : null}
      </div>
    </div>
  );
}
