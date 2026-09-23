import { getChannelWorksMember } from '@/lib/channelWorks/member.server';

export async function GET() {
  return Response.json(
    { member: await getChannelWorksMember() },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
