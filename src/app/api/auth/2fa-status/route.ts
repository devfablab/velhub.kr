import { getSessionClaims } from '@/lib/session';

export async function GET() {
  const sessionClaims = await getSessionClaims();

  return Response.json({
    needsTotp: Boolean(
      sessionClaims?.userId && sessionClaims.authenticationLevel === 'aal1' && sessionClaims.hasTotp === true,
    ),
  });
}
