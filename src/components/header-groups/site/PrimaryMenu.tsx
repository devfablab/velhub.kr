'use client';

import Anchor from '@/components/Anchor';
import styles from '@/app/header.module.sass';

type Props = {
  siteName: string;
  isBlog: boolean;
  isSiteStaff: boolean;
};

export default function PrimaryMenu({ siteName, isBlog, isSiteStaff }: Props) {
  return (
    <ol className={styles.menu}>
      <li>
        <Anchor href={`/${siteName}`}>{isBlog ? '블로그' : '커뮤니티'}</Anchor>
      </li>
      {isSiteStaff ? (
        <li>
          <Anchor href={`/${siteName}/manage`}>관리</Anchor>
        </li>
      ) : null}
      <li>
        <Anchor href={`/${siteName}/payments`}>수익/정산</Anchor>
      </li>
    </ol>
  );
}
