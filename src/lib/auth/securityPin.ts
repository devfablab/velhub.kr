export const SECURITY_PIN_LENGTH = 6;

export function normalizeSecurityPin(value: string | null | undefined) {
  return typeof value === 'string' ? value.replace(/\D/g, '').slice(0, SECURITY_PIN_LENGTH) : '';
}

export function isSecurityPinFormat(value: string) {
  return new RegExp(`^\\d{${SECURITY_PIN_LENGTH}}$`).test(value);
}

export function isWeakSecurityPin(value: string) {
  const digits = Array.from(value, Number);

  if (digits.every((digit) => digit === digits[0])) {
    return true;
  }

  const isAscending = digits.every((digit, index) => index === 0 || digit === (digits[index - 1] + 1) % 10);
  const isDescending = digits.every((digit, index) => index === 0 || digit === (digits[index - 1] + 9) % 10);

  return isAscending || isDescending;
}

export function getSecurityPinErrorMessage(pin: string, pinConfirm: string) {
  if (!isSecurityPinFormat(pin)) {
    return '보안 비밀번호는 숫자 6자리로 입력해 주세요.';
  }

  if (isWeakSecurityPin(pin)) {
    return '같은 숫자만 반복하거나 차례로 이어지는 번호는 쓸 수 없습니다.';
  }

  if (pin !== pinConfirm) {
    return '보안 비밀번호 확인이 일치하지 않습니다.';
  }

  return '';
}

export const SECURITY_PIN_ACKNOWLEDGE_MESSAGE = '보안 비밀번호를 잊어버리면 되찾을 수 없다는 것을 확인해 주세요.';
