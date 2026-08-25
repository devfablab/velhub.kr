'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DiscountRoundedIcon from '@mui/icons-material/DiscountRounded';
import LoyaltyRoundedIcon from '@mui/icons-material/LoyaltyRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded';
import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type ContainerProps = {
  children: ReactNode;
};

const tabs = [
  {
    href: '/hub/purchase',
    label: '전체',
    icon: <ReceiptLongRoundedIcon />,
  },
  {
    href: '/hub/purchase/donation',
    label: '후원',
    icon: <VolunteerActivismRoundedIcon />,
  },
  {
    href: '/hub/purchase/subscriptions',
    label: '구독',
    icon: <LoyaltyRoundedIcon />,
  },
  {
    href: '/hub/purchase/memberships',
    label: '멤버십',
    icon: <DiscountRoundedIcon />,
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
