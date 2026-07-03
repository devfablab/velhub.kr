'use client';

import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

export default function PrimaryMenu() {
  return (
    <ol className={styles.menu}>
      <li>
        <Anchor href="/concierge">컨시어지</Anchor>
      </li>
      <li>
        <Anchor href="/heart2hearts">이용안내</Anchor>
      </li>
    </ol>
  );
}
