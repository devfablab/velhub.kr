export type VatBreakdown = {
  totalAmount: number;
  supplyAmount: number;
  vatAmount: number;
};

export function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsedValue = Number(value);

    if (Number.isFinite(parsedValue)) {
      return parsedValue;
    }
  }

  return 0;
}

export function getVatBreakdown(vatIncludedAmountValue: unknown): VatBreakdown {
  const totalAmount = toNumber(vatIncludedAmountValue);
  const supplyAmount = Math.round(totalAmount / 1.1);
  const vatAmount = totalAmount - supplyAmount;

  return {
    totalAmount,
    supplyAmount,
    vatAmount,
  };
}
