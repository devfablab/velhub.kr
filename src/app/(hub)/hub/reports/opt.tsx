'use client';

import { useEffect, useState } from 'react';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import { formatDateTimeDetail } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import styles from '@/app/hub.module.sass';

type ReportTarget = {
  name: string;
  href: string;
};

type ReportItem = {
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

type ReportsResponse = {
  items?: ReportItem[];
  error?: string;
};

function ReportTargetSummary({ item }: { item: ReportItem }) {
  const links = [
    item.site,
    item.board,
    item.post ? { name: item.post.title, href: item.post.href } : null,
  ].filter((target): target is ReportTarget => Boolean(target));

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

export default function Opt() {
  const [items, setItems] = useState<ReportItem[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadReports() {
      try {
        const response = await fetch('/api/hub/reports', {
          method: 'GET',
          credentials: 'include',
        });
        const result = (await response.json()) as ReportsResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '신고 내역을 불러오지 못했습니다.');
        }

        setItems(result.items ?? []);
      } catch (unknownError) {
        setErrorMessage(
          unknownError instanceof Error ? unknownError.message || '신고 내역을 불러오지 못했습니다.' : '신고 내역을 불러오지 못했습니다.',
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadReports();
  }, []);

  if (isLoading) {
    return null;
  }

  return (
    <section className={`paper ${styles.paper} ${styles.reports}`}>
      <div className={styles.headline}>
        <h2>신고 내역</h2>
        <Anchor href="/concierge/guideline" className="button medium action">
          신고센터로 이동
        </Anchor>
      </div>

      {errorMessage ? (
        <p className="alert error">
          <ErrorOutlineRoundedIcon />
          <span>{errorMessage}</span>
        </p>
      ) : null}

      {items.length === 0 ? (
        <p>접수한 신고가 없습니다.</p>
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
