'use client';

import InlineLink from './InlineLink';

const URL_PATTERN = /(https?:\/\/[^\s<]+)/g;

export default function ContentWithInlineLinks({ content, limit }: { content: string; limit?: number }) {
  const displayContent = typeof limit === 'number' && content.length > limit ? content.slice(0, limit) : content;
  return (
    <>
      {displayContent
        .split(URL_PATTERN)
        .map((part, index) => (/^https?:\/\//.test(part) ? <InlineLink href={part} key={`${part}-${index}`} /> : part))}
    </>
  );
}
