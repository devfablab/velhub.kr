import { getActivityNameErrorMessage } from '@/lib/auth/emailSignUp';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getSessionClaims } from '@/lib/session/server';
import { isActivityNameTaken } from '@/lib/users/activityName.server';
import { normalizeDisplayName } from '@/lib/users/displayName';

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url);
    const userName = normalizeDisplayName(requestUrl.searchParams.get('userName'));
    const userNameErrorMessage = getActivityNameErrorMessage(userName);

    if (userNameErrorMessage) {
      return Response.json({ error: userNameErrorMessage }, { status: 400 });
    }

    const sessionClaims = await getSessionClaims();
    const isTaken = await isActivityNameTaken(getSupabaseAdmin(), userName, sessionClaims?.userId);

    return Response.json({ ok: true, isAvailable: !isTaken });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '활동명을 확인하지 못했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '활동명을 확인하지 못했습니다.' }, { status: 500 });
  }
}
