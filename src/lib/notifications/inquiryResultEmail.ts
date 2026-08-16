import { getMailFrom, getResendClient } from '@/lib/resend';

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character,
  );
}

export async function sendInquiryResultEmail({
  email,
  result,
  reason,
}: {
  email: string;
  result: string;
  reason: string;
}) {
  const sendResult = await getResendClient().emails.send({
    from: getMailFrom(),
    to: email,
    subject: '[데브허브] 문의 처리 결과를 안내드립니다',
    html: `<table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0"><tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;box-sizing:border-box;margin:0 auto"><img style="border-style:none" src="https://velhub.xyz/velhub-1-webmail.png" alt="데브허브" width="106" height="24"></div></td></tr><tr><td><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',sans-serif;color:#181818"><h2>문의 처리 결과를 안내드립니다</h2><p>안녕하세요, 데브허브입니다.</p><p>접수해 주신 문의를 확인하고 아래와 같이 처리했습니다.</p><table style="width:100%;border-collapse:collapse"><tr><th style="width:120px;padding:12px 16px;background:#181818;color:#fff;text-align:left">처리 결과</th><td style="padding:12px 16px;border:1px solid #d7d7d7">${escapeHtml(result)}</td></tr><tr><th style="padding:12px 16px;background:#181818;color:#fff;text-align:left">안내 사유</th><td style="padding:12px 16px;border:1px solid #d7d7d7;white-space:pre-wrap">${escapeHtml(reason)}</td></tr></table><p>추가로 확인할 내용이 있다면 문의 내역에서 확인해 주세요.</p><p><strong style="font-size:12px">Everyday, Everywhere, Everymoments - Velhub</strong></p></div></td></tr><tr><td style="background:#181818"><div style="max-width:575px;padding:23px;margin:0 auto;color:#d7d7d7;font-size:12px">&copy; 데브런닷스튜디오 All rights reserved.</div></td></tr></table>`,
  });
  if (sendResult.error) throw new Error(sendResult.error.message || '문의 처리 결과 메일을 보내지 못했습니다.');
}
