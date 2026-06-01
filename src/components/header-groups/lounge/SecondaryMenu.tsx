'use client';

import { usePathname } from 'next/navigation';
import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

const secondaryMenus = [
  {
    href: '/',
    label: '데브허브 홈',
    exact: true,
  },
  {
    href: '/home/blogs',
    label: '블로그 허브',
  },
  {
    href: '/home/communities',
    label: '커뮤니티 허브',
  },
  {
    href: '/home/moments',
    label: '모먼트',
  },
];

export default function SecondaryMenu() {
  const pathname = usePathname();

  return (
    <div className={styles.navigationbar}>
      <nav>
        <ol>
          {secondaryMenus.map((menu) => {
            const isCurrent = menu.exact ? pathname === menu.href : pathname.startsWith(menu.href);

            return (
              <li
                key={menu.href}
                className={isCurrent ? styles.current : undefined}
                aria-current={isCurrent ? 'page' : undefined}
              >
                <Anchor href={menu.href}>
                  <span>{menu.label}</span>
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
