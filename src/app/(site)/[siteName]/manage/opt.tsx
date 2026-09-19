'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import NavigateNextRoundedIcon from '@mui/icons-material/NavigateNextRounded';
import { getManageTabMenuItems, type ManageMenuKind } from '@/lib/manage/menu';
import { formatDateSimple, normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import ScreenState from '@/components/service/ScreenState';
import Container from './menu';
import styles from '@/app/manage.module.sass';

export type StaffResponse = {
  site?: {
    avatar: string | null;
    name: string | null;
    siteType: string;
    createdAt: string | null;
    ownerName: string | null;
  };
  stats?: {
    memberCount: number;
    postCount: number;
  };
  error?: string;
};

function canAccessAllManageMenus(siteType: string, siteRole: string | null, globalRole: string | null) {
  if (globalRole === 'admin') {
    return true;
  }

  if (siteType === 'blog') {
    return siteRole === 'owner' || siteRole === 'manager';
  }

  if (siteType === 'community') {
    return siteRole === 'owner' || siteRole === 'community-manager';
  }

  return false;
}

export default function Opt({ initialData, initialError }: { initialData: StaffResponse | null; initialError: string }) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const hasInitialData = useRef(Boolean(initialData));

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const [siteAvatar, setSiteAvatar] = useState<string | null>(initialData?.site?.avatar ?? null);
  const [siteType, setSiteType] = useState(initialData?.site?.siteType ?? '');
  const [siteNameText, setSiteNameText] = useState(initialData?.site?.name ?? '');
  const [siteCreatedAt, setSiteCreatedAt] = useState<string | null>(initialData?.site?.createdAt ?? null);
  const [ownerName, setOwnerName] = useState(initialData?.site?.ownerName ?? '');
  const [memberCount, setMemberCount] = useState(initialData?.stats?.memberCount ?? 0);
  const [postCount, setPostCount] = useState(initialData?.stats?.postCount ?? 0);
  const [siteRole, setSiteRole] = useState<string | null>(null);
  const [globalRole, setGlobalRole] = useState<string | null>(null);

  useEffect(() => {
    if (hasInitialData.current) return;
    async function loadData() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/manage?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as StaffResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '정보를 불러오지 못했습니다.');
        }

        if (result.site) {
          setSiteAvatar(result.site.avatar ?? null);
          setSiteNameText(result.site.name ?? '');
          setSiteType(result.site.siteType);
          setSiteCreatedAt(result.site.createdAt ?? null);
          setOwnerName(result.site.ownerName ?? '');
        }
        setMemberCount(result.stats?.memberCount ?? 0);
        setPostCount(result.stats?.postCount ?? 0);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    async function loadManager() {
      const response = await fetch(`/api/header/site?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok || !('isLoggedIn' in result)) {
        setSiteRole(null);
        setGlobalRole(null);
        return;
      }

      setSiteRole(result.siteRole);
      setGlobalRole(result.globalRole);
    }

    if (!siteName) {
      setErrorMessage('siteName이 유효하지 않습니다.');
      setIsLoading(false);
      return;
    }

    void loadData();
    void loadManager();
  }, [siteName]);

  const showAllManageMenus = canAccessAllManageMenus(siteType, siteRole, globalRole);
  const currentSiteType = siteType === 'blog' ? 'blog' : 'community';

  const menuGroups: ManageMenuKind[] = [
    ...(showAllManageMenus ? (['settings'] as ManageMenuKind[]) : []),
    ...(showAllManageMenus && siteType === 'community' ? (['join'] as ManageMenuKind[]) : []),
    ...(showAllManageMenus ? ([siteType === 'blog' ? 'team' : 'members'] as ManageMenuKind[]) : []),
    'contents',
    ...(showAllManageMenus ? (['reports', 'design', 'payments', 'stats'] as ManageMenuKind[]) : []),
  ];
  const tabItems = menuGroups.flatMap((menu) => getManageTabMenuItems(menu, siteName, currentSiteType));

  if (isLoading) {
    return (
      <Container pageEnterance>
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  if (errorMessage) {
    return (
      <Container pageEnterance>
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <ScreenState kind="error">{errorMessage || '사이트 정보를 불러오지 못했습니다'}</ScreenState>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageEnterance>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <div className={`paper ${styles.paper} ${styles.profile}`}>
            <AppIconAvatar src={siteAvatar || null} alt={siteNameText} size={72} />
            <div className={styles.info}>
              <p className={styles.text}>{siteNameText}</p>
              <p>SINCE {formatDateSimple(siteCreatedAt)}</p>
            </div>
          </div>

          <div className={`paper ${styles.paper} ${styles.stat}`}>
            <dl>
              <div>
                <dt>활동 멤버</dt>
                <dd>{memberCount} 명</dd>
              </div>
              <div>
                <dt>전체 글</dt>
                <dd>{postCount} 개</dd>
              </div>
            </dl>
          </div>
          <div className={`paper ${styles.paper} ${styles.menu}`}>
            <ul>
              {tabItems.map((tabItem) => (
                <li key={tabItem.href}>
                  <Anchor href={tabItem.href}>
                    <span>{tabItem.label}</span>
                    <NavigateNextRoundedIcon />
                  </Anchor>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Container>
  );
}
