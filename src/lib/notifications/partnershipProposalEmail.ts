import { getMailFrom, getResendClient } from '@/lib/resend';

const PARTNERSHIP_INBOX = 'chloe@dev1stud.io';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return entities[character];
  });
}

export async function sendPartnershipProposalEmail({
  subject,
  content,
  organizationName,
  proposerName,
  proposerPhone,
  proposerEmail,
  homepageUrl,
  files,
}: {
  subject: string;
  content: string;
  organizationName: string;
  proposerName: string;
  proposerPhone: string;
  proposerEmail: string;
  homepageUrl: string | null;
  files: File[];
}) {
  const attachments = await Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()),
    })),
  );
  const sendResult = await getResendClient().emails.send({
    from: getMailFrom(),
    to: PARTNERSHIP_INBOX,
    replyTo: proposerEmail,
    subject: `[데브허브 제휴 제안] ${subject}`,
    html: `<p>회사/기관명: ${escapeHtml(organizationName)}</p><p>제안자명: ${escapeHtml(proposerName)}</p><p>전화번호: ${escapeHtml(proposerPhone)}</p><p>이메일: ${escapeHtml(proposerEmail)}</p>${homepageUrl ? `<p>홈페이지: ${escapeHtml(homepageUrl)}</p>` : ''}<p style="white-space:pre-wrap">${escapeHtml(content)}</p>`,
    attachments,
  });
  if (sendResult.error) throw new Error(sendResult.error.message || '제휴 제안 메일을 보내지 못했습니다.');
}
