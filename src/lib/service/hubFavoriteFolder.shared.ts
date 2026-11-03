import { ACTIVITY_NAME_MAX_LENGTH, ACTIVITY_NAME_MIN_LENGTH, isValidActivityName } from '@/lib/auth/emailSignUp';

export function normalizeFavoriteFolderLabel(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateFavoriteFolderLabel(value: unknown) {
  const label = normalizeFavoriteFolderLabel(value);

  return {
    label,
    error: isValidActivityName(label)
      ? ''
      : `폴더 이름은 ${ACTIVITY_NAME_MIN_LENGTH}자 이상 ${ACTIVITY_NAME_MAX_LENGTH}자 이하로 입력해 주세요.`,
  };
}
