const MAX_WORD_CELLS = 2_000_000;

export type DiffSegment = { type: 'same' | 'added' | 'removed'; text: string };

function diffTokens(before: string[], after: string[]) {
  const rows = before.length;
  const columns = after.length;
  const table: number[][] = Array.from({ length: rows + 1 }, () => new Array<number>(columns + 1).fill(0));

  for (let row = rows - 1; row >= 0; row -= 1) {
    for (let column = columns - 1; column >= 0; column -= 1) {
      table[row][column] =
        before[row] === after[column]
          ? table[row + 1][column + 1] + 1
          : Math.max(table[row + 1][column], table[row][column + 1]);
    }
  }

  const operations: { type: DiffSegment['type']; token: string }[] = [];
  let row = 0;
  let column = 0;

  while (row < rows && column < columns) {
    if (before[row] === after[column]) {
      operations.push({ type: 'same', token: before[row] });
      row += 1;
      column += 1;
    } else if (table[row + 1][column] >= table[row][column + 1]) {
      operations.push({ type: 'removed', token: before[row] });
      row += 1;
    } else {
      operations.push({ type: 'added', token: after[column] });
      column += 1;
    }
  }

  while (row < rows) {
    operations.push({ type: 'removed', token: before[row] });
    row += 1;
  }

  while (column < columns) {
    operations.push({ type: 'added', token: after[column] });
    column += 1;
  }

  return operations;
}

function pushSegment(segments: DiffSegment[], type: DiffSegment['type'], text: string) {
  if (!text) return;

  const last = segments[segments.length - 1];

  if (last && last.type === type) {
    last.text += text;
    return;
  }

  segments.push({ type, text });
}

function splitWords(value: string) {
  return value.match(/\s+|[^\s]+/g) ?? [];
}

export function getTextDiff(before: string, after: string): DiffSegment[] {
  const lineOperations = diffTokens(before.split('\n'), after.split('\n'));
  const segments: DiffSegment[] = [];
  let index = 0;

  while (index < lineOperations.length) {
    const operation = lineOperations[index];

    if (operation.type === 'same') {
      pushSegment(segments, 'same', `${operation.token}\n`);
      index += 1;
      continue;
    }

    const removedLines: string[] = [];
    const addedLines: string[] = [];

    while (index < lineOperations.length && lineOperations[index].type !== 'same') {
      const changed = lineOperations[index];

      if (changed.type === 'removed') removedLines.push(changed.token);
      else addedLines.push(changed.token);

      index += 1;
    }

    const removedWords = splitWords(removedLines.join('\n'));
    const addedWords = splitWords(addedLines.join('\n'));

    if (removedLines.length > 0 && addedLines.length > 0 && removedWords.length * addedWords.length <= MAX_WORD_CELLS) {
      const wordOperations = diffTokens(removedWords, addedWords);

      for (const wordOperation of wordOperations) {
        pushSegment(segments, wordOperation.type, wordOperation.token);
      }

      pushSegment(segments, 'same', '\n');
      continue;
    }

    for (const line of removedLines) pushSegment(segments, 'removed', `${line}\n`);
    for (const line of addedLines) pushSegment(segments, 'added', `${line}\n`);
  }

  return segments;
}
