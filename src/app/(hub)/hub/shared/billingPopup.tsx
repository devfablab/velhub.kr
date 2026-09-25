'use client';

import { ReactNode, useState } from 'react';
import PopupMessage from '@/components/PopupMessage';
import ResponsivePopup from './ResponsivePopup';
import styles from '@/app/hub.module.sass';

type BillingPopupDetailType = 'billing' | 'donation';

export type BillingPopupDetail = {
  detailType: BillingPopupDetailType;
  siteLabel: string;
  targetLabel: string | null;
  paymentTypeLabel: string;
  paymentMethodLabel: string;
  approvedAt: string | null;
  createdAt: string;
  status: string;
  statusLabel: string;
  amount: number;
  refundedAmount: number;
  orderNo: string | null;
  nextBillingAt: string | null;
  serviceEndsAt: string | null;
  refundedAt: string | null;
  refundableUntil: string | null;
  isRefundable: boolean;
  canRequestMinorCancellation?: boolean;
  canForceRefundForTest?: boolean;
  historyKind?: 'payment' | 'failed' | 'refund';
};

type BillingPopupProps = {
  paymentId: string;
  detail: BillingPopupDetail;
  children: ReactNode;
};

type RefundResponse =
  | {
      ok: true;
      status: string;
      refundedAmount: number;
      refundedAt: string;
    }
  | {
      error: string;
    };

function formatAmount(value: number) {
  return `${value.toLocaleString('ko-KR')}원`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getAmountLabel(detail: BillingPopupDetail) {
  if (detail.status === 'refunded' || detail.status === 'partially_refunded') {
    return formatAmount(detail.refundedAmount);
  }

  return formatAmount(detail.amount);
}

function getExtraRows(detail: BillingPopupDetail) {
  if (detail.detailType === 'donation') {
    return [{ label: '주문번호', value: detail.orderNo || '(알 수 없음)' }];
  }

  if (detail.historyKind) {
    return [];
  }

  if (detail.status === 'refunded' || detail.status === 'partially_refunded') {
    return [{ label: '마지막 이용일', value: formatDateTime(detail.refundedAt) }];
  }

  if (detail.serviceEndsAt) {
    return [{ label: '서비스 종료일', value: formatDateTime(detail.serviceEndsAt) }];
  }

  return [{ label: '다음 결제일', value: formatDateTime(detail.nextBillingAt) }];
}

export default function BillingPopup({ paymentId, detail, children }: BillingPopupProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const rows = [
    { label: '사이트', value: detail.siteLabel },
    ...(detail.targetLabel ? [{ label: '콘텐츠', value: detail.targetLabel }] : []),
    { label: '결제유형', value: detail.paymentTypeLabel },
    { label: '결제수단', value: detail.paymentMethodLabel },
    { label: '상태', value: detail.statusLabel },
    {
      label: detail.historyKind === 'refund' ? '환불일' : detail.historyKind === 'failed' ? '실패일' : '결제일',
      value: formatDateTime(
        detail.historyKind === 'refund'
          ? (detail.refundedAt ?? detail.approvedAt ?? detail.createdAt)
          : (detail.approvedAt ?? detail.createdAt),
      ),
    },
    ...getExtraRows(detail),
    { label: '금액', value: getAmountLabel(detail) },
  ];

  function handleClose() {
    setIsOpen(false);
  }

  async function handleRefund() {
    try {
      setIsRefunding(true);
      setErrorMessage('');

      const response = await fetch('/api/hub/purchase/donation/refund', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          paymentId,
          forceTestRefund: true,
        }),
      });

      const result = (await response.json()) as RefundResponse;

      if (!response.ok || 'error' in result) {
        throw new Error('error' in result ? result.error : '환불 처리에 실패했습니다.');
      }

      window.location.reload();
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '환불 처리에 실패했습니다.');
      } else {
        setErrorMessage('환불 처리에 실패했습니다.');
      }

      setIsRefunding(false);
    }
  }

  function handleMinorCancellationRequest() {
    window.location.assign(
      `/concierge/contact/inquiries/new?${new URLSearchParams({
        paymentId,
        inquiryType: 'minor_purchase_cancellation',
      }).toString()}`,
    );
  }

  const content = (
    <dl className={styles['detail-billing']}>
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)}>
        {children}
      </button>

      <ResponsivePopup
        open={isOpen}
        onClose={handleClose}
        title="결제 상세"
        maxWidth="xs"
        variant="content"
        actions={[
          ...(detail.detailType === 'donation' && detail.canForceRefundForTest
            ? [
                {
                  label: '테스트환경 강제 환불',
                  intent: 'warning' as const,
                  onClick: handleRefund,
                  disabled: isRefunding,
                },
              ]
            : []),
          ...(detail.detailType === 'donation' && !detail.canForceRefundForTest && detail.canRequestMinorCancellation
            ? [
                {
                  label: '청약취소 신청',
                  intent: 'action' as const,
                  onClick: handleMinorCancellationRequest,
                },
              ]
            : []),
          {
            label: '확인',
            intent: 'submit',
            onClick: handleClose,
          },
        ]}
      >
        {content}
      </ResponsivePopup>

      <PopupMessage
        open={Boolean(errorMessage)}
        message={errorMessage}
        onClose={() => setErrorMessage('')}
        kind="error"
      />
    </>
  );
}
