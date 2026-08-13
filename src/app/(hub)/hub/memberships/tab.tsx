'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import CardGiftcardRoundedIcon from '@mui/icons-material/CardGiftcardRounded';
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded';
import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type ContainerProps = {
  children: ReactNode;
};

const tabs = [
  {
    href: '/hub/memberships/plans',
    label: '멤버십 관리',
    icon: <CardGiftcardRoundedIcon />,
  },
  {
    href: '/hub/memberships/selectors',
    label: '라운지 노출 대상 선택',
    icon: <PlaylistAddCheckRoundedIcon />,
  },
];

export default function Content({ children }: ContainerProps) {
  const pathname = usePathname();
  return (
    <div className={`content ${styles.content} ${styles['hub-content']}`}>
      <ol className="paper">
        {tabs.map((tab) => {
          const isCurrent = pathname === tab.href;
          return (
            <li
              key={tab.href}
              className={isCurrent ? styles.current : undefined}
              aria-label={tab.label}
              aria-current={isCurrent ? 'page' : undefined}
            >
              <Anchor href={tab.href}>{tab.icon}</Anchor>
            </li>
          );
        })}
      </ol>
      {children}
    </div>
  );
}
