'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Checkbox, Stack, Typography } from '@mui/material';
import {
  AFFETTO_PACKAGE_PRICE,
  formatMembershipPrice,
  getMembershipFeatures,
  getMembershipPrice,
  type MembershipFeatureKey,
} from '@/lib/memberships/catalog';
import Anchor from '@/components/Anchor';
import styles from '@/app/memberships.module.sass';

const features = getMembershipFeatures('affetto');

export default function Opt() {
  const router = useRouter();
  const [selection, setSelection] = useState<MembershipFeatureKey[]>([]);
  const isPackage = selection.length === features.length;
  const totalPrice = useMemo(() => getMembershipPrice(selection, 'affetto'), [selection]);

  function toggleFeature(featureKey: MembershipFeatureKey) {
    setSelection((current) =>
      current.includes(featureKey) ? current.filter((key) => key !== featureKey) : [...current, featureKey],
    );
  }

  function togglePackage() {
    setSelection(isPackage ? [] : features.map((feature) => feature.key));
  }

  function handleMoveToPlan() {
    router.push(`/hub/memberships/plans?selection=${encodeURIComponent(JSON.stringify({ affetto: selection }))}`);
  }

  return (
    <main className={styles['membership-page']}>
      <div className={styles['membership-container']}>
        <Stack gap={3}>
          <Stack gap={1}>
            <Typography variant="h6">독자 멤버십 가입</Typography>
            <Typography variant="subtitle2">
              원하는 기능을 선택해 주세요. 기본 기능은 자동으로 이용할 수 있습니다.
            </Typography>
          </Stack>
          <div className={`paper ${styles['membership-single-card']}`}>
            <Stack className={styles['membership-card-title']} gap={1}>
              <span>아페토 멤버십</span>
              <Typography variant="body2">독서와 즐겨찾기 관리를 위한 기능을 이용합니다.</Typography>
            </Stack>
            <Stack className={styles['membership-basic']} gap={1} direction="column">
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="subtitle2">기본</Typography>
                <Typography variant="body2">0 원</Typography>
              </Stack>
              <Typography variant="body2">기본 즐겨찾기 기능을 이용할 수 있습니다.</Typography>
            </Stack>
            <Stack gap={1}>
              {features.map((feature) => (
                <button
                  key={feature.key}
                  type="button"
                  className={styles['membership-feature']}
                  onClick={() => toggleFeature(feature.key)}
                >
                  <Checkbox checked={selection.includes(feature.key)} tabIndex={-1} />
                  <Typography variant="body2">{feature.label}</Typography>
                  <Typography variant="body2">{formatMembershipPrice(feature.price)}</Typography>
                </button>
              ))}
              <button type="button" className={styles['membership-package']} onClick={togglePackage}>
                <Checkbox checked={isPackage} tabIndex={-1} />
                <Stack gap={1} direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">통합</Typography>
                  <Typography variant="body2">
                    <del>{formatMembershipPrice(features.reduce((total, feature) => total + feature.price, 0))}</del>{' '}
                    <strong>{formatMembershipPrice(AFFETTO_PACKAGE_PRICE)}</strong>
                  </Typography>
                </Stack>
              </button>
            </Stack>
          </div>
          <div className={styles['membership-actions']}>
            <Anchor href="/" className="button medium close">
              멤버십 가입 취소
            </Anchor>
            <button type="button" className="button medium submit" onClick={handleMoveToPlan}>
              {totalPrice === 0 ? '무료로 이용하기' : `${formatMembershipPrice(totalPrice)} 결제하기`}
            </button>
          </div>
        </Stack>
      </div>
    </main>
  );
}
