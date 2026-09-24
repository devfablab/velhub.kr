'use client';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Chip, Stack, Typography } from '@mui/material';
import { requestGuardianIdentityVerification } from '@/lib/identity/requestGuardianVerification';
import {
  formatMembershipPrice,
  getMembershipFeature,
  getMembershipPrice,
  MEMBERSHIP_FEATURES,
  MembershipFeatureKey,
  MembershipType,
} from '@/lib/memberships/catalog';
import Anchor from '@/components/Anchor';
import PopupMessage from '@/components/PopupMessage';
import BillingMethodButton from '@/components/service/common/BillingMethodButton';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';
import type { MinorPaymentControlResponse } from '@/components/service/common/MinorPaymentControl';
import PaymentTerms from '@/components/service/common/PaymentTerms';
import ScreenState from '@/components/service/ScreenState';
import ResponsivePopup from '../../shared/ResponsivePopup';
import styles from '@/app/hub.module.sass';

export type Eligibility = {
  owner: { available: boolean; message: string | null };
  creator: { available: boolean; message: string | null };
  allInOne: { available: boolean; message: string | null };
};

type MembershipSelection = Partial<Record<'owner' | 'creator' | 'allInOne' | 'affetto', MembershipFeatureKey[]>>;

export type MembershipResponse = {
  memberships: Array<{
    id: string;
    type: MembershipType;
    updatedAt: string | null;
    itemLabels: string[];
    subscriptionStatus: string | null;
    currentPeriodEnd: string | null;
    createdAt: string | null;
  }>;
  billingMethods: BillingMethod[];
  message?: string;
};

export type IdentityStatusResponse = {
  exists: boolean;
  identity: { birth_date: string } | null;
};

type CurrentMembership = MembershipResponse['memberships'][number];

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

const MEMBERSHIP_DESCRIPTIONS: Record<MembershipType, string[]> = {
  owner: MEMBERSHIP_FEATURES.filter((f) => f.group === 'owner').map((f) => f.label),
  creator: MEMBERSHIP_FEATURES.filter((f) => f.group === 'creator').map((f) => f.label),
  all_in_one: [
    ...MEMBERSHIP_FEATURES.filter((f) => f.group === 'owner' || f.group === 'creator').map((f) => f.label),
    '통합 결제 시 할인가 혜택 제공',
  ],
  affetto: MEMBERSHIP_FEATURES.filter((f) => f.group === 'affetto').map((f) => f.label),
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

function getCardTypeLabel(value: string | null) {
  if (value === 'CREDIT') return '신용';
  if (value === 'CHECK') return '체크';
  if (value === 'GIFT') return '기프트';
  return '기타';
}

function getOwnerTypeLabel(value: string | null) {
  if (value === 'PERSONAL') return '개인';
  if (value === 'CORPORATE') return '법인';
  return '기타';
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

function getAge(birthDate: string | null | undefined) {
  const digits = String(birthDate ?? '').replace(/\D/g, '');
  if (digits.length !== 8) return null;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;
  if (today < birthdayThisYear) age -= 1;
  return age;
}

export default function MembershipPlan({
  initialMemberships,
  initialEligibility,
  initialIdentity,
  initialMinorPaymentControl,
  initialError,
}: {
  initialMemberships: MembershipResponse | null;
  initialEligibility: Eligibility | null;
  initialIdentity: IdentityStatusResponse | null;
  initialMinorPaymentControl: MinorPaymentControlResponse | null;
  initialError: string;
}) {
  const searchParams = useSearchParams();
  const selection = useMemo(() => parseSelection(searchParams.get('selection')), [searchParams]);
  const memberships = useMemo(() => initialMemberships?.memberships ?? [], [initialMemberships]);
  const billingMethods = useMemo(() => initialMemberships?.billingMethods ?? [], [initialMemberships]);
  const selectedBillingMethodId =
    initialMemberships?.billingMethods.find((method) => method.isDefault)?.id ??
    initialMemberships?.billingMethods[0]?.id ??
    '';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CurrentMembership | null>(null);
  const [refundTarget, setRefundTarget] = useState<CurrentMembership | null>(null);
  const [isPaymentPopupOpen, setIsPaymentPopupOpen] = useState(false);
  const [isChangingSubscription, setIsChangingSubscription] = useState(false);
  const [errorMessage, setErrorMessage] = useState(initialError);
  const eligibility = initialEligibility;
  const hasIdentity = Boolean(initialIdentity?.exists);
  const initialAge = initialIdentity?.exists ? getAge(initialIdentity.identity?.birth_date) : null;
  const isUnder14Age = hasIdentity && (initialAge === null || initialAge < 14);
  const isMinorUser = initialAge !== null && initialAge < 19;
  const isBlocked = initialMinorPaymentControl?.mode === 'blocked_until_adult';

  const selectedItems = useMemo(() => {
    const items = getSelectionItems(selection);
    if (!eligibility) return items;

    return items.filter((item) => {
      if (item.type === 'owner') return eligibility.owner.available;
      if (item.type === 'creator') return eligibility.creator.available;
      if (item.type === 'all_in_one') return eligibility.allInOne.available;
      return true;
    });
  }, [selection, eligibility]);
  const membershipByType = useMemo(
    () => new Map(memberships.map((membership) => [membership.type, membership])),
    [memberships],
  );
  const selectedPrice = useMemo(
    () => selectedItems.reduce((total, item) => total + getMembershipPrice(item.featureKeys, item.type), 0),
    [selectedItems],
  );

  if (isUnder14Age || isBlocked) {
    return (
      <section className={`paper ${styles.paper}`}>
        <div className="paper page-warning">
          <WarningAmberRoundedIcon />
          <h2>멤버십</h2>
          <p>
            {isBlocked
              ? '이 계정은 만 19세가 될 때까지 결제 · 구매 · 후원을 이용할 수 없습니다.'
              : '결제/구매는 데브허브 정책상 만 14세 이상부터 가능해요. 😭'}
          </p>
        </div>
      </section>
    );
  }

  async function handlePayment(guardianIdentityVerificationId?: string) {
    if (!selectedItems.length || !selectedBillingMethodId || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    const existingTypes = new Set(memberships.map((m) => m.type));
    const isModification = selectedItems.some(
      (item) =>
        existingTypes.has(item.type) ||
        (item.type === 'all_in_one' && (existingTypes.has('owner') || existingTypes.has('creator'))) ||
        ((item.type === 'owner' || item.type === 'creator') && existingTypes.has('all_in_one')),
    );

    const apiPath = isMinorUser
      ? '/api/payments/portone/memberships/start'
      : isModification
        ? '/api/payments/portone/memberships/modify'
        : '/api/payments/portone/memberships/start';

    try {
      const response = await fetch(apiPath, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingMethodId: selectedBillingMethodId,
          purchases: selectedItems.map((item) => ({ type: item.type, featureKeys: item.featureKeys })),
          guardianIdentityVerificationId,
        }),
      });
      const result = (await response.json()) as { error?: string; guardianAuthRequired?: boolean };

      if (!response.ok) {
        if (result.guardianAuthRequired && !guardianIdentityVerificationId) {
          setIsSubmitting(false);
          await handlePayment(await requestGuardianIdentityVerification());
          return;
        }
        throw new Error(result.error || '멤버십 결제를 완료하지 못했습니다.');
      }

      window.location.replace('/hub/purchase/memberships');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '멤버십 결제를 완료하지 못했습니다.');
      setIsSubmitting(false);
      setIsPaymentPopupOpen(false);
    }
  }

  async function handleSubscriptionChange(action: 'cancel' | 'resume') {
    if (!cancelTarget || isChangingSubscription) {
      return;
    }

    setIsChangingSubscription(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/payments/portone/memberships/${action}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: cancelTarget.id }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || '멤버십 구독 상태를 변경하지 못했습니다.');
      }

      window.location.replace('/hub/purchase/memberships');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '멤버십 구독 상태를 변경하지 못했습니다.');
      setIsChangingSubscription(false);
    }
  }

  async function handleRefund() {
    if (!refundTarget || isChangingSubscription) {
      return;
    }

    setIsChangingSubscription(true);
    setErrorMessage('');

    try {
      const response = await fetch('/api/payments/portone/memberships/refund', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ membershipId: refundTarget.id }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || '멤버십 환불을 완료하지 못했습니다.');
      }

      window.location.replace('/hub/purchase/memberships');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '멤버십 환불을 완료하지 못했습니다.');
      setIsChangingSubscription(false);
    }
  }

  function getMembershipStatus(type: MembershipType) {
    const membership = membershipByType.get(type);

    if (membership) {
      const isCanceled = membership.subscriptionStatus === 'canceled';
      const isPastDue = membership.subscriptionStatus === 'past_due';

      return {
        label: isPastDue ? '결제 유예 중' : isCanceled ? '다음 결제 취소됨' : '유료 기능 이용 중',
        membership,
        isDirectMembership: true,
        isCanceled,
        isPastDue,
      };
    }

    if ((type === 'owner' || type === 'creator') && membershipByType.get('all_in_one')) {
      return {
        label: '올인원 멤버십으로 이용 중',
        membership: membershipByType.get('all_in_one'),
        isDirectMembership: false,
        isCanceled: false,
        isPastDue: false,
      };
    }

    return {
      label: type === 'all_in_one' ? '가입 가능' : '기본 기능 이용 중',
      membership: null,
      isDirectMembership: false,
      isCanceled: false,
      isPastDue: false,
    };
  }

  return (
    <>
      {selectedItems.length ? (
        <section className={`paper ${styles.paper}`}>
          <h2>선택한 멤버십</h2>
          <div className={styles['membership-plan-card']}>
            <Stack gap={2}>
              {selectedItems.map((item) => (
                <Stack gap={1} key={item.type}>
                  <Typography variant="subtitle2">{MEMBERSHIP_LABEL[item.type]}</Typography>
                  <Stack gap={0.5}>
                    {item.featureKeys.map((featureKey) => (
                      <Typography key={featureKey} variant="body2">
                        • {getMembershipFeature(featureKey)?.label}
                      </Typography>
                    ))}
                  </Stack>
                </Stack>
              ))}
              <Typography variant="subtitle2">
                {isMinorUser
                  ? `1개월 ${formatMembershipPrice(selectedPrice)} 단건 결제`
                  : `${formatMembershipPrice(selectedPrice)} 결제합니다`}
              </Typography>
            </Stack>
          </div>
        </section>
      ) : null}

      <section className={`paper ${styles.paper}`}>
        <h2>{hasIdentity ? '결제수단 선택' : '본인인증'}</h2>
        {hasIdentity ? (
          <>
            <Stack gap={2}>
              <Stack gap={1}>
                <Typography variant="body2">
                  {isMinorUser
                    ? '1개월 이용권 결제에 사용할 카드를 관리합니다.'
                    : '자동결제에 사용할 카드를 관리합니다.'}
                </Typography>
                <p className="alert info">
                  <InfoOutlineRoundedIcon />
                  <span>마지막에 추가한 결제수단으로 결제됩니다.</span>
                </p>

                {billingMethods.length ? (
                  <Stack gap={1}>
                    {billingMethods.map((billingMethod) => (
                      <div className="paper" key={billingMethod.id}>
                        <Stack gap={0.5} direction="row" justifyContent="space-between" alignItems="center">
                          <Typography variant="body2">
                            {getCardCompanyLabel(billingMethod.cardCompany)} ({getCardTypeLabel(billingMethod.cardType)}{' '}
                            / {getOwnerTypeLabel(billingMethod.ownerType)}){' '}
                            {getCardNumberLabel(billingMethod.cardNumberMasked)}
                          </Typography>
                          {billingMethod.isDefault ? <Chip label="기본" size="small" className="chip success" /> : null}
                        </Stack>
                      </div>
                    ))}
                  </Stack>
                ) : (
                  <ScreenState kind="warning">등록된 결제수단이 없습니다. 결제수단을 먼저 등록해 주세요.</ScreenState>
                )}
              </Stack>
              <div>
                <BillingMethodButton />
              </div>
            </Stack>

            {selectedItems.length && selectedPrice > 0 ? (
              <div className={styles['membership-actions']}>
                <button
                  type="button"
                  className="button medium submit"
                  onClick={() => setIsPaymentPopupOpen(true)}
                  disabled={!selectedBillingMethodId || isSubmitting}
                >
                  {isMinorUser
                    ? `1개월 ${formatMembershipPrice(selectedPrice)} 단건 결제`
                    : `${formatMembershipPrice(selectedPrice)} 결제하기`}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <Stack gap={1}>
            <Typography variant="body2">멤버십을 결제하려면 먼저 본인인증을 완료해 주세요.</Typography>
            <div>
              <IdentityVerificationButton onVerified={() => window.location.reload()} />
            </div>
          </Stack>
        )}
      </section>

      <section className={`paper ${styles.paper}`}>
        <h2>멤버십 이용 상태</h2>
        <Stack gap={1}>
          {(Object.keys(MEMBERSHIP_LABEL) as MembershipType[])
            .filter((type) => {
              const status = getMembershipStatus(type);
              if (status.membership) return true;
              if (!eligibility) return true;

              if (type === 'owner') return eligibility.owner.available;
              if (type === 'creator') return eligibility.creator.available;
              if (type === 'all_in_one') return eligibility.allInOne.available;
              return true;
            })
            .map((type) => {
              const status = getMembershipStatus(type);

              return (
                <div className={`paper ${styles.paper}`} key={type}>
                  <Stack direction="row" justifyContent="space-between" gap={2} alignItems="center">
                    <Typography variant="subtitle2">{MEMBERSHIP_LABEL[type]}</Typography>
                    {status.label ? (
                      <Chip
                        label={status.label}
                        size="small"
                        className={`chip ${status.label === '유료 기능 이용 중' ? 'success' : 'default'}`}
                      />
                    ) : null}
                  </Stack>
                  <Stack direction="column" gap={0.5}>
                    {MEMBERSHIP_DESCRIPTIONS[type].map((itemLabel) => (
                      <Typography
                        key={itemLabel}
                        variant="body2"
                        sx={{ opacity: status.membership?.itemLabels.includes(itemLabel) ? 1 : 0.2 }}
                      >
                        • {itemLabel}
                      </Typography>
                    ))}
                  </Stack>
                  {status.isPastDue ? (
                    <p className="alert warning">
                      <InfoOutlineRoundedIcon />
                      <span>
                        자동결제가 완료되지 않았습니다. 결제수단을 확인해 주세요. 유예 기간 안에 결제가 완료되지 않으면
                        멤버십 기능 이용이 종료됩니다.
                      </span>
                    </p>
                  ) : null}
                  {!status.membership ? (
                    <Stack direction="row">
                      <Anchor href={MEMBERSHIP_JOIN_HREF[type]} className="button small action">
                        자세히 알아보기
                      </Anchor>
                    </Stack>
                  ) : null}
                  {status.isDirectMembership && status.membership ? (
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      {status.isCanceled ? (
                        <button
                          type="button"
                          className="button small action"
                          onClick={() => setCancelTarget(status.membership ?? null)}
                        >
                          취소 철회
                        </button>
                      ) : (
                        (() => {
                          const elapsedMs = status.membership.createdAt
                            ? new Date().getTime() - new Date(status.membership.createdAt).getTime()
                            : 0;
                          const isPast7Days = elapsedMs > 7 * 24 * 60 * 60 * 1000;

                          if (isPast7Days) {
                            return (
                              <button
                                type="button"
                                className="button small action"
                                onClick={() => setCancelTarget(status.membership ?? null)}
                              >
                                구독 취소
                              </button>
                            );
                          }

                          return (
                            <button
                              type="button"
                              className="button small danger"
                              onClick={() => setRefundTarget(status.membership ?? null)}
                            >
                              환불
                            </button>
                          );
                        })()
                      )}
                      <Anchor href={MEMBERSHIP_JOIN_HREF[type]} className="button small action">
                        자세히 알아보기
                      </Anchor>
                    </Stack>
                  ) : null}
                </div>
              );
            })}
        </Stack>
      </section>

      <PopupMessage
        open={Boolean(errorMessage)}
        message={errorMessage}
        onClose={() => setErrorMessage('')}
        kind="error"
      />

      <ResponsivePopup
        open={Boolean(cancelTarget)}
        onClose={() => !isChangingSubscription && setCancelTarget(null)}
        title={cancelTarget?.subscriptionStatus === 'canceled' ? '멤버십 구독 취소 철회' : '멤버십 구독 취소'}
        maxWidth="sm"
        actions={[
          {
            label: '닫기',
            intent: 'cancel',
            disabled: isChangingSubscription,
            onClick: () => setCancelTarget(null),
          },
          {
            label: isChangingSubscription
              ? '처리 중'
              : cancelTarget?.subscriptionStatus === 'canceled'
                ? '취소 철회'
                : '구독 취소',
            intent: 'submit',
            disabled: isChangingSubscription,
            onClick: () =>
              void handleSubscriptionChange(cancelTarget?.subscriptionStatus === 'canceled' ? 'resume' : 'cancel'),
          },
        ]}
      >
        <Typography variant="body2">
          {cancelTarget?.subscriptionStatus === 'canceled'
            ? '다음 결제부터 다시 자동 결제됩니다.'
            : '현재 이용 기간이 끝날 때까지 멤버십 기능을 이용할 수 있으며, 다음 결제일부터 자동 결제되지 않습니다.'}
        </Typography>
      </ResponsivePopup>

      <ResponsivePopup
        open={Boolean(refundTarget)}
        onClose={() => !isChangingSubscription && setRefundTarget(null)}
        title="멤버십 환불"
        maxWidth="sm"
        actions={[
          {
            label: '닫기',
            intent: 'cancel',
            disabled: isChangingSubscription,
            onClick: () => setRefundTarget(null),
          },
          {
            label: isChangingSubscription ? '환불 중' : '환불',
            intent: 'warning',
            disabled: isChangingSubscription,
            onClick: () => void handleRefund(),
          },
        ]}
      >
        <Typography variant="body2">
          환불하면 멤버십 기능이 바로 종료됩니다. 결제 후 7일 이내에는 전액 환불되며, 이후에는 이용일수와 위약금 10%를
          공제한 금액이 환불됩니다.
        </Typography>
      </ResponsivePopup>

      <ResponsivePopup
        open={isPaymentPopupOpen}
        onClose={() => !isSubmitting && setIsPaymentPopupOpen(false)}
        title={isMinorUser ? '1개월 멤버십 구독' : '멤버십 결제 확인'}
        maxWidth="sm"
        actions={[
          {
            label: '취소',
            intent: 'cancel',
            disabled: isSubmitting,
            onClick: () => setIsPaymentPopupOpen(false),
          },
          {
            label: isSubmitting ? '결제 중' : '결제 확정',
            intent: 'submit',
            disabled: isSubmitting,
            onClick: () => void handlePayment(),
          },
        ]}
      >
        <Stack direction="row" alignItems="center" gap={1} mb={2}>
          <Typography variant="body2">
            {isMinorUser
              ? `1개월 ${formatMembershipPrice(selectedPrice)} 단건 결제로 멤버십을 이용하시겠어요? 기간이 끝나면 다시 결제해야 합니다.`
              : `멤버십을 월 ${formatMembershipPrice(selectedPrice)}에 구독하시겠어요?`}
          </Typography>
        </Stack>
        <PaymentTerms type="subscription" disabled={isSubmitting} />
      </ResponsivePopup>
    </>
  );
}
