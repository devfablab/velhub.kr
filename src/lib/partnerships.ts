export const PARTNERSHIP_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;

export type PartnershipCategory = { id: string; category_label: string };

export type PartnershipFormInfo = {
  categories: PartnershipCategory[];
  isLoggedIn: boolean;
  paymentEmail: string;
  attachmentAvailable: boolean;
  attachmentUnavailableNotice: string;
};

export type PartnershipProposalRow = {
  id: string;
  category_label: string;
  subject: string;
  response_channel: 'portal' | 'email';
  email_response_status: 'unanswered' | 'answered';
  has_new_answer: boolean;
  created_at: string;
};

export type PartnershipMessage = {
  id: string;
  author_type: 'customer' | 'admin';
  content: string;
  created_at: string;
};

export type PartnershipProposalDetail = {
  id: string;
  category_label: string;
  subject: string;
  content: string;
  organization_name: string;
  proposer_name: string;
  proposer_phone: string;
  proposer_email: string;
  homepage_url: string | null;
  response_channel: 'portal' | 'email';
  email_response_status: 'unanswered' | 'answered';
  created_at: string;
  messages: PartnershipMessage[];
};

export const partnershipAttachmentExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'zip'] as const;

const partnershipAttachmentMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/zip',
  'application/x-zip-compressed',
]);

export function isPartnershipAttachment(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return (
    partnershipAttachmentExtensions.includes(extension as (typeof partnershipAttachmentExtensions)[number]) &&
    (!file.type || partnershipAttachmentMimeTypes.has(file.type))
  );
}

export function getKoreanNineAmBoundary(now = new Date()) {
  const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const year = koreanTime.getUTCFullYear();
  const month = koreanTime.getUTCMonth();
  const day = koreanTime.getUTCDate();
  const isAfterReset = koreanTime.getUTCHours() >= 9;
  return new Date(Date.UTC(year, month, isAfterReset ? day : day - 1, 0, 0, 0));
}

export function getKoreanNineAmNotice(now = new Date()) {
  const koreanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return koreanTime.getUTCHours() < 9
    ? '오늘 오전 9시 이후 다시 시도해 주세요.'
    : '내일 오전 9시 이후 다시 시도해 주세요.';
}
