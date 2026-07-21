import { getRevenueContext, getRevenueErrorResponse, RevenueError } from '@/lib/revenue/context';
import { getRevenueXlsxBuffer } from '@/lib/revenue/export';
import { getRevenueFilterParams } from '@/lib/revenue/filters';
import { getRevenueList, type RevenueListKind } from '@/lib/revenue/list';

function isRevenueListKind(value: string | null): value is RevenueListKind {
  return (
    value === 'transactions' ||
    value === 'refunds' ||
    value === 'scheduled' ||
    value === 'confirmed' ||
    value === 'completed'
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    if (!isRevenueListKind(type)) {
      throw new RevenueError('다운로드 유형이 올바르지 않습니다.', 400);
    }

    const context = await getRevenueContext(url.searchParams.get('siteName'));
    const filterParams = {
      ...getRevenueFilterParams(url.searchParams),
      page: 1,
      pageSize: 10000,
    };
    const response = await getRevenueList(context, type, filterParams);
    const xlsxBuffer = await getRevenueXlsxBuffer(response.items);

    return new Response(xlsxBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="revenue-${type}.xlsx"`,
      },
    });
  } catch (error) {
    return getRevenueErrorResponse(error);
  }
}
