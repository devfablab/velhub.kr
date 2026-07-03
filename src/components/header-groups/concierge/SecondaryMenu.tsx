'use client';

import { usePathname } from 'next/navigation';
import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

const secondaryMenus = [
  {
    href: '/concierge',
    label: '컨시어지 홈',
    exact: true,
  },
  {
    href: '/concierge/blog',
    label: '자주하는 질문',
  },
  {
    href: '/concierge/community',
    label: '신고센터',
  },
  {
    href: '/concierge/moments',
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
