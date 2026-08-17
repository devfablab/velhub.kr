export function parseCurrencyInput(value: string | number) {
  const digits = String(value).replace(/[^0-9]/g, '');

  return digits ? Number(digits) : 0;
}

export function formatCurrencyInput(value: string | number) {
  const amount = parseCurrencyInput(value);

  return amount ? amount.toLocaleString('ko-KR') : '';
}
