import { decrypt } from '@/lib/encryption/decrypt';
import { getVatBreakdown, toNumber } from '@/lib/revenue/amounts';
import {
  getRevenueFilterOptions,
  isDateInRevenueRange,
  type RevenueFilterOptions,
  type RevenueFilterParams,
} from '@/lib/revenue/filters';
import { getPaymentStatusLabel, getPaymentTypeLabel, getSettlementStatusLabel } from '@/lib/revenue/labels';
import type { RevenueContext } from '@/lib/revenue/context';

export type RevenueListKind = 'transactions' | 'refunds' | 'scheduled' | 'confirmed' | 'completed';

type UnknownRecord = Record<string, unknown>;

type PaymentSplitRow = UnknownRecord & {
  id: string;
  payment_id: string | null;
  board_id: string | null;
  series_id: string | null;
  post_id: string | null;
  amount: number | string | null;
  settlement_amount: number | string | null;
  pg_fee_amount: number | string | null;
  platform_fee_amount: number | string | null;
  created_at: string | null;
};

export type RevenueListItem = {
  id: string;
  buyerName: string | null;
  buyerEmail: string | null;
  boardName: string | null;
  seriesName: string | null;
  postTitle: string | null;
  paymentType: string;
  status: string;
  paymentAmount: number;
  paymentSupplyAmount: number;
  paymentVatAmount: number;
  refundAmount: number;
  refundSupplyAmount: number;
  refundVatAmount: number;
  settlementAmount: number;
  pgFeeAmount: number;
  platformFeeAmount: number;
  paidAt: string | null;
  refundedAt: string | null;
  confirmedAt: string | null;
  completedAt: string | null;
  orderNo: string | null;
};

export type RevenueListResponse = {
  items: RevenueListItem[];
  total: number;
  page: number;
  pageSize: number;
  filters: RevenueFilterOptions;
};

function getStringValue(row: UnknownRecord | null | undefined, key: string) {
  const value = row?.[key];

  if (typeof value !== 'string') {
    return null;
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  return trimmedValue;
}

function getFirstStringValue(row: UnknownRecord | null | undefined, keys: string[]) {
  return keys.map((key) => getStringValue(row, key)).find((value): value is string => !!value) ?? null;
}

function getIdValue(row: UnknownRecord | null | undefined, key: string) {
  const value = row?.[key];

  if (typeof value !== 'string' || !value) {
    return null;
  }

  return value;
}

function isEncryptedValue(value: string) {
  return value.split(':').length === 3;
}

function decryptValue(value: string | null) {
  if (!value) {
    return null;
  }

  if (!isEncryptedValue(value)) {
    return value;
  }

  try {
    return decrypt(value);
  } catch {
    return null;
  }
}

function uniqueIds(values: (string | null)[]) {
  return [...new Set(values.filter((value): value is string => !!value))];
}

function getPaymentId(payment: UnknownRecord | null) {
  return getIdValue(payment, 'id');
}

function getPaymentBuyerId(payment: UnknownRecord | null) {
  return getIdValue(payment, 'buyer_user_id');
}

function getBoardName(board: UnknownRecord | null) {
  return getFirstStringValue(board, ['name', 'board_name', 'title', 'label', 'subject']);
}

function getSeriesName(series: UnknownRecord | null) {
  return getFirstStringValue(series, ['title', 'name', 'subject', 'series_name', 'label']);
}

function getPostTitle(post: UnknownRecord | null) {
  return getFirstStringValue(post, ['title', 'subject', 'post_title', 'label']);
}

function getPaidAt(payment: UnknownRecord | null) {
  return getFirstStringValue(payment, ['paid_at', 'approved_at', 'created_at']);
}

function getRefundedAt(payment: UnknownRecord | null) {
  return getFirstStringValue(payment, ['refunded_at', 'cancelled_at', 'canceled_at']);
}

function getPaymentDateForKind(item: RevenueListItem, kind: RevenueListKind) {
  if (kind === 'refunds') {
    return item.refundedAt;
  }

  return item.paidAt;
}

function shouldIncludeItem(item: RevenueListItem, kind: RevenueListKind) {
  if (kind === 'refunds') {
    return !!item.refundedAt || item.refundAmount > 0;
  }

  if (kind === 'scheduled') {
    return item.status === getSettlementStatusLabel('scheduled');
  }

  if (kind === 'confirmed') {
    return item.status === getSettlementStatusLabel('confirmed');
  }

  if (kind === 'completed') {
    return item.status === getSettlementStatusLabel('completed');
  }

  return true;
}

function getRefundAmount(payment: UnknownRecord | null) {
  return toNumber(payment?.refunded_amount);
}

function getPaymentAmount(split: PaymentSplitRow, payment: UnknownRecord | null) {
  return toNumber(payment?.amount ?? split.amount);
}

function getMapRows(rows: UnknownRecord[]) {
  return new Map(rows.map((row) => [String(row.id), row]));
}

function getMapRowsByKey(rows: UnknownRecord[], key: string) {
  return new Map(
    rows
      .map((row) => {
        const value = getStringValue(row, key);

        if (!value) {
          return null;
        }

        return [value, row] as const;
      })
      .filter((entry): entry is readonly [string, UnknownRecord] => Boolean(entry)),
  );
}

function getBuyerName(params: { stigma: UnknownRecord | null; rhizomeStigma: UnknownRecord | null }) {
  return getStringValue(params.rhizomeStigma, 'nickname') ?? decryptValue(getStringValue(params.stigma, 'user_name'));
}

function getBuyerEmail(stigma: UnknownRecord | null) {
  return decryptValue(getStringValue(stigma, 'payment_email'));
}

async function getRowsByIds(context: RevenueContext, tableName: string, ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const result = await context.supabase.from(tableName).select('*').in('id', ids);

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as UnknownRecord[];
}

async function getSiteSplitRows(context: RevenueContext) {
  const result = await context.supabase
    .from('payment_splits')
    .select('*')
    .eq('site_id', context.siteId)
    .order('created_at', { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as PaymentSplitRow[];
}

async function getSettlementSplitRows(context: RevenueContext) {
  const result = await context.supabase
    .from('payment_splits')
    .select('*')
    .eq('site_id', context.siteId)
    .eq('receiver_user_id', context.stigmaId)
    .order('created_at', { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as PaymentSplitRow[];
}

async function getPaymentRowsByIdsForBuyer(context: RevenueContext, paymentIds: string[]) {
  if (paymentIds.length === 0) {
    return [];
  }

  const result = await context.supabase
    .from('payments')
    .select('*')
    .in('id', paymentIds)
    .eq('buyer_user_id', context.particleId)
    .order('created_at', { ascending: false });

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as UnknownRecord[];
}

async function getStigmaRowsByParticleIds(context: RevenueContext, particleIds: string[]) {
  if (particleIds.length === 0) {
    return [];
  }

  const result = await context.supabase
    .from('stigmas')
    .select('id, user_id, user_name, payment_email')
    .in('user_id', particleIds);

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as UnknownRecord[];
}

async function getRhizomeStigmaRowsByStigmaIds(context: RevenueContext, stigmaIds: string[]) {
  if (stigmaIds.length === 0) {
    return [];
  }

  const result = await context.supabase
    .from('rhizome_stigmas')
    .select('user_id, nickname')
    .eq('site_id', context.siteId)
    .in('user_id', stigmaIds);

  if (result.error) {
    throw result.error;
  }

  return (result.data ?? []) as UnknownRecord[];
}

function getSplitMapByPaymentId(splitRows: PaymentSplitRow[]) {
  const splitMap = new Map<string, PaymentSplitRow>();

  splitRows.forEach((split) => {
    if (split.payment_id && !splitMap.has(split.payment_id)) {
      splitMap.set(split.payment_id, split);
    }
  });

  return splitMap;
}

function mapRevenueListItem(params: {
  split: PaymentSplitRow;
  payment: UnknownRecord | null;
  board: UnknownRecord | null;
  series: UnknownRecord | null;
  post: UnknownRecord | null;
  stigma: UnknownRecord | null;
  rhizomeStigma: UnknownRecord | null;
  settlement: UnknownRecord | null;
}): RevenueListItem {
  const paymentAmount = getVatBreakdown(getPaymentAmount(params.split, params.payment));
  const refundAmount = getVatBreakdown(getRefundAmount(params.payment));
  const paymentType = getFirstStringValue(params.payment, ['payment_type', 'type']);
  const paymentStatus = getFirstStringValue(params.payment, ['status']);
  const settlementStatus = getFirstStringValue(params.settlement, ['status']);

  return {
    id: params.split.id,
    buyerName: getBuyerName({
      stigma: params.stigma,
      rhizomeStigma: params.rhizomeStigma,
    }),
    buyerEmail: getBuyerEmail(params.stigma),
    boardName: getBoardName(params.board),
    seriesName: getSeriesName(params.series),
    postTitle: getPostTitle(params.post),
    paymentType: getPaymentTypeLabel(paymentType),
    status: settlementStatus ? getSettlementStatusLabel(settlementStatus) : getPaymentStatusLabel(paymentStatus),
    paymentAmount: paymentAmount.totalAmount,
    paymentSupplyAmount: paymentAmount.supplyAmount,
    paymentVatAmount: paymentAmount.vatAmount,
    refundAmount: refundAmount.totalAmount,
    refundSupplyAmount: refundAmount.supplyAmount,
    refundVatAmount: refundAmount.vatAmount,
    settlementAmount: toNumber(params.split.settlement_amount ?? params.split.amount),
    pgFeeAmount: toNumber(params.split.pg_fee_amount),
    platformFeeAmount: toNumber(params.split.platform_fee_amount),
    paidAt: getPaidAt(params.payment),
    refundedAt: getRefundedAt(params.payment),
    confirmedAt: getFirstStringValue(params.settlement, ['confirmed_at']),
    completedAt: getFirstStringValue(params.settlement, ['completed_at']),
    orderNo: getFirstStringValue(params.payment, ['order_no', 'merchant_uid', 'payment_id']),
  };
}

async function getSettlementMaps(context: RevenueContext, splitIds: string[]) {
  if (splitIds.length === 0) {
    return new Map<string, UnknownRecord>();
  }

  const itemResult = await context.supabase.from('settlement_items').select('*').in('payment_split_id', splitIds);

  if (itemResult.error) {
    throw itemResult.error;
  }

  const itemRows = (itemResult.data ?? []) as UnknownRecord[];
  const settlementIds = uniqueIds(itemRows.map((row) => getIdValue(row, 'settlement_id')));
  const settlementRows = await getRowsByIds(context, 'settlements', settlementIds);
  const settlementMap = getMapRows(settlementRows);
  const splitSettlementMap = new Map<string, UnknownRecord>();

  itemRows.forEach((itemRow) => {
    const splitId = getIdValue(itemRow, 'payment_split_id');
    const settlementId = getIdValue(itemRow, 'settlement_id');
    const settlement = settlementId ? settlementMap.get(settlementId) : null;

    if (splitId && settlement) {
      splitSettlementMap.set(splitId, settlement);
    }
  });

  return splitSettlementMap;
}

async function hydrateRevenueListItems(params: {
  context: RevenueContext;
  splitRows: PaymentSplitRow[];
  paymentRows: UnknownRecord[];
  includeSettlements: boolean;
}) {
  const { context, splitRows, paymentRows, includeSettlements } = params;
  const paymentMap = getMapRows(paymentRows);
  const boardIds = uniqueIds(splitRows.map((row) => row.board_id));
  const seriesIds = uniqueIds(splitRows.map((row) => row.series_id));
  const postIds = uniqueIds(splitRows.map((row) => row.post_id));
  const buyerParticleIds = uniqueIds(paymentRows.map((payment) => getPaymentBuyerId(payment)));

  const [boardRows, seriesRows, postRows, stigmaRows, splitSettlementMap] = await Promise.all([
    getRowsByIds(context, 'boards', boardIds),
    getRowsByIds(context, 'board_series', seriesIds),
    getRowsByIds(context, 'posts', postIds),
    getStigmaRowsByParticleIds(context, buyerParticleIds),
    includeSettlements
      ? getSettlementMaps(context, uniqueIds(splitRows.map((row) => row.id)))
      : new Map<string, UnknownRecord>(),
  ]);

  const stigmaMap = getMapRowsByKey(stigmaRows, 'user_id');
  const stigmaIds = uniqueIds(stigmaRows.map((stigma) => getIdValue(stigma, 'id')));
  const rhizomeStigmaRows = await getRhizomeStigmaRowsByStigmaIds(context, stigmaIds);
  const rhizomeStigmaMap = getMapRowsByKey(rhizomeStigmaRows, 'user_id');
  const boardMap = getMapRows(boardRows);
  const seriesMap = getMapRows(seriesRows);
  const postMap = getMapRows(postRows);

  return splitRows.map((split) => {
    const payment = split.payment_id ? (paymentMap.get(split.payment_id) ?? null) : null;
    const buyerParticleId = getPaymentBuyerId(payment);
    const stigma = buyerParticleId ? (stigmaMap.get(buyerParticleId) ?? null) : null;
    const stigmaId = getIdValue(stigma, 'id');

    return mapRevenueListItem({
      split,
      payment,
      board: split.board_id ? (boardMap.get(split.board_id) ?? null) : null,
      series: split.series_id ? (seriesMap.get(split.series_id) ?? null) : null,
      post: split.post_id ? (postMap.get(split.post_id) ?? null) : null,
      stigma,
      rhizomeStigma: stigmaId ? (rhizomeStigmaMap.get(stigmaId) ?? null) : null,
      settlement: splitSettlementMap.get(split.id) ?? null,
    });
  });
}

async function getPaymentListItems(context: RevenueContext) {
  const siteSplitRows = await getSiteSplitRows(context);
  const sitePaymentIds = uniqueIds(siteSplitRows.map((split) => split.payment_id));
  const paymentRows = await getPaymentRowsByIdsForBuyer(context, sitePaymentIds);
  const paymentIds = uniqueIds(paymentRows.map((payment) => getPaymentId(payment)));
  const splitMap = getSplitMapByPaymentId(siteSplitRows);
  const splitRows = paymentIds
    .map((paymentId) => splitMap.get(paymentId) ?? null)
    .filter((split): split is PaymentSplitRow => Boolean(split));

  return hydrateRevenueListItems({
    context,
    splitRows,
    paymentRows,
    includeSettlements: false,
  });
}

async function getSettlementListItems(context: RevenueContext) {
  const splitRows = await getSettlementSplitRows(context);
  const paymentIds = uniqueIds(splitRows.map((split) => split.payment_id));
  const paymentRows = await getRowsByIds(context, 'payments', paymentIds);

  return hydrateRevenueListItems({
    context,
    splitRows,
    paymentRows,
    includeSettlements: true,
  });
}

export async function getRevenueList(
  context: RevenueContext,
  kind: RevenueListKind,
  filterParams: RevenueFilterParams,
): Promise<RevenueListResponse> {
  const allItems =
    kind === 'transactions' || kind === 'refunds'
      ? await getPaymentListItems(context)
      : await getSettlementListItems(context);

  const kindItems = allItems.filter((item) => shouldIncludeItem(item, kind));
  const filteredItems = kindItems.filter((item) =>
    isDateInRevenueRange(getPaymentDateForKind(item, kind), filterParams),
  );
  const from = (filterParams.page - 1) * filterParams.pageSize;
  const to = from + filterParams.pageSize;

  return {
    items: filteredItems.slice(from, to),
    total: filteredItems.length,
    page: filterParams.page,
    pageSize: filterParams.pageSize,
    filters: getRevenueFilterOptions(kindItems.map((item) => getPaymentDateForKind(item, kind))),
  };
}
