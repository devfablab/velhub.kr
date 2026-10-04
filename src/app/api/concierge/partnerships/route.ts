import { NextRequest } from 'next/server';
import { decrypt } from '@/lib/encryption/decrypt';
import { encrypt } from '@/lib/encryption/encrypt';
import { sendPartnershipProposalEmail } from '@/lib/notifications/partnershipProposalEmail';
import { isPartnershipAttachment, PARTNERSHIP_ATTACHMENT_MAX_BYTES } from '@/lib/partnerships';
import { getPartnershipFormInfo, getPartnershipProposals } from '@/lib/partnerships/server';
import { getCurrentStigma } from '@/lib/session/utils';
import { getSupabaseAdmin } from '@/lib/supabase';

function getText(value: FormDataEntryValue | null) {
  return typeof value === 'string' ? value.trim() : '';
}

function getFile(value: FormDataEntryValue | null) {
  return value instanceof File && value.size > 0 ? value : null;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidHomepage(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function validationError(fieldErrors: Record<string, string>) {
  const errors = [...new Set(Object.values(fieldErrors).filter(Boolean))];
  return Response.json({ error: errors[0] ?? '입력 정보를 확인해 주세요.', errors, fieldErrors }, { status: 400 });
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get('form') !== 'true') {
    const result = await getPartnershipProposals();
    return Response.json(result.error ? { error: result.error } : { proposals: result.proposals }, {
      status: result.error === '로그인이 필요합니다.' ? 401 : result.error ? 500 : 200,
    });
  }
  try {
    return Response.json(await getPartnershipFormInfo());
  } catch {
    return Response.json({ error: '제휴 제안 정보를 불러오지 못했습니다.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const db = getSupabaseAdmin();
  const current = await getCurrentStigma();
  const formData = await request.formData().catch(() => null);
  if (!formData) return validationError({ form: '제휴 제안 정보를 읽지 못했습니다.' });

  const categoryId = getText(formData.get('categoryId'));
  const subject = getText(formData.get('subject'));
  const content = getText(formData.get('content'));
  const organizationName = getText(formData.get('organizationName'));
  const proposerName = getText(formData.get('proposerName'));
  const proposerPhone = getText(formData.get('proposerPhone'));
  const suppliedEmail = getText(formData.get('proposerEmail'));
  const homepageUrl = getText(formData.get('homepageUrl'));
  const personalInfoAgreed = getText(formData.get('personalInfoAgreed')) === 'true';
  const noticeAgreed = getText(formData.get('noticeAgreed')) === 'true';
  const proposalFile = getFile(formData.get('proposalFile'));
  const introductionFile = getFile(formData.get('introductionFile'));

  let proposerEmail = suppliedEmail;
  if (current) {
    const stigmaResult = await db.from('stigmas').select('payment_email').eq('id', current.stigmaId).maybeSingle();
    if (stigmaResult.error) return Response.json({ error: '회원 정보를 불러오지 못했습니다.' }, { status: 500 });
    try {
      proposerEmail = stigmaResult.data?.payment_email ? decrypt(stigmaResult.data.payment_email) : suppliedEmail;
    } catch {
      proposerEmail = suppliedEmail;
    }
  }

  const fieldErrors = {
    categoryId: !categoryId ? '제휴 희망 영역을 선택해 주세요.' : '',
    subject: !subject ? '제목을 입력해 주세요.' : subject.length > 200 ? '제목은 200자 이하로 입력해 주세요.' : '',
    content: !content ? '내용을 입력해 주세요.' : '',
    organizationName: !organizationName
      ? '회사 또는 기관명을 입력해 주세요.'
      : organizationName.length < 2 || organizationName.length > 50
        ? '회사 또는 기관명은 2자 이상 50자 이하로 입력해 주세요.'
        : '',
    proposerName: !proposerName ? '제안자명을 입력해 주세요.' : '',
    proposerPhone: !proposerPhone ? '전화번호를 입력해 주세요.' : '',
    proposerEmail: !proposerEmail
      ? '이메일 주소를 입력해 주세요.'
      : !isValidEmail(proposerEmail)
        ? '이메일 주소를 확인해 주세요.'
        : '',
    homepageUrl: !isValidHomepage(homepageUrl) ? '홈페이지 주소를 확인해 주세요.' : '',
    personalInfoAgreed: !personalInfoAgreed ? '개인정보 수집 및 이용에 동의해 주세요.' : '',
    noticeAgreed: !noticeAgreed ? '제휴 제안 유의사항을 확인해 주세요.' : '',
  };
  if (Object.values(fieldErrors).some(Boolean)) return validationError(fieldErrors);

  const categoryResult = await db.from('partnership_categories').select('id').eq('id', categoryId).maybeSingle();
  if (categoryResult.error) return Response.json({ error: '제휴 희망 영역을 확인하지 못했습니다.' }, { status: 500 });
  if (!categoryResult.data) return validationError({ categoryId: '제휴 희망 영역을 확인해 주세요.' });

  const files = [proposalFile, introductionFile].filter(Boolean) as File[];
  for (const file of files) {
    if (file.size > PARTNERSHIP_ATTACHMENT_MAX_BYTES)
      return validationError({ attachment: '첨부 파일은 각각 25MB 이하만 첨부할 수 있습니다.' });
    if (!isPartnershipAttachment(file))
      return validationError({ attachment: '첨부 파일은 PDF, JPG, PNG, ZIP 형식만 가능합니다.' });
  }

  const responseChannel = files.length ? 'email' : 'portal';
  const now = new Date().toISOString();
  if (responseChannel === 'email') {
    const formInfo = await getPartnershipFormInfo();
    if (!formInfo.attachmentAvailable)
      return Response.json(
        {
          error: `현재 첨부파일이 포함된 제휴 제안은 일시적으로 접수할 수 없습니다.\n${formInfo.attachmentUnavailableNotice}`,
          attachmentUnavailable: true,
        },
        { status: 429 },
      );
    try {
      await sendPartnershipProposalEmail({
        subject,
        content,
        organizationName,
        proposerName,
        proposerPhone,
        proposerEmail,
        homepageUrl: homepageUrl || null,
        files,
      });
    } catch {
      return Response.json({ error: '제휴 제안 메일을 보내지 못했습니다.' }, { status: 500 });
    }
  }

  const proposalResult = await db
    .from('partnership_proposals')
    .insert({
      category_id: categoryId,
      proposer_stigma_id: current?.stigmaId ?? null,
      subject,
      content,
      organization_name: encrypt(organizationName),
      proposer_name: encrypt(proposerName),
      proposer_phone: encrypt(proposerPhone),
      proposer_email: encrypt(proposerEmail),
      homepage_url: homepageUrl || null,
      personal_info_agreed_at: now,
      notice_agreed_at: now,
      response_channel: responseChannel,
      email_sent_at: responseChannel === 'email' ? now : null,
      last_message_author: 'customer',
      last_message_at: now,
    })
    .select('id')
    .single();
  if (proposalResult.error) return Response.json({ error: '제휴 제안을 저장하지 못했습니다.' }, { status: 500 });
  return Response.json({ id: proposalResult.data.id, responseChannel }, { status: 201 });
}
