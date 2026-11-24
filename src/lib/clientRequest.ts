type HeaderReader = {
  get(name: string): string | null;
};

export type ClientLocation = {
  country: string | null;
  region: string | null;
};

const CLOUDFLARE_IPV4_RANGES = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
];

const CLOUDFLARE_IPV6_RANGES = [
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

function readHeader(headerList: HeaderReader, name: string) {
  return (headerList.get(name) ?? '').trim();
}

function parseIpv4(address: string) {
  const parts = address.split('.');

  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) {
    return null;
  }

  return parts.reduce((total, part) => total * BigInt(256) + BigInt(part), BigInt(0));
}

function parseIpv6(address: string) {
  if (!address.includes(':') || address.includes('.')) {
    return null;
  }

  const [head = '', tail, extra] = address.split('::');

  if (extra !== undefined) {
    return null;
  }

  const headGroups = head ? head.split(':') : [];
  const tailGroups = tail ? tail.split(':') : [];
  const missingCount = 8 - headGroups.length - tailGroups.length;

  if ((tail === undefined && missingCount !== 0) || missingCount < 0) {
    return null;
  }

  const groups = [...headGroups, ...Array.from({ length: missingCount }, () => '0'), ...tailGroups];

  if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) {
    return null;
  }

  return groups.reduce((total, group) => total * BigInt(65536) + BigInt(Number.parseInt(group, 16)), BigInt(0));
}

function isInRanges(address: string, ranges: string[], parse: (value: string) => bigint | null, bitLength: bigint) {
  const value = parse(address);

  if (value === null) {
    return false;
  }

  return ranges.some((range) => {
    const [rangeAddress = '', prefixText = ''] = range.split('/');
    const rangeValue = parse(rangeAddress);
    const prefix = BigInt(prefixText);

    if (rangeValue === null) {
      return false;
    }

    const shift = bitLength - prefix;
    return value >> shift === rangeValue >> shift;
  });
}

function isCloudflareAddress(address: string) {
  return (
    isInRanges(address, CLOUDFLARE_IPV4_RANGES, parseIpv4, BigInt(32)) ||
    isInRanges(address, CLOUDFLARE_IPV6_RANGES, parseIpv6, BigInt(128))
  );
}

function getConnectingAddress(headerList: HeaderReader) {
  return readHeader(headerList, 'x-real-ip') || readHeader(headerList, 'x-forwarded-for').split(',')[0]?.trim() || '';
}

function isThroughCloudflare(headerList: HeaderReader) {
  const connectingAddress = getConnectingAddress(headerList);
  return Boolean(
    connectingAddress && readHeader(headerList, 'cf-connecting-ip') && isCloudflareAddress(connectingAddress),
  );
}

export function getClientIpAddress(headerList: HeaderReader) {
  if (isThroughCloudflare(headerList)) {
    return readHeader(headerList, 'cf-connecting-ip');
  }

  return getConnectingAddress(headerList) || null;
}

export function getClientLocation(headerList: HeaderReader): ClientLocation {
  if (isThroughCloudflare(headerList)) {
    const country = readHeader(headerList, 'cf-ipcountry').toUpperCase();

    return {
      country: country && country !== 'XX' ? country : null,
      region: readHeader(headerList, 'cf-region-code').toUpperCase() || null,
    };
  }

  return {
    country: readHeader(headerList, 'x-vercel-ip-country').toUpperCase() || null,
    region: readHeader(headerList, 'x-vercel-ip-country-region').toUpperCase() || null,
  };
}
