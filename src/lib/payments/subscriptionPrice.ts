export const SUBSCRIPTION_PRICE_UNIT = 1000;
export const SUBSCRIPTION_PRICE_MAX = 100000;
export const SERIES_SUBSCRIPTION_MIN_PRICE = 7000;
export const PARENT_SUBSCRIPTION_MIN_PRICE = 10000;

export function isSubscriptionPriceUnit(value: number) {
  return Number.isInteger(value) && value % SUBSCRIPTION_PRICE_UNIT === 0;
}

export function isValidSubscriptionPriceBase(value: number) {
  if (!Number.isInteger(value)) return false;
  if (value > SUBSCRIPTION_PRICE_MAX) return false;

  return isSubscriptionPriceUnit(value);
}

export function getRequiredParentSubscriptionPrice(maxSeriesPrice: number) {
  if (!maxSeriesPrice) return PARENT_SUBSCRIPTION_MIN_PRICE;

  const requiredPrice = Math.ceil((maxSeriesPrice * 10) / 7 / SUBSCRIPTION_PRICE_UNIT) * SUBSCRIPTION_PRICE_UNIT;

  return Math.max(PARENT_SUBSCRIPTION_MIN_PRICE, requiredPrice);
}

export function getMaxAllowedSeriesSubscriptionPrice(parentPrice: number) {
  if (!parentPrice) return SUBSCRIPTION_PRICE_MAX;

  const maxPrice = Math.floor((parentPrice * 7) / 10 / SUBSCRIPTION_PRICE_UNIT) * SUBSCRIPTION_PRICE_UNIT;

  return Math.min(SUBSCRIPTION_PRICE_MAX, maxPrice);
}

export function validateSeriesSubscriptionPrice(price: number) {
  if (!isValidSubscriptionPriceBase(price)) {
    return {
      ok: false,
      message: '연재 구독 금액은 7,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.',
    };
  }

  if (price < SERIES_SUBSCRIPTION_MIN_PRICE) {
    return {
      ok: false,
      message: '연재 구독 금액은 7,000원 이상이어야 합니다.',
    };
  }

  return {
    ok: true,
    message: '',
  };
}

export function validateParentSubscriptionPrice(price: number, maxSeriesPrice: number) {
  if (!isValidSubscriptionPriceBase(price)) {
    return {
      ok: false,
      message: '구독 금액은 10,000원부터 100,000원까지 1,000원 단위로 입력해 주세요.',
    };
  }

  if (price < PARENT_SUBSCRIPTION_MIN_PRICE) {
    return {
      ok: false,
      message: '구독 금액은 10,000원 이상이어야 합니다.',
    };
  }

  const requiredPrice = getRequiredParentSubscriptionPrice(maxSeriesPrice);

  if (price < requiredPrice) {
    return {
      ok: false,
      message: `구독 금액은 설정된 연재 구독 최고가 기준 ${requiredPrice.toLocaleString('ko-KR')}원 이상이어야 합니다.`,
    };
  }

  return {
    ok: true,
    message: '',
  };
}

export function validateSeriesPriceAgainstParentPrice(seriesPrice: number, parentPrice: number) {
  const baseValidation = validateSeriesSubscriptionPrice(seriesPrice);

  if (!baseValidation.ok) {
    return baseValidation;
  }

  if (!parentPrice) {
    return {
      ok: true,
      message: '',
    };
  }

  const maxAllowedSeriesPrice = getMaxAllowedSeriesSubscriptionPrice(parentPrice);

  if (seriesPrice > maxAllowedSeriesPrice) {
    return {
      ok: false,
      message: `연재 구독 금액은 상위 구독 금액 기준 ${maxAllowedSeriesPrice.toLocaleString('ko-KR')}원 이하여야 합니다.`,
    };
  }

  return {
    ok: true,
    message: '',
  };
}
