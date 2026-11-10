export const SPELL_CHECK_PLACEHOLDER = '〈생략〉';

export type SpellCheckSectionKind = 'plain' | 'markdown';

type Segment = {
  maskedStart: number;
  maskedEnd: number;
  originalStart: number;
  isProtected: boolean;
};

export type SpellCheckBlock = {
  start: number;
  end: number;
  text: string;
  maskedText: string;
  segments: Segment[];
  isCheckable: boolean;
};

export type SpellCheckSpan = {
  start: number;
  end: number;
  origin: string;
  revised: string;
};

const ALIGN_FENCE_LANGUAGES = new Set(['left', 'center', 'right', 'justify']);
const FENCE_PATTERN = /^\s*(`{3,}|~{3,})\s*([\w-]*)/;
const PROTECTED_PATTERNS = [
  /`[^`\n]*`/g,
  /!\[[^\]\n]*\]\([^)\n]*\)/g,
  /\]\([^)\n]*\)/g,
  /<[^>\n]+>/g,
  /https?:\/\/[^\s)<>]+/g,
  /[\w.+-]+@[\w-]+(\.[\w-]+)+/g,
  /&[a-zA-Z]+;/g,
  /^\s*\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{0,}:?\s*$/gm,
];

function getProtectedRanges(text: string) {
  const ranges: Array<[number, number]> = [];

  for (const pattern of PROTECTED_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match.index === undefined || match[0].length === 0) continue;
      ranges.push([match.index, match.index + match[0].length]);
    }
  }

  ranges.sort((first, second) => first[0] - second[0]);

  const merged: Array<[number, number]> = [];

  for (const range of ranges) {
    const last = merged[merged.length - 1];

    if (last && range[0] <= last[1]) {
      last[1] = Math.max(last[1], range[1]);
    } else {
      merged.push([range[0], range[1]]);
    }
  }

  return merged;
}

function createBlock(source: string, start: number, end: number): SpellCheckBlock {
  const text = source.slice(start, end);
  const segments: Segment[] = [];
  let maskedText = '';
  let cursor = 0;

  for (const [rangeStart, rangeEnd] of getProtectedRanges(text)) {
    if (rangeStart > cursor) {
      segments.push({
        maskedStart: maskedText.length,
        maskedEnd: maskedText.length + rangeStart - cursor,
        originalStart: cursor,
        isProtected: false,
      });
      maskedText += text.slice(cursor, rangeStart);
    }

    segments.push({
      maskedStart: maskedText.length,
      maskedEnd: maskedText.length + SPELL_CHECK_PLACEHOLDER.length,
      originalStart: rangeStart,
      isProtected: true,
    });
    maskedText += SPELL_CHECK_PLACEHOLDER;
    cursor = rangeEnd;
  }

  if (cursor < text.length) {
    segments.push({
      maskedStart: maskedText.length,
      maskedEnd: maskedText.length + text.length - cursor,
      originalStart: cursor,
      isProtected: false,
    });
    maskedText += text.slice(cursor);
  }

  return {
    start,
    end,
    text,
    maskedText,
    segments,
    isCheckable: /[가-힣]/.test(maskedText.split(SPELL_CHECK_PLACEHOLDER).join('')),
  };
}

export function splitSpellCheckBlocks(value: string, kind: SpellCheckSectionKind) {
  if (kind === 'plain') {
    return value.trim() ? [createBlock(value, 0, value.length)] : [];
  }

  const blocks: SpellCheckBlock[] = [];
  const lines = value.split('\n');
  let offset = 0;
  let paragraphStart = -1;
  let paragraphEnd = -1;
  let fence: { marker: string; isAlign: boolean } | null = null;

  function closeParagraph() {
    if (paragraphStart >= 0) {
      blocks.push(createBlock(value, paragraphStart, paragraphEnd));
    }

    paragraphStart = -1;
    paragraphEnd = -1;
  }

  for (const line of lines) {
    const lineStart = offset;
    const lineEnd = offset + line.length;
    offset = lineEnd + 1;
    const fenceMatch = line.match(FENCE_PATTERN);

    if (fence) {
      if (fenceMatch && fenceMatch[1].startsWith(fence.marker) && !fenceMatch[2]) {
        closeParagraph();
        fence = null;
        continue;
      }

      if (!fence.isAlign) continue;
    } else if (fenceMatch) {
      closeParagraph();
      fence = {
        marker: fenceMatch[1],
        isAlign: ALIGN_FENCE_LANGUAGES.has(fenceMatch[2].toLowerCase()),
      };
      continue;
    }

    if (!line.trim()) {
      closeParagraph();
      continue;
    }

    if (paragraphStart < 0) paragraphStart = lineStart;
    paragraphEnd = lineEnd;
  }

  closeParagraph();

  return blocks;
}

function toOriginalIndex(block: SpellCheckBlock, maskedIndex: number, isEnd: boolean) {
  const segment = block.segments.find((item) =>
    isEnd
      ? maskedIndex > item.maskedStart && maskedIndex <= item.maskedEnd
      : maskedIndex >= item.maskedStart && maskedIndex < item.maskedEnd,
  );

  if (!segment || segment.isProtected) return -1;

  return segment.originalStart + maskedIndex - segment.maskedStart;
}

export function locateCorrection(block: SpellCheckBlock, origin: string, fromIndex: number) {
  if (!origin || origin.includes(SPELL_CHECK_PLACEHOLDER)) return null;

  const candidates: number[] = [];
  let searchIndex = block.maskedText.indexOf(origin);

  while (searchIndex >= 0) {
    candidates.push(searchIndex);
    searchIndex = block.maskedText.indexOf(origin, searchIndex + 1);
  }

  const ordered = [
    ...candidates.filter((index) => index >= fromIndex),
    ...candidates.filter((index) => index < fromIndex),
  ];

  for (const maskedStart of ordered) {
    const start = toOriginalIndex(block, maskedStart, false);
    const end = toOriginalIndex(block, maskedStart + origin.length, true);

    if (start >= 0 && end > start && block.text.slice(start, end) === origin) {
      return { start, end, maskedEnd: maskedStart + origin.length };
    }
  }

  return null;
}

export function rebuildText<T extends SpellCheckSpan>(
  text: string,
  spans: T[],
  pickText: (span: T) => string,
): { text: string; spans: T[] } {
  const ordered = [...spans].sort((first, second) => first.start - second.start);
  let result = '';
  let cursor = 0;
  const nextSpans: T[] = [];

  for (const span of ordered) {
    if (span.start < cursor) continue;
    result += text.slice(cursor, span.start);
    const replacement = pickText(span);
    nextSpans.push({ ...span, start: result.length, end: result.length + replacement.length });
    result += replacement;
    cursor = span.end;
  }

  result += text.slice(cursor);

  return { text: result, spans: nextSpans };
}
