import { getMailFrom, getResendClient } from '@/lib/resend';

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

export async function sendMinorPurchaseCancellationAdjustmentEmail({
  email,
  adjustmentAmount,
}: {
  email: string;
  adjustmentAmount: number;
}) {
  const formattedAmount = `${adjustmentAmount.toLocaleString('ko-KR')}원`;
  const sendResult = await getResendClient().emails.send({
    from: getMailFrom(),
    to: email,
    subject: '[데브허브] 결제 취소에 따른 정산 조정 안내',
    html: `
      <table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0">
        <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;box-sizing:border-box;margin:0 auto"><img style="border-style:none" src="https://velhub.xyz/velhub-1-webmail.png" alt="데브허브" width="106" height="24"></div></td></tr>
        <tr><td><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;color:#181818;"><h2>결제 취소에 따른 정산 조정 안내</h2><p>안녕하세요, 데브허브입니다.</p><p>미성년 이용자의 법정대리인 요청에 따른 청약취소가 승인되어 해당 결제가 취소되었습니다.</p><p>이에 따라 해당 결제에서 창작자님께 배분된 금액 <strong>${escapeHtml(formattedAmount)}</strong>이 정산 조정 대상으로 반영됩니다. 조정 금액은 이후 발생하는 정산금에서 차감됩니다.</p><p>구매자와 법정대리인의 개인정보 보호를 위해 세부 사유와 주문 정보는 안내드리지 않는 점 양해 부탁드립니다.</p><p>정산 내역에서 조정 현황을 확인하실 수 있습니다. 문의가 있으시면 데브허브 고객지원으로 연락해 주세요.</p><p><strong style="font-size:12px">Everyday, Everywhere, Everymoments - Velhub</strong></p></div></td></tr>
        <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;"><span style="color:#d7d7d7;font-size:12px">&copy; <img src="https://velhub.xyz/velhub-2-webmail.png" alt="데브런닷스튜디오" width="90" height="12"> All rights reserved. <strong style="color:#ff69b4;padding-left:12px">&hearts; velhub</strong></span></div></td></tr>
      </table>
    `,
  });

  if (sendResult.error) {
    throw new Error(sendResult.error.message || '청약취소 정산 조정 안내 메일을 보내지 못했습니다.');
  }
}
