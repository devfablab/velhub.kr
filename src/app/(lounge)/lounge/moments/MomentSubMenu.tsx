'use client';

import { usePathname } from 'next/navigation';
import Anchor from '@/components/Anchor';
import styles from '@/app/page.module.sass';

const menus = [
  { href: '/lounge/moments', label: '뉴비 창작자' },
  { href: '/lounge/moments/creators', label: '크리에이터 모먼트' },
  { href: '/lounge/moments/owners', label: '오너 모먼트' },
];

export default function MomentSubMenu() {
  const pathname = usePathname();
  return (
    <div className={styles.tabs}>
      <ul className="content">
        {menus.map((menu) => {
          const isCurrent = pathname === menu.href;
          return (
            <li
              key={menu.href}
              aria-current={isCurrent ? 'page' : undefined}
              className={isCurrent ? styles.current : undefined}
            >
              <Anchor href={menu.href}>{menu.label}</Anchor>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
