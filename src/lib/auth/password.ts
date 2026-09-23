export const PASSWORD_REQUIREMENTS = '8자 이상이며 영문 대문자·소문자, 숫자, 특수문자를 각각 1자 이상 포함해야 합니다.';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\p{P}\p{S}]).{8,}$/u;

export function isValidPassword(password: string) {
  return PASSWORD_PATTERN.test(password);
}
