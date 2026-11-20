export function hasMultipleBlogAdLinkDomains(items: readonly { linkUrl: string }[]) {
  if (items.length < 2) return false;

  const domains = new Set<string>();
  for (const item of items) {
    try {
      domains.add(new URL(item.linkUrl).hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  return domains.size > 1;
}
