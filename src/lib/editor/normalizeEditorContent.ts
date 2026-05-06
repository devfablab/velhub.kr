import { normalizeText } from '@/lib/utils';

export function normalizeEditorHtml(value: string | null | undefined) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return null;
  }

  const emptyPatterns = ['<p><br></p>', '<p></p>', '<p><br /></p>'];

  if (emptyPatterns.includes(normalizedValue.replace(/\s+/g, ''))) {
    return null;
  }

  const textOnly = normalizedValue
    .replace(/<br\s*\/?>/gi, '')
    .replace(/<\/p>/gi, '')
    .replace(/<p[^>]*>/gi, '')
    .replace(/&nbsp;/gi, '')
    .trim();

  if (!textOnly) {
    return null;
  }

  return normalizedValue;
}
