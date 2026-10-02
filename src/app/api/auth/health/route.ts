import { getSupabaseAuthHealth } from '@/lib/auth/health.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const health = await getSupabaseAuthHealth();

  return Response.json(health, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
