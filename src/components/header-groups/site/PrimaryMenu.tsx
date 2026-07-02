'use client';

import { usePathname } from 'next/navigation';
import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

type Props = {
  siteName: string;
  isBlog: boolean;
  isSiteStaff: boolean;
};

type PaymentNavItem = {
  label: string;
  href: string;
  startsWith?: boolean;
};

function isPathMatched(pathname: string, item: PaymentNavItem) {
  if (!item.startsWith) {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function getCurrentHref(pathname: string, navItems: PaymentNavItem[]) {
  const matchedItems = navItems.filter((item) => isPathMatched(pathname, item));

  return matchedItems.sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;
}

export default function PrimaryMenu({ siteName, isBlog, isSiteStaff }: Props) {
  const pathname = usePathname();
  const navItems: PaymentNavItem[] = [
    {
      label: isBlog ? '블로그' : '커뮤니티',
      href: `/${siteName}`,
      startsWith: true,
    },
    ...(isSiteStaff
      ? [
          {
            label: '관리',
            href: `/${siteName}/manage`,
            startsWith: true,
          },
        ]
      : []),
    {
      label: '수익/정산',
      href: `/${siteName}/payments`,
      startsWith: true,
    },
  ];
  const currentHref = getCurrentHref(pathname, navItems);

  return (
    <ol className={styles.menu}>
      {navItems.map((item) => {
        const isCurrent = item.href === currentHref;

        return (
          <li key={item.href} className={isCurrent ? styles.current : undefined}>
            <Anchor href={item.href} aria-current={isCurrent ? 'page' : undefined}>
              {item.label}
            </Anchor>
          </li>
        );
      })}
    </ol>
  );
}
