export const AI_USAGE_VALUES = ['none', 'partial', 'most'] as const;

export type AiUsage = (typeof AI_USAGE_VALUES)[number];

export const AI_USAGE_OPTIONS: { value: AiUsage; label: string; description: string; chipLabel: string | null }[] = [
  { value: 'none', label: '사용 안 함', description: '처음부터 끝까지 직접 썼어요', chipLabel: null },
  {
    value: 'partial',
    label: '일부 도움',
    description: '초안, 구조, 예제 코드 일부를 AI와 함께 만들었어요',
    chipLabel: 'AI 보조',
  },
  {
    value: 'most',
    label: '대부분 AI 작성',
    description: 'AI가 쓴 내용을 거의 그대로 사용했어요',
    chipLabel: 'AI 생성',
  },
];

export function normalizeAiUsage(value: unknown): AiUsage | null {
  return typeof value === 'string' && (AI_USAGE_VALUES as readonly string[]).includes(value)
    ? (value as AiUsage)
    : null;
}

export function getAiUsageChipLabel(value: unknown) {
  const aiUsage = normalizeAiUsage(value);
  return AI_USAGE_OPTIONS.find((option) => option.value === aiUsage)?.chipLabel ?? null;
}

export const AI_USAGE_REQUIRED_MESSAGE = 'AI 활용 정도를 선택해 주세요.';
