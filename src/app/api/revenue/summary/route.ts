import { getRevenueContext, getRevenueErrorResponse } from '@/lib/revenue/context';
import { getRevenueSummary } from '@/lib/revenue/summary';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const context = await getRevenueContext(url.searchParams.get('siteName'));
    const summary = await getRevenueSummary(context);

    return Response.json(summary);
  } catch (error) {
    return getRevenueErrorResponse(error);
  }
}
