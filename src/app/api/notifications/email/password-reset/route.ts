import { getMailFrom, getResendClient } from '@/lib/resend';
import { getSupabaseAdmin } from '@/lib/supabase';

type RequestBody = {
  email?: string | null;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function successResponse() {
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    const requestBody = (await request.json()) as RequestBody;
    const email = requestBody.email?.trim().toLowerCase() ?? '';

    if (!email || !EMAIL_PATTERN.test(email)) {
      return Response.json(
        {
          title: '이메일 확인',
          errors: [!email ? '이메일을 입력해 주세요.' : '올바른 이메일 형식으로 입력해 주세요.'],
          fieldErrors: { email: !email ? '이메일을 입력해 주세요.' : '올바른 이메일 형식으로 입력해 주세요.' },
        },
        { status: 400 },
      );
    }

    const generateLinkResult = await getSupabaseAdmin().auth.admin.generateLink({
      type: 'recovery',
      email,
      options: { redirectTo: `${new URL(request.url).origin}/auth/reset-password` },
    });

    if (generateLinkResult.error || !generateLinkResult.data.properties.action_link) {
      console.info('[password-reset-mail] recovery link was not issued', generateLinkResult.error);
      return successResponse();
    }

    const sendResult = await getResendClient().emails.send({
      from: getMailFrom(),
      to: email,
      subject: '[데브허브] 비밀번호를 재설정해 주세요',
      html: `
        <table style="border-collapse:collapse;width:100%;border-style:none;margin-left:auto;margin-right:auto" border="0">
          <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;box-sizing:border-box;margin:0 auto"><img style="border-style:none" src="https://velhub.xyz/velhub-1-webmail.png" alt="데브허브" width="106" height="24"></div></td></tr>
          <tr><td><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;color:#181818;"><h1>데브허브 비밀번호 재설정</h1><p>콘텐츠에 가치를 더하는 복합 허브 서비스, 데브허브입니다.</p><p>아래 버튼을 눌러 새 비밀번호를 설정해 주세요.</p><p style="text-align:center"><a href="${generateLinkResult.data.properties.action_link}" style="background-color:#eeb400;color:#181818;display:inline-block;padding:12px 23px;border-radius:12px;font-weight:bolder;text-decoration:none">비밀번호 재설정</a></p><p>본인이 요청하지 않았다면 이 이메일을 무시해 주세요. 기존 비밀번호는 변경되지 않습니다.</p><p><strong style="font-size:12px">Everyday, Everywhere, Everymoments - velhub</strong></p></div></td></tr>
          <tr><td style="background-color:#181818"><div style="max-width:575px;width:100%;padding:23px;margin:0 auto;box-sizing:border-box;font-family:'Apple SD Gothic Neo', 'Noto Sans KR','Malgun Gothic', '맑은 고딕', sans-serif;"><span style="color:#d7d7d7;font-size:12px">&copy; <img src="https://velhub.xyz/velhub-2-webmail.png" alt="데브런닷스튜디오" width="90" height="12"> All rights reserved. <strong style="color:#ff69b4;padding-left:12px">&hearts; velhub</strong></span></div></td></tr>
        </table>
      `,
    });

    if (sendResult.error) {
      console.error('[password-reset-mail] send error', sendResult.error);
    }

    return successResponse();
  } catch (unknownError) {
    console.error('[password-reset-mail] unexpected error', unknownError);
    return successResponse();
  }
}
