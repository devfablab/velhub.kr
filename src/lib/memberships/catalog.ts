export type MembershipType = 'owner' | 'creator' | 'all_in_one' | 'affetto';

export function isMembershipType(value: string): value is MembershipType {
  return ['owner', 'creator', 'all_in_one', 'affetto'].includes(value);
}

export type MembershipFeatureKey =
  | 'owner_lounge'
  | 'owner_domain'
  | 'owner_unlimited_sites'
  | 'creator_lounge'
  | 'creator_branding'
  | 'creator_posts'
  | 'affetto_hide_ads'
  | 'affetto_favorite_folders'
  | 'affetto_my_posts';

export type MembershipFeature = {
  key: MembershipFeatureKey;
  label: string;
  price: number;
  group: 'owner' | 'creator' | 'affetto';
};

export const MEMBERSHIP_FEATURES: MembershipFeature[] = [
  { key: 'owner_lounge', label: '라운지에 사이트 노출', price: 3900, group: 'owner' },
  { key: 'owner_domain', label: '커스텀 도메인 지원', price: 3900, group: 'owner' },
  { key: 'owner_unlimited_sites', label: '사이트 개설 개수 무제한', price: 3900, group: 'owner' },
  { key: 'creator_lounge', label: '라운지에 노출', price: 3900, group: 'creator' },
  { key: 'creator_branding', label: '작가 프로필 브랜딩', price: 3900, group: 'creator' },
  { key: 'creator_posts', label: '연재글 모아서 보여주기', price: 3900, group: 'creator' },
  { key: 'affetto_hide_ads', label: '광고 숨김', price: 3900, group: 'affetto' },
  { key: 'affetto_favorite_folders', label: '즐겨찾기 폴더 관리', price: 3900, group: 'affetto' },
  { key: 'affetto_my_posts', label: '내가 쓴 글 전체보기 및 관리', price: 3900, group: 'affetto' },
];

export const MEMBERSHIP_PACKAGE_PRICE: Record<Exclude<MembershipType, 'affetto'>, number> = {
  owner: 9900,
  creator: 9900,
  all_in_one: 15900,
};

export const AFFETTO_PACKAGE_PRICE = 9900;

export function getMembershipPlanKey(membershipType: MembershipType, featureKey: MembershipFeatureKey) {
  return membershipType === 'all_in_one' ? `all_in_one_${featureKey}` : featureKey;
}

export function getMembershipFeature(featureKey: MembershipFeatureKey) {
  return MEMBERSHIP_FEATURES.find((feature) => feature.key === featureKey) ?? null;
}

export function getMembershipFeatures(group: MembershipFeature['group']) {
  return MEMBERSHIP_FEATURES.filter((feature) => feature.group === group);
}

export function formatMembershipPrice(price: number) {
  return `${price.toLocaleString('ko-KR')} 원`;
}

export function getMembershipPrice(featureKeys: MembershipFeatureKey[], membershipType: MembershipType) {
  if (membershipType === 'all_in_one') {
    const ownerCount = featureKeys.filter((key) => getMembershipFeature(key)?.group === 'owner').length;
    const creatorCount = featureKeys.filter((key) => getMembershipFeature(key)?.group === 'creator').length;

    if (ownerCount >= 2 && creatorCount >= 2) {
      return MEMBERSHIP_PACKAGE_PRICE.all_in_one;
    }

    return featureKeys.reduce((total, key) => total + (getMembershipFeature(key)?.price === 3900 ? 2900 : 0), 0);
  }

  const group = membershipType === 'affetto' ? 'affetto' : membershipType;
  const selectedFeatures = featureKeys.filter((key) => getMembershipFeature(key)?.group === group);
  const availableFeatures = getMembershipFeatures(group);

  if (selectedFeatures.length === availableFeatures.length && availableFeatures.length > 0) {
    return membershipType === 'affetto'
      ? AFFETTO_PACKAGE_PRICE
      : MEMBERSHIP_PACKAGE_PRICE[membershipType];
  }

  return selectedFeatures.reduce((total, key) => total + (getMembershipFeature(key)?.price ?? 0), 0);
}
