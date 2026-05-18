'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
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
    href: '/hub/blogs',
    label: '전체',
    icon: <MenuBookRoundedIcon />,
  },
  {
    href: '/hub/blogs/liked',
    label: '좋아요',
    icon: <FavoriteBorderRoundedIcon />,
  },
  {
    href: '/hub/blogs/saved',
    label: '저장',
    icon: <TurnedInNotRoundedIcon />,
  },
  {
    href: '/hub/blogs/reads',
    label: '읽은글',
    icon: <ScheduleRoundedIcon />,
  },
];

export default function Container({ children }: ContainerProps) {
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
