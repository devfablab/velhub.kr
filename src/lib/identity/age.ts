export function getKoreanAge(birthDate: string | null | undefined, today = new Date()) {
  const digits = String(birthDate ?? '').replace(/\D/g, '');

  if (digits.length !== 8) return null;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;

  if (today < birthdayThisYear) age -= 1;

  return age;
}

export function isAtLeast14(birthDate: string | null | undefined) {
  const age = getKoreanAge(birthDate);
  return age !== null && age >= 14;
}

export function isMinor(birthDate: string | null | undefined) {
  const age = getKoreanAge(birthDate);
  return age !== null && age < 19;
}
