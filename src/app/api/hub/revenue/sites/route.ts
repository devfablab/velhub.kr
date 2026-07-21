import { getRevenueErrorResponse, getRevenueSites } from '@/lib/revenue/context';

export async function GET() {
  try {
    const sites = await getRevenueSites();

    return Response.json({ sites });
  } catch (error) {
    return getRevenueErrorResponse(error);
  }
}
