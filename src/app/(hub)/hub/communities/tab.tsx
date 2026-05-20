'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import InterestsRoundedIcon from '@mui/icons-material/InterestsRounded';
import FavoriteBorderRoundedIcon from '@mui/icons-material/FavoriteBorderRounded';
import TurnedInNotRoundedIcon from '@mui/icons-material/TurnedInNotRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type ContainerProps = {
  children: ReactNode;
};

const tabs = [
  {
    href: '/hub/communities',
    label: '전체',
    icon: <InterestsRoundedIcon />,
  },
  {
    href: '/hub/communities/liked',
    label: '좋아요',
    icon: <FavoriteBorderRoundedIcon />,
  },
  {
    href: '/hub/communities/saved',
    label: '저장',
    icon: <TurnedInNotRoundedIcon />,
  },
  {
    href: '/hub/communities/reads',
    label: '읽은글',
    icon: <ScheduleRoundedIcon />,
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
