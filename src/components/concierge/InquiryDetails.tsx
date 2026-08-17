import { Stack, Typography } from '@mui/material';
import { inquirySubtypes, type InquiryType } from '@/lib/concierge/inquiries';
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

type Props = {
  inquiryType: InquiryType;
  inquirySubtype: string | null;
  content: string;
  bugDetails?: BugDetail | BugDetail[] | null;
  paymentDetails?: PaymentDetail | PaymentDetail[] | null;
  paymentId?: string | null;
  evidenceUrl?: string | null;
};

const recurrenceLabels: Record<string, string> = {
  always: '항상 발생',
  often: '자주 발생',
  sometimes: '가끔 발생',
  once: '한 번만 발생',
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

export default function InquiryDetails({
  inquiryType,
  inquirySubtype,
  content,
  bugDetails,
  paymentDetails,
  paymentId,
  evidenceUrl,
}: Props) {
  const subtypeLabel = inquirySubtypes[inquiryType].find((item) => item.value === inquirySubtype)?.label;
  const bug = one(bugDetails);
  const payment = one(paymentDetails);
  const snapshot = payment?.payment_snapshot;

  return (
    <Stack gap={2}>
      <Detail label="세부 유형" value={subtypeLabel} />
      {bug ? (
        <>
          <Detail label="화면 주소" value={bug.page_url} />
          <Detail label="발생 날짜와 시간" value={new Date(bug.occurred_at).toLocaleString('ko-KR')} />
          <Detail label="하려고 했던 작업" value={bug.attempted_action} />
          <Detail label="실제로 발생한 문제" value={bug.actual_behavior} />
          <Detail label="재현 빈도" value={recurrenceLabels[bug.recurrence] ?? bug.recurrence} />
          <Detail label="에러 메시지" value={bug.error_message} />
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
          <Detail label="발생 날짜와 시간" value={new Date(payment.occurred_at).toLocaleString('ko-KR')} />
          <Detail label="결제하려던 항목" value={payment.attempted_product} />
          <Detail
            label="후원하려던 금액"
            value={payment.attempted_amount ? `${Number(payment.attempted_amount).toLocaleString('ko-KR')}원` : null}
          />
          <Detail label="화면에 표시된 메시지" value={payment.displayed_message} />
          <Detail label="실제로 발생한 상황" value={payment.actual_behavior} />
          <Detail label="연결 결제 ID" value={paymentId} />
          <Detail label="주문번호" value={snapshot?.order_no} />
          <Detail
            label="결제 금액"
            value={snapshot?.amount ? `${Number(snapshot.amount).toLocaleString('ko-KR')}원` : null}
          />
          <Detail label="결제수단" value={snapshot?.payment_method} />
          <Detail label="PG사" value={snapshot?.provider} />
          <Detail label="결제 상태" value={snapshot?.status} />
          <Detail
            label="승인 시각"
            value={snapshot?.approved_at ? new Date(String(snapshot.approved_at)).toLocaleString('ko-KR') : null}
          />
        </>
      ) : (
        <Typography variant="body2" whiteSpace="pre-wrap">
          {content}
        </Typography>
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
