'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Checkbox, Radio, Snackbar, Stack, Typography } from '@mui/material';
import {
  formatMembershipPrice,
  getMembershipFeatures,
  getMembershipPrice,
  MEMBERSHIP_PACKAGE_PRICE,
  type MembershipFeatureKey,
  type MembershipType,
} from '@/lib/memberships/catalog';
import Anchor from '@/components/Anchor';
import { ThemeMode, useThemeMode } from '@/app/themeProvider';
import styles from '@/app/memberships.module.sass';

type Eligibility = {
  owner: { available: boolean; message: string | null };
  creator: { available: boolean; message: string | null };
  allInOne: { available: boolean; message: string | null };
};

type MembershipStatusResponse = {
  memberships?: Array<{ id: string; type: MembershipType }>;
  message?: string;
  features?: MembershipFeatureKey[];
};

type MembershipMode = 'individual' | 'all_in_one';

const THEME_MODE_STORAGE_KEY = 'velhub-theme-mode';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'system' || value === 'dark';
}

function getStoredThemeMode() {
  if (typeof window === 'undefined') {
    return 'system' as ThemeMode;
  }

  const storedThemeMode = window.localStorage.getItem(THEME_MODE_STORAGE_KEY);

  if (isThemeMode(storedThemeMode)) {
    return storedThemeMode;
  }

  return 'system' as ThemeMode;
}

function getResolvedThemeMode(themeMode: ThemeMode) {
  if (themeMode === 'light' || themeMode === 'dark') {
    return themeMode;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyThemeMode(themeMode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', `yellow-${getResolvedThemeMode(themeMode)}`);
}

const ownerFeatures = getMembershipFeatures('owner');
const creatorFeatures = getMembershipFeatures('creator');

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '멤버십 이용 조건을 확인하지 못했습니다.';
}

function toggleFeature(current: MembershipFeatureKey[], featureKey: MembershipFeatureKey) {
  return current.includes(featureKey) ? current.filter((key) => key !== featureKey) : [...current, featureKey];
}

function getPackageKeys(features: typeof ownerFeatures) {
  return features.map((feature) => feature.key);
}

export default function Opt() {
  const router = useRouter();
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [mode, setMode] = useState<MembershipMode>('individual');
  const [isAllInOneAutomatic, setIsAllInOneAutomatic] = useState(false);
  const [ownerSelection, setOwnerSelection] = useState<MembershipFeatureKey[]>([]);
  const [creatorSelection, setCreatorSelection] = useState<MembershipFeatureKey[]>([]);
  const [isOwnerPackage, setIsOwnerPackage] = useState(false);
  const [isCreatorPackage, setIsCreatorPackage] = useState(false);
  const [allInOneSelection, setAllInOneSelection] = useState<MembershipFeatureKey[]>([]);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [hasExistingMembership, setHasExistingMembership] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const { themeMode, setThemeMode } = useThemeMode();

  useEffect(() => {
    async function loadEligibility() {
      try {
        const [eligibilityResponse, membershipResponse] = await Promise.all([
          fetch('/api/memberships/eligibility', { credentials: 'include', cache: 'no-store' }),
          fetch('/api/memberships', { credentials: 'include', cache: 'no-store' }),
        ]);
        const result = (await eligibilityResponse.json().catch(() => null)) as
          | Eligibility
          | { message?: string }
          | null;
        const membershipResult = (await membershipResponse.json().catch(() => null)) as MembershipStatusResponse | null;

        if (!eligibilityResponse.ok || !result || !('owner' in result)) {
          const message = result && 'message' in result ? result.message : null;
          throw new Error(message || '멤버십 이용 조건을 확인하지 못했습니다.');
        }

        if (!membershipResponse.ok) {
          throw new Error(membershipResult?.message || '멤버십 정보를 불러오지 못했습니다.');
        }

        const existingMemberships = membershipResult?.memberships ?? [];
        const hasCreatorMembership = existingMemberships.some((membership) =>
          ['owner', 'creator', 'all_in_one'].includes(membership.type),
        );

        if (hasCreatorMembership) {
          setHasExistingMembership(true);
          const features = membershipResult?.features ?? [];
          const isAllInOne = existingMemberships.some((m) => m.type === 'all_in_one');

          if (isAllInOne) {
            setMode('all_in_one');
            setAllInOneSelection(features);
          } else {
            setMode('individual');
            const ownerSelected = features.filter((key) => ownerFeatures.some((f) => f.key === key));
            const creatorSelected = features.filter((key) => creatorFeatures.some((f) => f.key === key));
            setOwnerSelection(ownerSelected);
            setCreatorSelection(creatorSelected);
          }
        }

        setEligibility(result);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
    }

    void loadEligibility();
  }, [router]);

  useEffect(() => {
    setThemeMode(getStoredThemeMode());
    setIsMounted(true);
  }, [setThemeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }

    applyThemeMode(themeMode);

    const mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');

    function handleSystemThemeModeChange() {
      if (themeMode === 'system') {
        applyThemeMode('system');
      }
    }

    mediaQueryList.addEventListener('change', handleSystemThemeModeChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleSystemThemeModeChange);
    };
  }, [isMounted, themeMode]);

  useEffect(() => {
    if (!isMounted) {
      return;
    }
  }, [isMounted]);

  const effectiveOwnerSelection = isOwnerPackage ? getPackageKeys(ownerFeatures) : ownerSelection;
  const effectiveCreatorSelection = isCreatorPackage ? getPackageKeys(creatorFeatures) : creatorSelection;
  const isAllInOnePackage = useMemo(
    () =>
      ownerFeatures.filter((feature) => allInOneSelection.includes(feature.key)).length >= 2 &&
      creatorFeatures.filter((feature) => allInOneSelection.includes(feature.key)).length >= 2,
    [allInOneSelection],
  );
  const canEditIndividual = mode === 'individual' || isAllInOneAutomatic;
  const canUseAllInOne = eligibility?.allInOne.available ?? false;

  const totalPrice = useMemo(() => {
    if (mode === 'all_in_one') {
      return getMembershipPrice(allInOneSelection, 'all_in_one');
    }

    return (
      getMembershipPrice(effectiveOwnerSelection, 'owner') + getMembershipPrice(effectiveCreatorSelection, 'creator')
    );
  }, [allInOneSelection, effectiveCreatorSelection, effectiveOwnerSelection, mode]);

  function updateIndividualSelections(
    nextOwnerSelection: MembershipFeatureKey[],
    nextCreatorSelection: MembershipFeatureKey[],
    nextIsOwnerPackage = isOwnerPackage,
    nextIsCreatorPackage = isCreatorPackage,
  ) {
    const nextEffectiveOwnerSelection = nextIsOwnerPackage ? getPackageKeys(ownerFeatures) : nextOwnerSelection;
    const nextEffectiveCreatorSelection = nextIsCreatorPackage ? getPackageKeys(creatorFeatures) : nextCreatorSelection;
    const shouldAutomaticallyUseAllInOne =
      nextEffectiveOwnerSelection.length >= 2 && nextEffectiveCreatorSelection.length >= 2;

    setOwnerSelection(nextOwnerSelection);
    setCreatorSelection(nextCreatorSelection);
    setIsOwnerPackage(nextIsOwnerPackage);
    setIsCreatorPackage(nextIsCreatorPackage);

    if (shouldAutomaticallyUseAllInOne) {
      if (mode !== 'all_in_one' || !isAllInOneAutomatic) {
        setSnackbarMessage('올인원 멤버십으로 전환됩니다.');
      }

      setMode('all_in_one');
      setIsAllInOneAutomatic(true);
      setAllInOneSelection([...nextEffectiveOwnerSelection, ...nextEffectiveCreatorSelection]);
      return;
    }

    if (isAllInOneAutomatic) {
      setSnackbarMessage('올인원 멤버십이 해제됩니다.');
      setMode('individual');
      setIsAllInOneAutomatic(false);
      setAllInOneSelection([]);
    } else if (mode === 'all_in_one') {
      setMode('individual');
      setAllInOneSelection([]);
    }
  }

  function chooseIndividualMembership() {
    setMode('individual');
    setIsAllInOneAutomatic(false);
    setAllInOneSelection([]);
  }

  function chooseAllInOneMembership() {
    if (!canUseAllInOne) return;

    setMode('all_in_one');
    setIsAllInOneAutomatic(false);
    setOwnerSelection([]);
    setCreatorSelection([]);
    setIsOwnerPackage(false);
    setIsCreatorPackage(false);
    setAllInOneSelection([]);
  }

  function handleOwnerFeatureChange(featureKey: MembershipFeatureKey) {
    if (!eligibility?.owner.available) return;

    if (isOwnerPackage) {
      updateIndividualSelections(
        getPackageKeys(ownerFeatures).filter((key) => key !== featureKey),
        creatorSelection,
        false,
        isCreatorPackage,
      );
      return;
    }

    updateIndividualSelections(toggleFeature(ownerSelection, featureKey), creatorSelection);
  }

  function handleCreatorFeatureChange(featureKey: MembershipFeatureKey) {
    if (!eligibility?.creator.available) return;

    if (isCreatorPackage) {
      updateIndividualSelections(
        ownerSelection,
        getPackageKeys(creatorFeatures).filter((key) => key !== featureKey),
        isOwnerPackage,
        false,
      );
      return;
    }

    updateIndividualSelections(ownerSelection, toggleFeature(creatorSelection, featureKey));
  }

  function handleOwnerPackageChange() {
    if (!eligibility?.owner.available) return;

    updateIndividualSelections([], creatorSelection, !isOwnerPackage, isCreatorPackage);
  }

  function handleCreatorPackageChange() {
    if (!eligibility?.creator.available) return;

    updateIndividualSelections(ownerSelection, [], isOwnerPackage, !isCreatorPackage);
  }

  function handleAllInOneFeatureChange(featureKey: MembershipFeatureKey) {
    if (!canUseAllInOne) return;

    if (mode !== 'all_in_one') {
      setMode('all_in_one');
      setIsAllInOneAutomatic(false);
      setOwnerSelection([]);
      setCreatorSelection([]);
      setIsOwnerPackage(false);
      setIsCreatorPackage(false);
    }

    setAllInOneSelection((current) => toggleFeature(current, featureKey));
  }

  function handleAllInOnePackageChange() {
    if (!canUseAllInOne) return;

    if (mode !== 'all_in_one') {
      setMode('all_in_one');
      setIsAllInOneAutomatic(false);
      setOwnerSelection([]);
      setCreatorSelection([]);
      setIsOwnerPackage(false);
      setIsCreatorPackage(false);
    }

    if (isAllInOnePackage) {
      setAllInOneSelection([]);
    } else {
      setAllInOneSelection([...getPackageKeys(ownerFeatures), ...getPackageKeys(creatorFeatures)]);
    }
  }

  function handleMoveToPlan() {
    const selection =
      mode === 'all_in_one'
        ? { allInOne: allInOneSelection }
        : { owner: effectiveOwnerSelection, creator: effectiveCreatorSelection };

    router.push(`/hub/memberships?selection=${encodeURIComponent(JSON.stringify(selection))}`);
  }

  if (!eligibility && !errorMessage) return null;

  return (
    <main className={styles['membership-page']}>
      <div className={styles['membership-container']}>
        <Stack gap={3}>
          <Stack gap={1}>
            <Typography variant="h6">창작자 멤버십 가입</Typography>
            <Typography variant="subtitle2">
              원하는 기능을 선택해 주세요. 기본 기능은 자동으로 이용할 수 있습니다.
            </Typography>
          </Stack>
          {errorMessage ? <p className="alert error">{errorMessage}</p> : null}

          <Stack gap={3}>
            <Stack gap={1}>
              <button
                type="button"
                className={styles['membership-type']}
                onClick={chooseIndividualMembership}
                disabled={isAllInOneAutomatic}
                aria-pressed={mode === 'individual'}
              >
                <Radio checked={mode === 'individual'} tabIndex={-1} size="small" />
                <span>개별 멤버십</span>
              </button>

              <div className={`paper ${styles['membership-cards']}`}>
                <MembershipCard
                  title="오너 멤버십"
                  description="사이트 운영에 필요한 기능을 이용합니다."
                  disabledMessage={eligibility?.owner.message ?? null}
                  basic="블로그와 커뮤니티를 각각 1개 개설할 수 있습니다."
                  features={ownerFeatures}
                  selection={effectiveOwnerSelection}
                  onFeatureChange={handleOwnerFeatureChange}
                  onPackageChange={handleOwnerPackageChange}
                  packagePrice={MEMBERSHIP_PACKAGE_PRICE.owner}
                  isPackage={isOwnerPackage}
                  isDisabled={false}
                  available={eligibility?.owner.available ?? false}
                />
                <MembershipCard
                  title="크리에이터 멤버십"
                  description="작가 활동을 위한 기능을 이용합니다."
                  disabledMessage={eligibility?.creator.message ?? null}
                  basic="작가 신청과 작가 활동으로 수익 창출을 이용할 수 있습니다."
                  features={creatorFeatures}
                  selection={effectiveCreatorSelection}
                  onFeatureChange={handleCreatorFeatureChange}
                  onPackageChange={handleCreatorPackageChange}
                  packagePrice={MEMBERSHIP_PACKAGE_PRICE.creator}
                  isPackage={isCreatorPackage}
                  isDisabled={false}
                  available={eligibility?.creator.available ?? false}
                />
              </div>
            </Stack>

            <Stack gap={1}>
              <MembershipCard
                title="올인원 멤버십"
                description="오너와 크리에이터 기능을 함께 이용합니다."
                disabledMessage={eligibility?.allInOne.message ?? null}
                basic="운영 중인 사이트가 있으면서 동시에 작가인 경우 이용할 수 있습니다."
                features={[...ownerFeatures, ...creatorFeatures]}
                selection={allInOneSelection}
                onFeatureChange={handleAllInOneFeatureChange}
                onPackageChange={handleAllInOnePackageChange}
                packagePrice={MEMBERSHIP_PACKAGE_PRICE.all_in_one}
                isPackage={isAllInOnePackage}
                isDisabled={!canUseAllInOne}
                available={canUseAllInOne}
                allInOne
                isMembershipTypeSelected={mode === 'all_in_one'}
                isMembershipTypeDisabled={!canUseAllInOne}
                onMembershipTypeChange={chooseAllInOneMembership}
              />
            </Stack>
          </Stack>

          <div className={styles['membership-actions']}>
            <Anchor href="/" className="button medium close">
              멤버십 가입 취소
            </Anchor>
            <button
              type="button"
              className="button medium submit"
              onClick={handleMoveToPlan}
              disabled={!eligibility || (mode === 'all_in_one' && (!isAllInOnePackage || !canUseAllInOne))}
            >
              {hasExistingMembership
                ? totalPrice === 0
                  ? '무료로 변경하기'
                  : `${formatMembershipPrice(totalPrice)} 변경하기`
                : totalPrice === 0
                  ? '무료로 이용하기'
                  : `${formatMembershipPrice(totalPrice)} 결제하기`}
            </button>
          </div>
        </Stack>
      </div>
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={3000}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setSnackbarMessage('')}
      />
    </main>
  );
}

type MembershipCardProps = {
  title: string;
  description: string;
  basic: string;
  disabledMessage: string | null;
  features: ReturnType<typeof getMembershipFeatures>;
  selection: MembershipFeatureKey[];
  onFeatureChange: (featureKey: MembershipFeatureKey) => void;
  onPackageChange: () => void;
  packagePrice: number;
  isPackage: boolean;
  isDisabled: boolean;
  available: boolean;
  allInOne?: boolean;
  isMembershipTypeSelected?: boolean;
  isMembershipTypeDisabled?: boolean;
  onMembershipTypeChange?: () => void;
};

function MembershipCard({
  title,
  description,
  basic,
  disabledMessage,
  features,
  selection,
  onFeatureChange,
  onPackageChange,
  packagePrice,
  isPackage,
  isDisabled,
  available,
  allInOne = false,
  isMembershipTypeSelected = false,
  isMembershipTypeDisabled = false,
  onMembershipTypeChange,
}: MembershipCardProps) {
  const regularPrice = features.reduce((total, feature) => total + (allInOne ? 3900 : feature.price), 0);
  const canSelectPaidFeatures = available && !isDisabled;

  function renderFeature(feature: (typeof ownerFeatures)[number]) {
    return (
      <button
        key={feature.key}
        type="button"
        className={styles['membership-feature']}
        onClick={() => onFeatureChange(feature.key)}
        disabled={!canSelectPaidFeatures}
      >
        <Checkbox checked={selection.includes(feature.key)} tabIndex={-1} />
        <Typography variant="body2">{feature.label}</Typography>
        <Typography variant="body2">{formatMembershipPrice(allInOne ? 2900 : feature.price)}</Typography>
      </button>
    );
  }

  return (
    <div
      className={`paper ${styles['membership-card']} ${allInOne ? styles['membership-all-in-one-card'] : ''} ${!available ? styles['membership-disabled'] : ''}`}
    >
      <Stack gap={2}>
        <Stack className={styles['membership-card-title']} gap={1}>
          {onMembershipTypeChange ? (
            <button
              type="button"
              className={styles['membership-type']}
              onClick={onMembershipTypeChange}
              disabled={isMembershipTypeDisabled}
            >
              <Radio checked={isMembershipTypeSelected} tabIndex={-1} size="small" />
              <span>{title}</span>
            </button>
          ) : (
            <Typography variant="h6">{title}</Typography>
          )}
          <Typography variant="body2">{description}</Typography>
        </Stack>
        <Stack className={styles['membership-basic']} gap={1} direction="column">
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle2">기본</Typography>
            <Typography variant="body2">0 원</Typography>
          </Stack>
          <Typography variant="body2">{basic}</Typography>
        </Stack>
        {!available && disabledMessage ? <p className="alert error">{disabledMessage}</p> : null}
        {available && allInOne ? (
          <div className={styles['membership-all-in-one-features']}>
            <Stack gap={1}>
              <Typography variant="subtitle2">오너 기능</Typography>
              {ownerFeatures.map(renderFeature)}
            </Stack>
            <Stack gap={1}>
              <Typography variant="subtitle2">크리에이터 기능</Typography>
              {creatorFeatures.map(renderFeature)}
            </Stack>
            <button
              type="button"
              className={styles['membership-package']}
              onClick={onPackageChange}
              disabled={!canSelectPaidFeatures}
            >
              <Checkbox checked={isPackage} tabIndex={-1} />
              <Stack gap={1} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">통합</Typography>
                <Typography variant="body2">
                  <del>{formatMembershipPrice(regularPrice)}</del>{' '}
                  <strong>{formatMembershipPrice(packagePrice)}</strong>
                </Typography>
              </Stack>
            </button>
          </div>
        ) : null}
        {available && !allInOne ? (
          <Stack gap={1}>
            {features.map(renderFeature)}
            <button
              type="button"
              className={styles['membership-package']}
              onClick={onPackageChange}
              disabled={!canSelectPaidFeatures}
            >
              <Checkbox checked={isPackage} tabIndex={-1} />
              <Stack gap={1} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">통합</Typography>
                <Typography variant="body2">
                  <del>{formatMembershipPrice(regularPrice)}</del>{' '}
                  <strong>{formatMembershipPrice(packagePrice)}</strong>
                </Typography>
              </Stack>
            </button>
          </Stack>
        ) : null}
      </Stack>
    </div>
  );
}
