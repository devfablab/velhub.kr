'use client';

import { usePathname } from 'next/navigation';
import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

type SiteType = 'blog' | 'community';

type NavManageProps = {
  siteName: string;
  siteType: SiteType;
  siteRole: string | null;
  isSiteStaff: boolean;
};

type StaffNavItem = {
  label: string;
  href: string;
  startsWith?: boolean;
};

function isCurrentPath(pathname: string, item: StaffNavItem) {
  if (item.startsWith) {
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
  }

  return pathname === item.href;
}

function canAccessAllManageMenus(siteType: SiteType, siteRole: string | null) {
  if (siteType === 'blog') {
    return siteRole === 'owner' || siteRole === 'manager';
  }

  return siteRole === 'owner' || siteRole === 'community-manager';
}

export default function NavManage({ siteName, siteType, siteRole, isSiteStaff }: NavManageProps) {
  const pathname = usePathname();

  if (!isSiteStaff) {
    return null;
  }

  const showAllManageMenus = canAccessAllManageMenus(siteType, siteRole);

  const navItems: StaffNavItem[] = [
    ...(showAllManageMenus
      ? [
          {
            label: siteType === 'blog' ? '블로그 정보' : '커뮤니티 정보',
            href: `/${siteName}/manage/settings`,
            startsWith: true,
          },
        ]
      : []),
    ...(showAllManageMenus && siteType === 'community'
      ? [
          {
            label: '가입 관리',
            href: `/${siteName}/manage/join`,
            startsWith: true,
          },
        ]
      : []),
    ...(showAllManageMenus
      ? [
          {
            label: siteType === 'blog' ? '팀원 관리' : '멤버 관리',
            href: siteType === 'blog' ? `/${siteName}/manage/team` : `/${siteName}/manage/members`,
            startsWith: true,
          },
        ]
      : []),
    {
      label: '콘텐츠 관리',
      href: `/${siteName}/manage/contents`,
      startsWith: true,
    },
    ...(showAllManageMenus
      ? [
          {
            label: '신고 관리',
            href: `/${siteName}/manage/reports`,
            startsWith: true,
          },
          {
            label: '디자인',
            href: `/${siteName}/manage/design`,
            startsWith: true,
          },
          {
            label: '결제',
            href: `/${siteName}/manage/payments/billing`,
          },
          {
            label: '통계',
            href: `/${siteName}/manage/stats`,
            startsWith: true,
          },
        ]
      : []),
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
