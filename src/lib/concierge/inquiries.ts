export const inquiryTypes = [
  'minor_purchase_cancellation',
  'payment_refund_error',
  'account_identity',
  'creator_settlement',
  'service_question',
  'bug_report',
] as const;

export type InquiryType = (typeof inquiryTypes)[number];

export const inquiryTypeLabels: Record<InquiryType, string> = {
  minor_purchase_cancellation: '미성년자 결제 청약취소',
  payment_refund_error: '결제·환불 처리 오류',
  account_identity: '계정·본인인증',
  creator_settlement: '작가·정산',
  service_question: '서비스 이용',
  bug_report: '기능 오류',
};

export const inquiryResolutionCodes = [
  'minor_cancellation_approved_payment_cancelled',
  'minor_cancellation_not_eligible',
  'parent_relationship_unverified',
  'additional_information_not_submitted',
  'request_withdrawn',
  'error_resolved_guidance_completed',
] as const;

export type InquiryResolutionCode = (typeof inquiryResolutionCodes)[number];

export const inquiryResolutionLabels: Record<InquiryResolutionCode, string> = {
  minor_cancellation_approved_payment_cancelled: '청약취소 승인 및 결제 취소 완료',
  minor_cancellation_not_eligible: '청약취소 대상 아님',
  parent_relationship_unverified: '부·모 관계 확인 불가',
  additional_information_not_submitted: '추가 정보 미제출',
  request_withdrawn: '문의 철회',
  error_resolved_guidance_completed: '오류 수정·안내 완료',
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
