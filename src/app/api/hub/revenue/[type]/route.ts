import { getRevenueContext, getRevenueErrorResponse, RevenueError } from '@/lib/revenue/context';
import { getRevenueFilterParams } from '@/lib/revenue/filters';
import { getRevenueList, type RevenueListKind } from '@/lib/revenue/list';

type RouteContext = {
  params: Promise<{
    type: string;
  }>;
};

function isRevenueListKind(value: string): value is RevenueListKind {
  return (
    value === 'transactions' ||
    value === 'refunds' ||
    value === 'scheduled' ||
    value === 'confirmed' ||
    value === 'completed'
  );
}

export async function GET(request: Request, routeContext: RouteContext) {
  try {
    const { type } = await routeContext.params;

    if (!isRevenueListKind(type)) {
      throw new RevenueError('조회 유형이 올바르지 않습니다.', 400);
    }

    const url = new URL(request.url);
    const context = await getRevenueContext(url.searchParams.get('siteName'));
    const filterParams = getRevenueFilterParams(url.searchParams);
    const response = await getRevenueList(context, type, filterParams);

    return Response.json(response);
  } catch (error) {
    return getRevenueErrorResponse(error);
  }
}
