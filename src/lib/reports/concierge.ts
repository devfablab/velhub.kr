import type { ReportStatus } from '@/lib/reports/manage';
import type { ReportTargetType } from '@/lib/reports/guidelines';

export const conciergeReportTypes = ['guideline', 'legal', 'rights'] as const;

export type ConciergeReportType = (typeof conciergeReportTypes)[number];

export type ReportDetailLink = {
  label: string;
  href: string;
};

export type ReportDetail = {
  label: string;
  value: string | null;
  links?: ReportDetailLink[];
};

export type ReportMessage = {
  id: string;
  message: string;
  senderName: string;
  recipientName: string;
  createdAt: string;
};

export type ConciergeReportItem = {
  id: string;
  reportType: ConciergeReportType;
  reportTypeLabel: string;
  targetType: ReportTargetType | null;
  targetTypeLabel: string;
  reporterUserId: string;
  reporterName: string;
  reportName: string;
  reportUrl: string | null;
  messageCount: number;
  status: ReportStatus;
  statusLabel: string;
  createdAt: string;
  handledAt: string | null;
  site: {
    id: string;
    name: string;
    href: string;
    isBlocked: boolean;
    isPlanTerminated: boolean;
  } | null;
  board: {
    id: string;
    name: string;
    href: string;
  } | null;
  post: {
    id: string;
    title: string;
    href: string;
  } | null;
  comment: {
    id: string;
    content: string;
  } | null;
  details: ReportDetail[];
  messages: ReportMessage[];
  canDismiss: boolean;
  canComplete: boolean;
  canSendMessage: boolean;
};

export function isConciergeReportType(value: unknown): value is ConciergeReportType {
  return value === 'guideline' || value === 'legal' || value === 'rights';
}

export const conciergeReportTypeLabels: Record<ConciergeReportType, string> = {
  guideline: '가이드라인 위반',
  legal: '법률 위반',
  rights: '권리침해 위반',
};

export const conciergeTargetTypeLabels: Record<ReportTargetType, string> = {
  site: '사이트 신고',
  board: '게시판 신고',
  post: '게시물 신고',
  comment: '댓글 신고',
};

export const legalTypeLabels: Record<string, string> = {
  illegal_info: '정보통신망법에 따른 불법정보/허위조작정보',
  illegal_filming: '불법촬영물등이 포함됨',
  privacy: '개인정보가 포함됨',
};

export const rightsReasonTypeLabels: Record<string, string> = {
  defamation: '명예훼손',
  personality_rights: '초상권 ∙ 사생활 등 인격권',
  copyright: '저작권',
  trademark: '상표권',
  counterfeit: '위조상품',
  design_patent_utility: '디자인 ∙ 특허 ∙ 실용신안',
};

export const legalValueLabels: Record<string, string> = {
  illegal_info: '불법정보',
  illegal_filming: '불법촬영물',
  false_manipulated_info: '허위조작정보',
  obscene_distribution: '음란물 배포 및 공개 전시 정보',
  false_fact_defamation: '허위사실 적시 명예훼손 정보',
  hate_speech: '폭력·차별 선동 및 증오 조장 등 혐오정보',
  fear_anxiety_repeated_message: '공포·불안 유발 메시지 반복 전송 정보',
  system_damage_disruption: '정보통신시스템 훼손·변조 및 운용방해 정보',
  youth_harmful_media_violation: '연령 확인·표시 의무 위반 청소년유해매체물',
  illegal_gambling: '불법 사행성 행위 관련 정보',
  personal_info_illegal_trade: '개인정보 불법 거래 정보',
  weapons_explosives_manufacturing: '총포·화약류 제조방법 및 설계 정보',
  drug_use_manufacture_trade: '마약류 사용·제조·매매 및 알선 정보',
  national_secret_leak: '국가기밀 누설 정보',
  national_security_law_violation: '국가보안법 위반 정보',
  other_criminal_purpose_aiding: '기타 범죄 목적·교사·방조 정보',
  false_information: '내용의 전부 또는 일부가 허위인 정보',
  manipulated_information: '내용을 사실로 오인하도록 변형된 정보',
  distribution_report: '불법촬영물등 유통신고',
  deletion_request: '불법촬영물등 삭제요청',
  deepfake: '허위영상물',
  child_youth_sexual_exploitation: '아동·청소년 성착취물',
  post: '게시글',
  comment: '댓글',
  other: '그 외',
  individual: '개인',
  organization: '단체',
};
