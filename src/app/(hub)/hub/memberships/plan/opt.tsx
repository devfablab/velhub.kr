'use client';

import { useEffect, useMemo, useState } from 'react';
import { Radio, Snackbar, Stack, Typography } from '@mui/material';
import BillingMethodButton from '@/components/service/common/BillingMethodButton';
import {
  formatMembershipPrice,
  getMembershipFeature,
  getMembershipPrice,
  MembershipFeatureKey,
  MembershipType,
} from '@/lib/memberships/catalog';
import Anchor from '@/components/Anchor';
import styles from '@/app/memberships.module.sass';

type MembershipSelection = Partial<Record<'owner' | 'creator' | 'allInOne' | 'affetto', MembershipFeatureKey[]>>;

type MembershipResponse = {
  memberships: Array<{
    id: string;
    type: MembershipType;
    updatedAt: string | null;
    itemLabels: string[];
  }>;
  billingMethods: BillingMethod[];
  message?: string;
};

type BillingMethod = {
  id: string;
  cardCompany: string | null;
  cardNumberMasked: string | null;
  cardType: string | null;
  ownerType: string | null;
  isDefault: boolean;
};

const MEMBERSHIP_LABEL: Record<MembershipType, string> = {
  owner: '오너 멤버십',
  creator: '크리에이터 멤버십',
  all_in_one: '올인원 멤버십',
  affetto: '아페토 멤버십',
};

const MEMBERSHIP_JOIN_HREF: Record<MembershipType, string> = {
  owner: '/memberships/creator',
  creator: '/memberships/creator',
  all_in_one: '/memberships/creator',
  affetto: '/memberships/user',
};

function isFeatureKey(value: unknown): value is MembershipFeatureKey {
  return typeof value === 'string' && Boolean(getMembershipFeature(value as MembershipFeatureKey));
}

function parseSelection(value: string | null): MembershipSelection {
  if (!value) return {};

  try {
    const parsedValue = JSON.parse(value) as MembershipSelection;

    return Object.fromEntries(
      Object.entries(parsedValue).map(([key, featureKeys]) => [
        key,
        Array.isArray(featureKeys) ? featureKeys.filter(isFeatureKey) : [],
      ]),
    ) as MembershipSelection;
  } catch {
    return {};
  }
}

function getCardCompanyLabel(value: string | null) {
  const labels: Record<string, string> = {
    HYUNDAI_CARD: '현대카드',
    SHINHAN_CARD: '신한카드',
    SAMSUNG_CARD: '삼성카드',
    KB_CARD: '국민카드',
    KOOKMIN_CARD: '국민카드',
    LOTTE_CARD: '롯데카드',
    HANA_CARD: '하나카드',
    WOORI_CARD: '우리카드',
    BC_CARD: 'BC카드',
    NH_CARD: 'NH농협카드',
    NONGHYUP_CARD: 'NH농협카드',
  };

  return labels[value ?? ''] ?? value ?? '카드';
}

function getCardNumberLabel(value: string | null) {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `${digits.slice(0, 4)} ••••` : '카드번호 확인 필요';
}

function getSelectionItems(selection: MembershipSelection) {
  const items: Array<{ type: MembershipType; featureKeys: MembershipFeatureKey[] }> = [];

  if (selection.allInOne?.length) {
    items.push({ type: 'all_in_one', featureKeys: selection.allInOne });
  } else {
    if (selection.owner?.length) items.push({ type: 'owner', featureKeys: selection.owner });
    if (selection.creator?.length) items.push({ type: 'creator', featureKeys: selection.creator });
  }

  if (selection.affetto?.length) {
    items.push({ type: 'affetto', featureKeys: selection.affetto });
  }

  return items;
}

export default function MembershipPlan() {
  const [selection, setSelection] = useState<MembershipSelection>({});
  const [memberships, setMemberships] = useState<MembershipResponse['memberships']>([]);
  const [billingMethods, setBillingMethods] = useState<BillingMethod[]>([]);
  const [selectedBillingMethodId, setSelectedBillingMethodId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    setSelection(parseSelection(new URLSearchParams(window.location.search).get('selection')));

    async function loadMemberships() {
      try {
        const response = await fetch('/api/memberships', {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store',
        });
        const result = (await response.json()) as MembershipResponse;

        if (!response.ok) {
          throw new Error(result.message || '멤버십 정보를 불러오지 못했습니다.');
        }

        setMemberships(result.memberships);
        setBillingMethods(result.billingMethods);
        setSelectedBillingMethodId(result.billingMethods.find((method) => method.isDefault)?.id ?? result.billingMethods[0]?.id ?? '');
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '멤버십 정보를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadMemberships();
  }, []);

  const selectedItems = useMemo(() => getSelectionItems(selection), [selection]);
  const membershipByType = useMemo(
    () => new Map(memberships.map((membership) => [membership.type, membership])),
    [memberships],
  );
  const selectedPrice = useMemo(
    () => selectedItems.reduce((total, item) => total + getMembershipPrice(item.featureKeys, item.type), 0),
    [selectedItems],
  );

  function handlePayment() {
    setErrorMessage('멤버십 결제 연결이 아직 완료되지 않았습니다.');
  }

  function getMembershipStatus(type: MembershipType) {
    const membership = membershipByType.get(type);

    if (membership) {
      return { label: '유료 기능 이용 중', membership };
    }

    if ((type === 'owner' || type === 'creator') && membershipByType.get('all_in_one')) {
      return { label: '올인원 멤버십으로 이용 중', membership: membershipByType.get('all_in_one') };
    }

    return { label: '기본 이용 중', membership: null };
  }

  return (
    <main className={styles['membership-page']}>
      <div className={styles['membership-container']}>
        <Stack gap={4}>
          <Stack gap={1}>
            <Typography variant="h6">멤버십 관리</Typography>
            <Typography variant="body2">이용 중인 멤버십과 결제수단을 확인합니다.</Typography>
          </Stack>

          {isLoading ? (
            <Typography variant="body2">멤버십 정보를 불러오는 중입니다.</Typography>
          ) : (
            <Stack gap={2}>
              <Typography variant="subtitle2">멤버십 이용 상태</Typography>
              <Stack gap={1}>
                {(Object.keys(MEMBERSHIP_LABEL) as MembershipType[]).map((type) => {
                  const status = getMembershipStatus(type);

                  return (
                    <div className={styles['membership-plan-card']} key={type}>
                      <Stack gap={1}>
                        <Stack direction="row" justifyContent="space-between" gap={2} alignItems="center">
                          <Typography variant="subtitle2">{MEMBERSHIP_LABEL[type]}</Typography>
                          <Typography variant="body2">{status.label}</Typography>
                        </Stack>
                        {status.membership?.itemLabels.map((itemLabel) => (
                          <Typography key={itemLabel} variant="body2">
                            {itemLabel}
                          </Typography>
                        ))}
                        {!status.membership ? (
                          <Anchor href={MEMBERSHIP_JOIN_HREF[type]} className="button small action">
                            유료 기능
                          </Anchor>
                        ) : null}
                      </Stack>
                    </div>
                  );
                })}
              </Stack>
            </Stack>
          )}

          {selectedItems.length ? (
            <Stack gap={2}>
              <Typography variant="subtitle2">선택한 멤버십</Typography>
              <div className={styles['membership-plan-card']}>
                <Stack gap={2}>
                  {selectedItems.map((item) => (
                    <Stack gap={1} key={item.type}>
                      <Typography variant="subtitle2">{MEMBERSHIP_LABEL[item.type]}</Typography>
                      <Stack gap={0.5}>
                        {item.featureKeys.map((featureKey) => (
                          <Typography key={featureKey} variant="body2">
                            {getMembershipFeature(featureKey)?.label}
                          </Typography>
                        ))}
                      </Stack>
                    </Stack>
                  ))}
                  <Typography variant="subtitle2">{formatMembershipPrice(selectedPrice)}</Typography>
                </Stack>
              </div>
            </Stack>
          ) : null}

          <Stack gap={2}>
            <Typography variant="subtitle2">결제수단 선택</Typography>
            {billingMethods.length ? (
              <Stack gap={1} alignItems="flex-start">
                {billingMethods.map((billingMethod) => {
                  const isSelected = selectedBillingMethodId === billingMethod.id;

                  return (
                    <button
                      key={billingMethod.id}
                      type="button"
                      className={styles['membership-payment-method']}
                      onClick={() => setSelectedBillingMethodId(billingMethod.id)}
                    >
                      <Radio checked={isSelected} readOnly />
                      <Stack gap={0.5}>
                        <Typography variant="subtitle2">
                          {getCardCompanyLabel(billingMethod.cardCompany)} {getCardNumberLabel(billingMethod.cardNumberMasked)}
                        </Typography>
                        <Typography variant="body2">{billingMethod.isDefault ? '기본 결제수단' : '등록한 결제수단'}</Typography>
                      </Stack>
                    </button>
                  );
                })}
                <BillingMethodButton />
              </Stack>
            ) : (
              <Stack gap={1} alignItems="flex-start">
                <Typography variant="body2">등록된 결제수단이 없습니다.</Typography>
                <BillingMethodButton />
              </Stack>
            )}
          </Stack>

          {selectedItems.length ? (
            <div className={styles['membership-actions']}>
              {selectedPrice === 0 ? (
                <button type="button" className="button medium submit" onClick={() => window.location.replace('/hub/memberships/plan')}>
                  무료로 이용하기
                </button>
              ) : (
                <button
                  type="button"
                  className="button medium submit"
                  onClick={handlePayment}
                  disabled={!selectedBillingMethodId}
                >
                  {formatMembershipPrice(selectedPrice)} 결제하기
                </button>
              )}
            </div>
          ) : null}
        </Stack>
      </div>

      <Snackbar
        open={Boolean(errorMessage)}
        message={errorMessage}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setErrorMessage('')}
      />
    </main>
  );
}
