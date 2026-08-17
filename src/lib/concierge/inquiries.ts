export const inquiryTypes = [
  'service_question',
  'account_identity',
  'creator_settlement',
  'bug_report',
  'payment_refund_error',
  'minor_purchase_cancellation',
] as const;

export type InquiryType = (typeof inquiryTypes)[number];

export const inquiryStatusLabels = {
  received: '접수됨',
  reviewing: '검토 중',
  info_requested: '추가 정보 요청',
  closed: '종결',
} as const;

export type InquiryStatus = keyof typeof inquiryStatusLabels;

export const inquiryInformationRequestTypes = [
  'text_response',
  'evidence',
  'family_relation_certificate',
  'payment_control',
  'refund_account',
] as const;

export type InquiryInformationRequestType = (typeof inquiryInformationRequestTypes)[number];

export const inquiryInformationRequestLabels: Record<InquiryInformationRequestType, string> = {
  text_response: '답변 내용',
  evidence: '증빙 파일',
  family_relation_certificate: '가족관계증명서 PDF',
  payment_control: '향후 결제 / 구매 / 후원 방침',
  refund_account: '반환 계좌 정보',
};

export function isInquiryInformationRequestType(value: unknown): value is InquiryInformationRequestType {
  return typeof value === 'string' && inquiryInformationRequestTypes.includes(value as InquiryInformationRequestType);
}

export const inquirySubtypes = {
  service_question: [
    { value: 'service_usage', label: '서비스 이용 문의' },
    { value: 'service_policy', label: '서비스 정책 문의' },
  ],
  account_identity: [
    { value: 'account_access', label: '계정 이용 문제' },
    { value: 'identity_verification', label: '본인인증 문제' },
  ],
  creator_settlement: [
    { value: 'creator_application', label: '작가 신청 문제' },
    { value: 'settlement_information', label: '정산 정보 문제' },
    { value: 'settlement_payment', label: '정산 지급 문제' },
  ],
  bug_report: [
    { value: 'display_issue', label: '화면 표시 문제' },
    { value: 'interaction_issue', label: '버튼 / 입력 / 업로드 문제' },
    { value: 'persistence_issue', label: '저장 / 수정 결과 미반영' },
    { value: 'performance_access_issue', label: '접속 / 속도 / 멈춤 문제' },
    { value: 'other_bug', label: '기타 에러 / 버그' },
  ],
  payment_refund_error: [
    { value: 'payment_declined', label: '결제가 완료되지 않음' },
    { value: 'payment_entitlement_missing', label: '결제됐지만 구매 내용이 반영되지 않음' },
    { value: 'payment_cancellation_unavailable', label: '결제 내역에서 취소할 수 없음' },
    { value: 'cancellation_status_not_reflected', label: '취소했지만 결제 상태가 반영되지 않음' },
    { value: 'cancellation_entitlement_incorrect', label: '취소 후 이용 권한이 정상적으로 처리되지 않음' },
  ],
  minor_purchase_cancellation: [{ value: 'minor_contract_cancellation', label: '미성년자 결제 청약취소' }],
} satisfies Record<InquiryType, { value: string; label: string }[]>;

export const inquiryTypeLabels: Record<InquiryType, string> = {
  service_question: '서비스 이용',
  account_identity: '계정 / 본인인증',
  creator_settlement: '작가 / 정산',
  bug_report: '에러 / 버그',
  payment_refund_error: '결제 / 환불 문제',
  minor_purchase_cancellation: '미성년자 결제 청약취소',
};

export const inquiryResolutionCodes = [
  'parent_relationship_unverified',
  'additional_information_not_submitted',
  'request_withdrawn',
  'error_resolved_guidance_completed',
  'minor_cancellation_approved_payment_cancelled',
  'minor_cancellation_not_eligible',
] as const;

export type InquiryResolutionCode = (typeof inquiryResolutionCodes)[number];

export const inquiryResolutionLabels: Record<InquiryResolutionCode, string> = {
  minor_cancellation_approved_payment_cancelled: '청약취소 승인 및 결제 취소 완료',
  minor_cancellation_not_eligible: '청약취소 대상 아님',
  parent_relationship_unverified: '부 / 모 관계 확인 불가',
  additional_information_not_submitted: '추가 정보 미제출',
  request_withdrawn: '문의 철회',
  error_resolved_guidance_completed: '오류 수정 / 안내 완료',
};

export function isInquiryType(value: unknown): value is InquiryType {
  return typeof value === 'string' && inquiryTypes.includes(value as InquiryType);
}

export function isInquiryResolutionCode(value: unknown): value is InquiryResolutionCode {
  return typeof value === 'string' && inquiryResolutionCodes.includes(value as InquiryResolutionCode);
}

export function isResolutionAllowedForInquiryType(type: InquiryType, resolution: InquiryResolutionCode) {
  if (resolution === 'request_withdrawn' || resolution === 'additional_information_not_submitted') {
    return true;
  }

  if (type === 'minor_purchase_cancellation') {
    return (
      resolution === 'minor_cancellation_approved_payment_cancelled' ||
      resolution === 'minor_cancellation_not_eligible' ||
      resolution === 'parent_relationship_unverified'
    );
  }

  return resolution === 'error_resolved_guidance_completed';
}
