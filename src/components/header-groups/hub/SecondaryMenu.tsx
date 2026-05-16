'use client';

import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

export default function SecondaryMenu() {
  return (
    <div className={styles.navigationbar}>
      <nav>
        <ol>
          <li className={styles.current} aria-current="page">
            <Anchor href="/hub">
              <span>마이허브 홈</span>
              <i />
            </Anchor>
          </li>
          <li>
            <Anchor href="/hub/blogs">
              <span>블로그 허브</span>
              <i />
            </Anchor>
          </li>
          <li>
            <Anchor href="/hub/communities">
              <span>커뮤니티 허브</span>
              <i />
            </Anchor>
          </li>
          <li>
            <Anchor href="/hub/purchase">
              <span>구입내역</span>
              <i />
            </Anchor>
          </li>
          <li>
            <Anchor href="/hub/notifications">
              <span>알림내역</span>
              <i />
            </Anchor>
          </li>
        </ol>
      </nav>
    </div>
  );
}
