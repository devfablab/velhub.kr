'use client';

import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

export default function PrimaryMenu() {
  return (
    <ol className={styles.menu}>
      <li className={styles.current}>
        <Anchor href="/concierge" aria-current="page">
          컨시어지
        </Anchor>
      </li>
      <li>
        <Anchor href="/heart2hearts">이용안내</Anchor>
      </li>
    </ol>
  );
}
