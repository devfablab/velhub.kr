import { normalizeCustomDomain } from './customDomain';

export function getPublicSiteUrl({
  siteKey,
  customDomain,
  hasOwnerDomainFeature,
}: {
  siteKey: string;
  customDomain: string | null | undefined;
  hasOwnerDomainFeature: boolean;
}) {
  const domain = normalizeCustomDomain(customDomain);

  if (domain && hasOwnerDomainFeature) {
    return `https://${domain}`;
  }

  return `/${siteKey}`;
}

export function getPublicSiteContentUrl(siteUrl: string, pathname: string) {
  return `${siteUrl.replace(/\/$/, '')}/${pathname.replace(/^\//, '')}`;
}
