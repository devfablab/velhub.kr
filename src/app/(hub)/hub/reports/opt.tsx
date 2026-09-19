'use client';

import { useState } from 'react';
import { formatDateTimeDetail } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/hub.module.sass';

type ReportTarget = {
  name: string;
  href: string;
};

export type ReportItem = {
  id: string;
  reportTypeLabel: string;
  targetTypeLabel: string;
  reportName: string;
  statusLabel: string;
  handlingResultLabel: string | null;
  createdAt: string;
  site: ReportTarget | null;
  board: ReportTarget | null;
  post: { title: string; href: string } | null;
  comment: { content: string } | null;
};

export type ReportsResponse = {
  items?: ReportItem[];
  error?: string;
};

function ReportTargetSummary({ item }: { item: ReportItem }) {
  const links = [item.site, item.board, item.post ? { name: item.post.title, href: item.post.href } : null].filter(
    (target): target is ReportTarget => Boolean(target),
  );

  if (links.length === 0 && !item.comment) {
    return null;
  }

  return (
    <p className={styles['report-target']}>
      {links.map((target, index) => (
        <span key={target.href}>
          {index > 0 ? ' / ' : null}
          <Anchor href={target.href}>{target.name}</Anchor>
        </span>
      ))}
      {item.comment ? `${links.length > 0 ? ' / ' : ''}댓글` : null}
    </p>
  );
}

export default function Opt({ initialItems, initialError }: { initialItems: ReportItem[]; initialError: string }) {
  const [items] = useState<ReportItem[]>(initialItems);
  const errorMessage = initialError;

  return (
    <section className={`paper ${styles.paper} ${styles.reports}`}>
      <div className={styles.headline}>
        <h2>신고관리</h2>
      </div>

      {errorMessage ? <ScreenState kind="error">{errorMessage}</ScreenState> : null}

      {items.length === 0 ? (
        <ScreenState>신고내역이 없습니다. 🙂</ScreenState>
      ) : (
        <ul className={styles['report-list']}>
          {items.map((item) => (
            <li key={item.id}>
              <div className={styles['report-heading']}>
                <strong>{item.reportTypeLabel}</strong>
                <span>{item.statusLabel}</span>
              </div>
              <p>{item.reportName}</p>
              <ReportTargetSummary item={item} />
              <time dateTime={item.createdAt}>{formatDateTimeDetail(item.createdAt)}</time>
              {item.handlingResultLabel ? <p className={styles['report-result']}>{item.handlingResultLabel}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
