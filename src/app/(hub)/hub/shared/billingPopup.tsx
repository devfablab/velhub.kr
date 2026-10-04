'use client';

import { ReactNode, useState } from 'react';
import { formatDateTimeDetail } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
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
  return formatDateTimeDetail(value) || '날짜 알 수 없음';
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
  const [refundError, setRefundError] = useState<{ title: string | null; message: string } | null>(null);

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
      setRefundError(null);

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
        if (response.status >= 500) {
          setRefundError({ title: null, message: '처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.' });
        } else {
          setRefundError({
            title: '후원 환불 확인',
            message: 'error' in result ? result.error : '환불 처리에 실패했습니다.',
          });
        }
        return;
      }

      window.location.reload();
    } catch {
      setRefundError({ title: null, message: '인터넷 연결을 확인한 뒤 다시 시도해 주세요.' });
    } finally {
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

      <FormErrorDialog
        open={Boolean(refundError)}
        title={refundError?.title ?? null}
        messages={refundError ? [refundError.message] : []}
        onClose={() => setRefundError(null)}
      />
    </>
  );
}
