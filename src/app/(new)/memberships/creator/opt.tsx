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
} from '@/lib/memberships/catalog';
import Anchor from '@/components/Anchor';
import styles from '@/app/memberships.module.sass';

type Eligibility = {
  owner: { available: boolean; message: string | null };
  creator: { available: boolean; message: string | null };
  allInOne: { available: boolean; message: string | null };
};

const ownerFeatures = getMembershipFeatures('owner');
const creatorFeatures = getMembershipFeatures('creator');

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '멤버십 이용 조건을 확인하지 못했습니다.';
}

function toggleFeature(current: MembershipFeatureKey[], featureKey: MembershipFeatureKey) {
  return current.includes(featureKey) ? current.filter((key) => key !== featureKey) : [...current, featureKey];
}

export default function Opt() {
  const router = useRouter();
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [ownerSelection, setOwnerSelection] = useState<MembershipFeatureKey[]>([]);
  const [creatorSelection, setCreatorSelection] = useState<MembershipFeatureKey[]>([]);
  const [allInOneSelection, setAllInOneSelection] = useState<MembershipFeatureKey[]>([]);
  const [isAllInOneSelected, setIsAllInOneSelected] = useState(false);
  const [isAllInOneAutomatic, setIsAllInOneAutomatic] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  useEffect(() => {
    async function loadEligibility() {
      try {
        const response = await fetch('/api/memberships/eligibility', { credentials: 'include', cache: 'no-store' });
        const result = (await response.json().catch(() => null)) as Eligibility | { message?: string } | null;

        if (!response.ok || !result || !('owner' in result)) {
          const message = result && 'message' in result ? result.message : null;
          throw new Error(message || '멤버십 이용 조건을 확인하지 못했습니다.');
        }

        setEligibility(result);
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
    }

    void loadEligibility();
  }, []);

  const totalPrice = useMemo(() => {
    if (isAllInOneSelected) {
      return getMembershipPrice(allInOneSelection, 'all_in_one');
    }

    return getMembershipPrice(ownerSelection, 'owner') + getMembershipPrice(creatorSelection, 'creator');
  }, [allInOneSelection, creatorSelection, isAllInOneSelected, ownerSelection]);

  const isAllInOnePackage = useMemo(
    () =>
      ownerFeatures.filter((feature) => allInOneSelection.includes(feature.key)).length >= 2 &&
      creatorFeatures.filter((feature) => allInOneSelection.includes(feature.key)).length >= 2,
    [allInOneSelection],
  );

  function handleTopSelectionChange(
    nextOwnerSelection: MembershipFeatureKey[],
    nextCreatorSelection: MembershipFeatureKey[],
  ) {
    const canUseAllInOne = nextOwnerSelection.length >= 2 && nextCreatorSelection.length >= 2;
    const wasManuallyUsingAllInOne = isAllInOneSelected && !isAllInOneAutomatic;

    setOwnerSelection(nextOwnerSelection);
    setCreatorSelection(nextCreatorSelection);

    if (wasManuallyUsingAllInOne) {
      setIsAllInOneSelected(false);
      setAllInOneSelection([]);
    }

    if (canUseAllInOne) {
      if (!isAllInOneSelected || wasManuallyUsingAllInOne) {
        setSnackbarMessage('올인원 멤버십으로 전환됩니다.');
      }

      setIsAllInOneSelected(true);
      setIsAllInOneAutomatic(true);
      setAllInOneSelection([...nextOwnerSelection, ...nextCreatorSelection]);
      return;
    }

    if (isAllInOneSelected && isAllInOneAutomatic) {
      setSnackbarMessage('올인원 멤버십이 해제됩니다.');
      setIsAllInOneSelected(false);
      setIsAllInOneAutomatic(false);
      setAllInOneSelection([]);
    }
  }

  function handleMembershipTypeChange(nextIsAllInOneSelected: boolean) {
    setIsAllInOneSelected(nextIsAllInOneSelected);
    setIsAllInOneAutomatic(false);

    if (nextIsAllInOneSelected) {
      setOwnerSelection([]);
      setCreatorSelection([]);
      return;
    }

    if (!nextIsAllInOneSelected) {
      setAllInOneSelection([]);
    }
  }

  function handleOwnerFeatureChange(featureKey: MembershipFeatureKey) {
    const nextSelection = toggleFeature(ownerSelection, featureKey);
    const isPackage = nextSelection.length === ownerFeatures.length;

    handleTopSelectionChange(isPackage ? ownerFeatures.map((feature) => feature.key) : nextSelection, creatorSelection);
  }

  function handleCreatorFeatureChange(featureKey: MembershipFeatureKey) {
    const nextSelection = toggleFeature(creatorSelection, featureKey);
    const isPackage = nextSelection.length === creatorFeatures.length;

    handleTopSelectionChange(ownerSelection, isPackage ? creatorFeatures.map((feature) => feature.key) : nextSelection);
  }

  function handleAllInOneFeatureChange(featureKey: MembershipFeatureKey) {
    setAllInOneSelection((current) => toggleFeature(current, featureKey));
  }

  function handleMoveToPlan() {
    const selection = isAllInOneSelected
      ? { allInOne: allInOneSelection }
      : { owner: ownerSelection, creator: creatorSelection };

    router.push(`/hub/memberships/plan?selection=${encodeURIComponent(JSON.stringify(selection))}`);
  }

  if (!eligibility && !errorMessage) {
    return;
  }

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
                onClick={() => handleMembershipTypeChange(false)}
              >
                <Radio checked={!isAllInOneSelected} tabIndex={-1} size="small" />
                <span>개별 멤버십</span>
              </button>
              <div className={`paper ${styles['membership-cards']}`}>
                <MembershipCard
                  title="오너 멤버십"
                  description="사이트 운영에 필요한 기능을 이용합니다."
                  disabledMessage={eligibility?.owner.message ?? null}
                  basic="블로그와 커뮤니티를 각각 1개 개설할 수 있습니다."
                  features={ownerFeatures}
                  selection={ownerSelection}
                  onSelectionChange={(selection) => handleTopSelectionChange(selection, creatorSelection)}
                  onFeatureChange={handleOwnerFeatureChange}
                  packagePrice={MEMBERSHIP_PACKAGE_PRICE.owner}
                  isDisabled={false}
                  available={eligibility?.owner.available ?? false}
                />
                <MembershipCard
                  title="크리에이터 멤버십"
                  description="작가 활동을 위한 기능을 이용합니다."
                  disabledMessage={eligibility?.creator.message ?? null}
                  basic="작가 신청과 작가 활동으로 수익 창출을 이용할 수 있습니다."
                  features={creatorFeatures}
                  selection={creatorSelection}
                  onSelectionChange={(selection) => handleTopSelectionChange(ownerSelection, selection)}
                  onFeatureChange={handleCreatorFeatureChange}
                  packagePrice={MEMBERSHIP_PACKAGE_PRICE.creator}
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
                basic="운영 중인 사이트가 있고 작가인 경우 이용할 수 있습니다."
                features={[...ownerFeatures, ...creatorFeatures]}
                selection={allInOneSelection}
                onSelectionChange={setAllInOneSelection}
                onFeatureChange={handleAllInOneFeatureChange}
                packagePrice={MEMBERSHIP_PACKAGE_PRICE.all_in_one}
                isDisabled={!isAllInOneSelected}
                available={eligibility?.allInOne.available ?? false}
                allInOne
                isMembershipTypeSelected={isAllInOneSelected}
                isMembershipTypeDisabled={!(eligibility?.allInOne.available ?? false)}
                onMembershipTypeChange={() => handleMembershipTypeChange(true)}
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
              disabled={!eligibility || (isAllInOneSelected && !isAllInOnePackage)}
            >
              {totalPrice === 0 ? '무료로 이용하기' : `${formatMembershipPrice(totalPrice)} 결제하기`}
            </button>
          </div>
        </Stack>
      </div>
      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={3000}
        message={snackbarMessage}
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
  onSelectionChange: (value: MembershipFeatureKey[]) => void;
  onFeatureChange: (featureKey: MembershipFeatureKey) => void;
  packagePrice: number;
  isDisabled: boolean;
  available?: boolean;
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
  onSelectionChange,
  onFeatureChange,
  packagePrice,
  isDisabled,
  available = true,
  allInOne = false,
  isMembershipTypeSelected = false,
  isMembershipTypeDisabled = false,
  onMembershipTypeChange,
}: MembershipCardProps) {
  const isPackage = allInOne
    ? ownerFeatures.filter((feature) => selection.includes(feature.key)).length >= 2 &&
      creatorFeatures.filter((feature) => selection.includes(feature.key)).length >= 2
    : selection.length === features.length;
  const regularPrice = features.reduce((total, feature) => total + (allInOne ? 3900 : feature.price), 0);
  const canSelectPaidFeatures = available && !isDisabled;

  function handlePackageChange() {
    if (isPackage) {
      onSelectionChange([]);
      return;
    }

    onSelectionChange(features.map((feature) => feature.key));
  }

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
        {!available ? <p className="alert info">{disabledMessage}</p> : null}
        {available && allInOne ? (
          <div className={`paper ${styles['membership-all-in-one-features']}`}>
            <Stack gap={1}>
              <Typography variant="subtitle2">오너 기능</Typography>
              {ownerFeatures.map(renderFeature)}
            </Stack>
            <Stack gap={1}>
              <Typography variant="subtitle2">크리에이터 기능</Typography>
              {creatorFeatures.map(renderFeature)}
            </Stack>
            <div className={styles['membership-package']}>
              <Checkbox checked={isPackage} tabIndex={-1} onChange={() => undefined} sx={{ pointerEvents: 'none' }} />
              <Stack gap={1} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">통합</Typography>
                <Typography variant="body2">
                  <del>{formatMembershipPrice(regularPrice)}</del>{' '}
                  <strong>{formatMembershipPrice(packagePrice)}</strong>
                </Typography>
              </Stack>
            </div>
          </div>
        ) : null}
        {available && !allInOne ? (
          <Stack gap={1}>
            {features.map(renderFeature)}
            <button
              type="button"
              className={styles['membership-package']}
              onClick={handlePackageChange}
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
