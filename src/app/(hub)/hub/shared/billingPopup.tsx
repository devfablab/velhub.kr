'use client';

import { ReactNode, useState } from 'react';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Snackbar,
  Stack,
  useMediaQuery,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
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

  if (detail.status === 'refunded' || detail.status === 'partially_refunded') {
    return [{ label: '마지막 이용일', value: formatDateTime(detail.refundedAt) }];
  }

  if (detail.serviceEndsAt) {
    return [{ label: '서비스 종료일', value: formatDateTime(detail.serviceEndsAt) }];
  }

  return [{ label: '다음 결제일', value: formatDateTime(detail.nextBillingAt) }];
}

export default function BillingPopup({ paymentId, detail, children }: BillingPopupProps) {
  const isMobile = useMediaQuery('(max-width: 600px)');
  const [isOpen, setIsOpen] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const rows = [
    { label: '사이트', value: detail.siteLabel },
    ...(detail.targetLabel ? [{ label: '콘텐츠', value: detail.targetLabel }] : []),
    { label: '결제유형', value: detail.paymentTypeLabel },
    { label: '결제수단', value: detail.paymentMethodLabel },
    { label: '상태', value: detail.statusLabel },
    { label: '결제일', value: formatDateTime(detail.approvedAt ?? detail.createdAt) },
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

      {isMobile ? (
        <Drawer anchor="bottom" open={isOpen} onClose={handleClose} className="VhiDrawer-bottom">
          <h2>결제 상세</h2>
          <button className="close-button" onClick={handleClose}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            {content}
            <Stack direction="column" spacing={1.5}>
              {detail.detailType === 'donation' && detail.isRefundable ? (
                <button type="button" className="button medium cancel" onClick={handleRefund} disabled={isRefunding}>
                  환불받기
                </button>
              ) : null}
              <button type="button" className="button medium submit" onClick={handleClose}>
                확인
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={isOpen} onClose={handleClose} fullWidth maxWidth="xs" className="VhiDialog">
          <DialogTitle>결제 상세</DialogTitle>
          <button className="close-button" onClick={handleClose}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>{content}</DialogContent>
          <DialogActions>
            {detail.detailType === 'donation' && detail.isRefundable ? (
              <button type="button" className="button medium close" onClick={handleRefund} disabled={isRefunding}>
                환불받기
              </button>
            ) : null}
            <button type="button" className="button medium submit" onClick={handleClose}>
              확인
            </button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar
        open={Boolean(errorMessage)}
        message={errorMessage}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        autoHideDuration={2700}
        onClose={() => setErrorMessage('')}
      />
    </>
  );
}
