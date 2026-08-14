'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import SettlementForm from '@/components/service/common/SettlementForm';
import styles from '@/app/payments.module.sass';

type RevenueSummaryResponse = {
  isAuthor?: boolean;
  isSettlementError?: boolean;
  hasData?: boolean;
  totalPaymentAmount: number;
  totalPaymentCount: number;
  todayPaymentAmount: number;
  todayPaymentCount: number;
  totalRefundAmount: number;
  totalRefundCount: number;
  todayRefundAmount: number;
  todayRefundCount: number;
};

type RevenueErrorResponse = {
  error: string;
};

type RevenueSummaryProps = {
  siteName?: string;
  apiPath?: string;
};

function isRevenueErrorResponse(value: RevenueSummaryResponse | RevenueErrorResponse): value is RevenueErrorResponse {
  return 'error' in value;
}

function formatAmount(value: number) {
  return `${value.toLocaleString('ko-KR')} 원`;
}

const summaryItems: {
  key: keyof RevenueSummaryResponse;
  label: string;
  format: (value: number) => string;
}[] = [
  { key: 'totalPaymentAmount', label: '총 결제액', format: formatAmount },
  { key: 'totalPaymentCount', label: '총 결제건', format: (value) => `${value.toLocaleString('ko-KR')} 건` },
  { key: 'todayPaymentAmount', label: '오늘 결제액', format: formatAmount },
  { key: 'todayPaymentCount', label: '오늘 결제건', format: (value) => `${value.toLocaleString('ko-KR')} 건` },
  { key: 'totalRefundAmount', label: '총 환불액', format: formatAmount },
  { key: 'totalRefundCount', label: '총 환불건', format: (value) => `${value.toLocaleString('ko-KR')} 건` },
  { key: 'todayRefundAmount', label: '오늘 환불액', format: formatAmount },
  { key: 'todayRefundCount', label: '오늘 환불건', format: (value) => `${value.toLocaleString('ko-KR')} 건` },
];

export default function RevenueSummary({
  siteName: siteNameProp,
  apiPath = '/api/revenue/summary',
}: RevenueSummaryProps = {}) {
  const params = useParams();
  const siteName = normalizeText(siteNameProp) || normalizeText(params.siteName);
  const [summary, setSummary] = useState<RevenueSummaryResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadSummary = useCallback(async () => {
    if (!siteName) {
      return;
    }

    setSummary(null);
    setErrorMessage('');

    const response = await fetch(`${apiPath}?siteName=${encodeURIComponent(siteName)}`, {
      method: 'GET',
      credentials: 'include',
    });
    const result = (await response.json()) as RevenueSummaryResponse | RevenueErrorResponse;

    if (!response.ok || isRevenueErrorResponse(result)) {
      setErrorMessage(isRevenueErrorResponse(result) ? result.error : '수익정산 홈 정보를 불러오지 못했습니다.');
      return;
    }

    setSummary(result);
    setErrorMessage('');
  }, [apiPath, siteName]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  if (errorMessage) {
    return (
      <div className={`container ${styles.container}`}>
        <div className={`${styles.content} content`}>
          <p className="alert error">
            <ErrorOutlineRoundedIcon />
            <span>{errorMessage}</span>
          </p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={`container ${styles.container}`}>
        <div className={`${styles.content} content`}>
          <div className={`paper ${styles.paper}`}>
            <div className="loading-container">
              <LoadingIndicator />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`container ${styles.container}`}>
      <div className={`content ${styles.content} ${styles['content-payments']}`}>
        {!summary.hasData ? (
          <>
            <p className="alert warning">
              <WarningAmberRoundedIcon />
              <span>
                {summary.isSettlementError
                  ? '정산 정보에 문제가 있습니다. 아래 양식에서 정산 정보를 올바르게 업데이트해 주세요.'
                  : summary.isAuthor === false
                    ? '작가가 아니어서 정산 데이터가 없습니다.'
                    : '정산 데이터가 없습니다.'}
              </span>
            </p>
            {summary.isSettlementError ? (
              <div className="paper" style={{ marginTop: '16px' }}>
                <SettlementForm onSuccess={() => void loadSummary()} />
              </div>
            ) : null}
          </>
        ) : (
          <div className={styles.summary}>
            {summaryItems.map((summaryItem) => (
              <div className="paper" key={summaryItem.key}>
                <Typography variant="subtitle2">{summaryItem.label}</Typography>
                <Typography variant="h6" component="p">
                  {summaryItem.format(Number(summary[summaryItem.key]) || 0)}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
