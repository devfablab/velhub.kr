'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import { normalizeText } from '@/lib/utils';
import Anchor from '../Anchor';
import styles from '@/app/footer.module.sass';

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

export default function FooterSite() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [siteInfo, setSiteInfo] = useState<SiteInfo | null>(null);
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

  if (isLoading || errorMessage || !siteInfo) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={`content ${styles.content}`}>
          <div className={`${styles.loves} ${styles['loves-site']}`}>
            <p className={styles.copyright}>
              <span>&copy;</span> <strong>{siteInfo.site_label}</strong> <span>All rights reserved.</span>
            </p>
            <p className={styles.love}>
              <Anchor href="/" style={{ color: 'hotpink' }}>
                <FavoriteRoundedIcon /> <span>velhub</span>
              </Anchor>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
