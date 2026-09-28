const DANGEROUS_ELEMENT_PATTERN =
  /<(?:script|foreignObject|iframe|object|embed|audio|video|image|animate(?:Motion|Transform|Color)?|set|style)\b[^>]*>[\s\S]*?<\/(?:script|foreignObject|iframe|object|embed|audio|video|image|animate(?:Motion|Transform|Color)?|set|style)\s*>/gi;
const SELF_CLOSING_DANGEROUS_ELEMENT_PATTERN =
  /<(?:script|foreignObject|iframe|object|embed|audio|video|image|animate(?:Motion|Transform|Color)?|set|style)\b[^>]*\/\s*>/gi;
const EVENT_ATTRIBUTE_PATTERN = /\s+on[a-z0-9:_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const EXTERNAL_REFERENCE_ATTRIBUTE_PATTERN =
  /\s+(?:href|xlink:href)\s*=\s*(?:"\s*(?:javascript:|data:|https?:|\/\/)[^"]*"|'\s*(?:javascript:|data:|https?:|\/\/)[^']*'|(?:javascript:|data:|https?:|\/\/)[^\s>]+)/gi;
const UNSAFE_STYLE_ATTRIBUTE_PATTERN =
  /\s+style\s*=\s*(?:"[^"]*(?:url\s*\(|@import|expression\s*\()[^"]*"|'[^']*(?:url\s*\(|@import|expression\s*\()[^']*'|[^\s>]*(?:url\s*\(|@import|expression\s*\()[^\s>]*)/gi;
const EXTERNAL_URL_ATTRIBUTE_PATTERN =
  /\s+[a-z][a-z0-9:_-]*\s*=\s*(?:"[^"]*url\(\s*['"]?\s*(?:javascript:|data:|https?:|\/\/)[^"]*"|'[^']*url\(\s*['"]?\s*(?:javascript:|data:|https?:|\/\/)[^']*'|[^\s>]*url\(\s*['"]?\s*(?:javascript:|data:|https?:|\/\/)[^\s>]*)/gi;

export function sanitizeSvg(input: Buffer) {
  const source = input.toString('utf8');

  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(source)) {
    throw new Error('유효한 SVG 파일이 아닙니다.');
  }

  const sanitized = source
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<!ENTITY[\s\S]*?>/gi, '')
    .replace(DANGEROUS_ELEMENT_PATTERN, '')
    .replace(SELF_CLOSING_DANGEROUS_ELEMENT_PATTERN, '')
    .replace(EVENT_ATTRIBUTE_PATTERN, '')
    .replace(EXTERNAL_REFERENCE_ATTRIBUTE_PATTERN, '')
    .replace(UNSAFE_STYLE_ATTRIBUTE_PATTERN, '')
    .replace(EXTERNAL_URL_ATTRIBUTE_PATTERN, '');

  if (!/<svg\b[^>]*>/i.test(sanitized) || !/<\/svg\s*>/i.test(sanitized)) {
    throw new Error('유효한 SVG 파일이 아닙니다.');
  }

  return Buffer.from(sanitized, 'utf8');
}
