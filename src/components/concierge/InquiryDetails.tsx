import { Stack, Typography } from '@mui/material';
import { inquirySubtypes, type InquiryType } from '@/lib/concierge/inquiries';
import { formatDateTimeDetail } from '@/lib/utils';
import Anchor from '@/components/Anchor';

type BugDetail = {
  page_url: string;
  occurred_at: string;
  attempted_action: string;
  actual_behavior: string;
  recurrence: string;
  error_message: string | null;
  browser_name: string | null;
  browser_version: string | null;
  operating_system: string | null;
  device_type: string | null;
  viewport_width: number | null;
  viewport_height: number | null;
};

type PaymentDetail = {
  occurred_at: string;
  attempted_product: string | null;
  attempted_amount: number | null;
  displayed_message: string | null;
  actual_behavior: string;
  payment_snapshot: Record<string, unknown> | null;
};

type LinkedPayment = {
  order_no: string | null;
  amount: number | null;
  payment_method: string | null;
  status: string | null;
  approved_at: string | null;
  refunded_amount: number | null;
  refunded_at: string | null;
};

type Props = {
  inquiryType: InquiryType;
  inquirySubtype: string | null;
  content: string;
  bugDetails?: BugDetail | BugDetail[] | null;
  paymentDetails?: PaymentDetail | PaymentDetail[] | null;
  linkedPayment?: LinkedPayment | LinkedPayment[] | null;
  paymentLabel?: string | null;
  evidenceUrl?: string | null;
};

const recurrenceLabels: Record<string, string> = {
  always: '항상 발생',
  often: '자주 발생',
  sometimes: '가끔 발생',
  once: '한 번만 발생',
};

const paymentStatusLabels: Record<string, string> = {
  ready: '결제 대기',
  paid: '결제 완료',
  failed: '결제 실패',
  canceled: '결제 취소',
  cancelled: '결제 취소',
  refunded: '환불 완료',
  partially_refunded: '부분 환불',
};

const paymentMethodLabels: Record<string, string> = {
  card: '카드',
  vbank: '가상계좌',
  trans: '계좌이체',
  phone: '휴대폰 소액결제',
  easy_pay: '간편결제',
};

function one<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function Detail({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <Stack gap={0.5}>
      <Typography variant="subtitle2">{label}</Typography>
      <Typography variant="body2" whiteSpace="pre-wrap" sx={{ overflowWrap: 'anywhere' }}>
        {String(value)}
      </Typography>
    </Stack>
  );
}

function getPaymentStatusLabel(value: string | null | undefined) {
  return value ? (paymentStatusLabels[value] ?? '확인 필요') : null;
}

function getPaymentMethodLabel(value: string | null | undefined) {
  return value ? (paymentMethodLabels[value] ?? '확인 필요') : null;
}

function getFallbackPaymentLabel(payment: LinkedPayment | null) {
  if (!payment) return null;
  const amount = payment.amount === null ? null : `${Number(payment.amount).toLocaleString('ko-KR')}원`;
  const orderNo = payment.order_no ? `(${payment.order_no})` : null;
  return ['결제', amount, orderNo].filter(Boolean).join(' / ');
}

export default function InquiryDetails({
  inquiryType,
  inquirySubtype,
  content,
  bugDetails,
  paymentDetails,
  linkedPayment,
  paymentLabel,
  evidenceUrl,
}: Props) {
  const subtypeLabel = inquirySubtypes[inquiryType].find((item) => item.value === inquirySubtype)?.label;
  const bug = one(bugDetails);
  const payment = one(paymentDetails);
  const snapshot = payment?.payment_snapshot;
  const linked = one(linkedPayment);
  const selectedPaymentLabel = paymentLabel ?? (linked ? payment?.attempted_product ?? null : null) ?? getFallbackPaymentLabel(linked);
  const paymentInfo = snapshot ?? linked;

  return (
    <Stack gap={2}>
      <Detail label="세부 유형" value={subtypeLabel} />
      {bug ? (
        <>
          <Detail label="화면 주소" value={bug.page_url as string | null} />
          {bug.occurred_at ? <Detail label="발생 날짜와 시간" value={formatDateTimeDetail(bug.occurred_at)} /> : null}
          <Detail label="하려고 했던 작업" value={String(bug.attempted_action)} />
          <Detail label="실제로 발생한 문제" value={String(bug.actual_behavior)} />
          <Detail label="재현 빈도" value={recurrenceLabels[String(bug.recurrence)] ?? String(bug.recurrence)} />
          <Detail label="에러 메시지" value={bug.error_message as string | null} />
          <Detail
            label="접속 환경"
            value={[
              bug.browser_name && `${bug.browser_name} ${bug.browser_version ?? ''}`.trim(),
              bug.operating_system,
              bug.device_type,
              bug.viewport_width && bug.viewport_height ? `${bug.viewport_width} × ${bug.viewport_height}` : null,
            ]
              .filter(Boolean)
              .join(' / ')}
          />
        </>
      ) : payment ? (
        <>
          {inquiryType !== 'minor_purchase_cancellation' && payment.occurred_at ? (
            <Detail label="발생 날짜와 시간" value={formatDateTimeDetail(payment.occurred_at)} />
          ) : null}
          {inquiryType === 'minor_purchase_cancellation' && content ? (
            <Stack>
              <Typography variant="subtitle2">상세 설명</Typography>
              <Typography variant="body2" whiteSpace="pre-wrap" sx={{ mb: 2 }}>
                {content}
              </Typography>
            </Stack>
          ) : null}

          {inquiryType !== 'minor_purchase_cancellation' && !linked ? (
            <Detail label="결제하려던 항목" value={payment.attempted_product} />
          ) : null}

          {inquiryType !== 'minor_purchase_cancellation' && !linked ? (
            <>
              <Detail
                label="후원하려던 금액"
                value={
                  payment.attempted_amount ? `${Number(payment.attempted_amount).toLocaleString('ko-KR')}원` : null
                }
              />
            </>
          ) : null}
          {inquiryType !== 'minor_purchase_cancellation' ? (
            <>
              <Detail label="화면에 표시된 메시지" value={payment.displayed_message} />
              <Detail label="실제로 발생한 상황" value={payment.actual_behavior} />
            </>
          ) : null}

          {selectedPaymentLabel ? (
            <Detail
              label={inquiryType === 'minor_purchase_cancellation' ? '청약취소를 요청할 결제' : '문제가 발생한 결제'}
              value={selectedPaymentLabel}
            />
          ) : null}
          {paymentInfo ? (
            <>
              <Detail label="결제수단" value={getPaymentMethodLabel(String(paymentInfo.payment_method ?? ''))} />
              <Detail label="결제 상태" value={getPaymentStatusLabel(String(paymentInfo.status ?? ''))} />
              {paymentInfo.approved_at ? (
                <Detail label="승인 날짜와 시간" value={formatDateTimeDetail(String(paymentInfo.approved_at))} />
              ) : null}
              {Number(paymentInfo.refunded_amount ?? 0) > 0 ? (
                <Detail label="취소 금액" value={`${Number(paymentInfo.refunded_amount).toLocaleString('ko-KR')}원`} />
              ) : null}
              {paymentInfo.refunded_at ? (
                <Detail label="취소 날짜와 시간" value={formatDateTimeDetail(String(paymentInfo.refunded_at))} />
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <>
          {selectedPaymentLabel ? (
            <Detail
              label={inquiryType === 'minor_purchase_cancellation' ? '청약취소를 요청할 결제' : '문제가 발생한 결제'}
              value={selectedPaymentLabel}
            />
          ) : null}
          {paymentInfo ? (
            <>
              <Detail label="결제수단" value={getPaymentMethodLabel(String(paymentInfo.payment_method ?? ''))} />
              <Detail label="결제 상태" value={getPaymentStatusLabel(String(paymentInfo.status ?? ''))} />
              {paymentInfo.approved_at ? (
                <Detail label="승인 날짜와 시간" value={formatDateTimeDetail(String(paymentInfo.approved_at))} />
              ) : null}
              {Number(paymentInfo.refunded_amount ?? 0) > 0 ? (
                <Detail label="취소 금액" value={`${Number(paymentInfo.refunded_amount).toLocaleString('ko-KR')}원`} />
              ) : null}
              {paymentInfo.refunded_at ? (
                <Detail label="취소 날짜와 시간" value={formatDateTimeDetail(String(paymentInfo.refunded_at))} />
              ) : null}
            </>
          ) : null}
          <Stack>
            <Typography variant="subtitle2">문의내용</Typography>
            <Typography variant="body2" whiteSpace="pre-wrap">
              {content}
            </Typography>
          </Stack>
        </>
      )}
      {evidenceUrl ? (
        <Stack direction="row">
          <Anchor href={evidenceUrl} target="_blank" rel="noreferrer" className="button small action">
            첨부 자료 확인
          </Anchor>
        </Stack>
      ) : null}
    </Stack>
  );
}
