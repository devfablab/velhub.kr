import { getRevenueErrorResponse, getRevenueSites } from '@/lib/revenue/context';

export async function GET() {
  try {
    const { sites, isAuthor, isSettlementError } = await getRevenueSites();

    return Response.json({ sites, isAuthor, isSettlementError });
  } catch (error) {
    return getRevenueErrorResponse(error);
  }
}
