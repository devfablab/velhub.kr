import { getMailFrom, getResendClient } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase';

type RequestBody = {
  email: string | null;
};

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const email = requestBody.email?.trim().toLowerCase() ?? '';

    if (!email) {
      throw new Error('이메일을 입력해주세요.');
    }

    const generateLinkResult = await getSupabaseAdmin().auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${new URL(request.url).origin}/reset-password` },
    });

    if (generateLinkResult.error || !generateLinkResult.data.properties.action_link) {
      throw new Error(generateLinkResult.error?.message || '비밀번호 재설정 링크를 만들지 못했습니다.');
    }

    const sendResult = await getResendClient().emails.send({
      from: getMailFrom(),
      to: email,
      subject: '[데브허브] 비밀번호를 재설정해 주세요',
      html: `
        <table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0">
          <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;box-sizing:border-box;margin:0 auto"><img style="border-style:none" src="https://velhub.xyz/velhub-1-webmail.png" alt="데브허브" width="106" height="24"></div></td></tr>
          <tr><td><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;color:#181818;"><h1>데브허브 비밀번호 재설정</h1><p>콘텐츠에 가치를 더하는 복합 허브 서비스, 데브허브입니다.</p><p>아래 버튼을 눌러 새 비밀번호를 설정해 주세요.</p><p style="text-align:center"><a href="${generateLinkResult.data.properties.action_link}" style="background-color:#eeb400;color:#181818;display:inline-block;padding:12px 23px;border-radius:12px;font-weight:bolder;text-decoration:none">비밀번호 재설정</a></p><p>본인이 요청하지 않았다면 이 이메일을 무시해 주세요. 기존 비밀번호는 변경되지 않습니다.</p><p><strong style="font-size:12px">Everyday, Everywhere, Everymoments - Velhub</strong></p></div></td></tr>
          <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;"><span style="color:#d7d7d7;font-size:12px">&copy; <img src="https://velhub.xyz/velhub-2-webmail.png" alt="데브런닷스튜디오" width="90" height="12"> All rights reserved. <strong style="color:#ff69b4;padding-left:12px">&hearts; velhub</strong></span></div></td></tr>
        </table>
      `,
    });

    if (sendResult.error) {
      throw new Error(sendResult.error.message || '비밀번호 재설정 메일을 보내지 못했습니다.');
    }

    return Response.json({ ok: true });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '비밀번호 재설정 메일 처리 중 오류가 발생했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '비밀번호 재설정 메일 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
