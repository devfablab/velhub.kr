'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import Anchor from '@/components/Anchor';
import { normalizeText } from '@/lib/utils';
import styles from '@/app/header.module.sass';

type SiteType = 'blog' | 'community';

type HeaderSiteResponse = {
  siteName: string | null;
  siteType: SiteType | null;
  isLoggedIn: boolean;
  email: string | null;
  userName: string | null;
  avatar: string | null;
  themeMode: 'light' | 'system' | 'dark' | null;
  globalRole: string | null;
  siteRole: string | null;
  sessionCase?: string | null;
};

type StaffNavItem = {
  label: string;
  href: string;
  startsWith?: boolean;
};

function isStaffRole(role: string | null) {
  return role === 'owner' || role === 'manager';
}

function isCurrentPath(pathname: string, item: StaffNavItem) {
  if (item.startsWith) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return pathname === item.href;
}

export default function NavManage() {
  const params = useParams();
  const pathname = usePathname();

  const siteName = normalizeText(params.siteName);

  const [siteType, setSiteType] = useState<SiteType | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    async function loadHeader() {
      if (!siteName) {
        setIsReady(true);
        setIsAllowed(false);
        return;
      }

      const response = await fetch(`/api/header/site?siteName=${siteName}`, {
        method: 'GET',
        credentials: 'include',
      });

      const result = (await response.json()) as HeaderSiteResponse | { error?: string };

      if (!response.ok || !('siteRole' in result)) {
        setIsReady(true);
        setIsAllowed(false);
        return;
      }

      setSiteType(result.siteType);

      if (!isStaffRole(result.siteRole)) {
        setIsReady(true);
        setIsAllowed(false);
        return;
      }

      setIsAllowed(true);
      setIsReady(true);
    }

    void loadHeader();
  }, [siteName]);

  if (!isReady || !isAllowed || !siteName || !siteType) {
    return null;
  }

  const navItems: StaffNavItem[] = [
    {
      label: siteType === 'blog' ? '블로그 정보' : '커뮤니티 정보',
      href: `/${siteName}/manage/settings`,
      startsWith: true,
    },
    ...(siteType === 'community'
      ? [
          {
            label: '가입 관리',
            href: `/${siteName}/manage/join`,
            startsWith: true,
          },
        ]
      : []),
    {
      label: siteType === 'blog' ? '팀원 관리' : '멤버 관리',
      href: siteType === 'blog' ? `/${siteName}/manage/team` : `/${siteName}/manage/members`,
      startsWith: true,
    },
    {
      label: '콘텐츠 관리',
      href: `/${siteName}/manage/contents`,
      startsWith: true,
    },
    ...(siteType === 'community'
      ? [
          {
            label: '제한된 콘텐츠',
            href: `/${siteName}/manage/filtered`,
            startsWith: true,
          },
        ]
      : []),
    {
      label: '디자인',
      href: `/${siteName}/manage/design`,
      startsWith: true,
    },
    {
      label: '통계',
      href: `/${siteName}/manage/stats`,
      startsWith: true,
    },
  ];

  const homeHref = `/${siteName}/manage`;
  const isHomeCurrent = pathname === homeHref;

  return (
    <div className={styles.navigationbar}>
      <nav>
        <ol>
          <li className={isHomeCurrent ? styles.current : undefined} aria-current={isHomeCurrent ? 'page' : false}>
            <Anchor href={homeHref}>
              <span>관리 홈</span>
              <i />
            </Anchor>
          </li>
          {navItems.map((item) => {
            const isCurrent = isCurrentPath(pathname, item);
            return (
              <li key={item.href} className={isCurrent ? styles.current : undefined}>
                <Anchor href={item.href} aria-current={isCurrent ? 'page' : undefined}>
                  <span>{item.label}</span>
                  <i />
                </Anchor>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
