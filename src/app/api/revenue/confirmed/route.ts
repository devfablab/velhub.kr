import { getRevenueContext, getRevenueErrorResponse } from '@/lib/revenue/context';
import { getRevenueFilterParams } from '@/lib/revenue/filters';
import { getRevenueList } from '@/lib/revenue/list';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const context = await getRevenueContext(url.searchParams.get('siteName'));
    const filterParams = getRevenueFilterParams(url.searchParams);
    const response = await getRevenueList(context, 'confirmed', filterParams);

    return Response.json(response);
  } catch (error) {
    return getRevenueErrorResponse(error);
  }
}
