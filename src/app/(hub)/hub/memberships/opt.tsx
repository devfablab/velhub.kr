'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Chip, Dialog, DialogActions, DialogContent, DialogTitle, Snackbar, Stack, Typography } from '@mui/material';
import {
  formatMembershipPrice,
  getMembershipFeature,
  getMembershipPrice,
  MEMBERSHIP_FEATURES,
  MembershipFeatureKey,
  MembershipType,
} from '@/lib/memberships/catalog';
import Anchor from '@/components/Anchor';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import BillingMethodButton from '@/components/service/common/BillingMethodButton';
import PaymentTerms from '@/components/service/common/PaymentTerms';
import styles from '@/app/hub.module.sass';

type Eligibility = {
  owner: { available: boolean; message: string | null };
  creator: { available: boolean; message: string | null };
  allInOne: { available: boolean; message: string | null };
};

type MembershipSelection = Partial<Record<'owner' | 'creator' | 'allInOne' | 'affetto', MembershipFeatureKey[]>>;

type MembershipResponse = {
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

export default function MembershipPlan() {
  const searchParams = useSearchParams();
  const selection = useMemo(() => parseSelection(searchParams.get('selection')), [searchParams]);
  const [memberships, setMemberships] = useState<MembershipResponse['memberships']>([]);
  const [billingMethods, setBillingMethods] = useState<BillingMethod[]>([]);
  const [selectedBillingMethodId, setSelectedBillingMethodId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<CurrentMembership | null>(null);
  const [refundTarget, setRefundTarget] = useState<CurrentMembership | null>(null);
  const [isPaymentPopupOpen, setIsPaymentPopupOpen] = useState(false);
  const [isChangingSubscription, setIsChangingSubscription] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);

  useEffect(() => {
    async function loadMemberships() {
      try {
        const [membershipResponse, eligibilityResponse] = await Promise.all([
          fetch('/api/memberships', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          }),
          fetch('/api/memberships/eligibility', {
            method: 'GET',
            credentials: 'include',
            cache: 'no-store',
          }),
        ]);

        const result = (await membershipResponse.json()) as MembershipResponse;
        const eligibilityResult = (await eligibilityResponse.json().catch(() => null)) as Eligibility | null;

        if (!membershipResponse.ok) {
          throw new Error(result.message || '멤버십 정보를 불러오지 못했습니다.');
        }

        if (eligibilityResponse.ok && eligibilityResult && 'owner' in eligibilityResult) {
          setEligibility(eligibilityResult);
        }

        setMemberships(result.memberships);
        setBillingMethods(result.billingMethods);
        setSelectedBillingMethodId(
          result.billingMethods.find((method) => method.isDefault)?.id ?? result.billingMethods[0]?.id ?? '',
        );
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : '멤버십 정보를 불러오지 못했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadMemberships();
  }, []);

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

  async function handlePayment() {
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

    const apiPath = isModification
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
        }),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(result.error || '멤버십 결제를 완료하지 못했습니다.');
      }

      window.location.replace('/hub/memberships');
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

      window.location.replace('/hub/memberships');
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

      window.location.replace('/hub/memberships');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '멤버십 환불을 완료하지 못했습니다.');
      setIsChangingSubscription(false);
    }
  }

  function getMembershipStatus(type: MembershipType) {
    const membership = membershipByType.get(type);

    if (membership) {
      const isCanceled = membership.subscriptionStatus === 'canceled';

      return {
        label: isCanceled ? '다음 결제 취소됨' : '유료 기능 이용 중',
        membership,
        isDirectMembership: true,
        isCanceled,
      };
    }

    if ((type === 'owner' || type === 'creator') && membershipByType.get('all_in_one')) {
      return {
        label: '올인원 멤버십으로 이용 중',
        membership: membershipByType.get('all_in_one'),
        isDirectMembership: false,
        isCanceled: false,
      };
    }

    return {
      label: type === 'all_in_one' ? '가입 가능' : '기본 기능 이용 중',
      membership: null,
      isDirectMembership: false,
      isCanceled: false,
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
              <Typography variant="subtitle2">{formatMembershipPrice(selectedPrice)} 결제합니다</Typography>
            </Stack>
          </div>
        </section>
      ) : null}

      <section className={`paper ${styles.paper}`}>
        <h2>결제수단 선택</h2>
        <Stack gap={2}>
          <Stack gap={1}>
            <Typography variant="body2">자동결제에 사용할 카드를 관리합니다.</Typography>
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
                        {getCardCompanyLabel(billingMethod.cardCompany)} ({getCardTypeLabel(billingMethod.cardType)} /{' '}
                        {getOwnerTypeLabel(billingMethod.ownerType)}){' '}
                        {getCardNumberLabel(billingMethod.cardNumberMasked)}
                      </Typography>
                      {billingMethod.isDefault ? <Chip label="기본" size="small" className="chip success" /> : null}
                    </Stack>
                  </div>
                ))}
              </Stack>
            ) : (
              <p className="alert warning">
                <WarningAmberRoundedIcon />
                <span>등록된 결제수단이 없습니다. 결제수단을 먼저 등록해 주세요.</span>
              </p>
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
              {formatMembershipPrice(selectedPrice)} 결제하기
            </button>
          </div>
        ) : null}
      </section>

      <section className={`paper ${styles.paper}`}>
        <h2>멤버십 이용 상태</h2>
        {isLoading ? (
          <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 240 }}>
            <LoadingIndicator />
          </Stack>
        ) : (
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
                    {status.membership?.itemLabels.length ? (
                      <Stack direction="column" gap={0.5}>
                        {status.membership?.itemLabels.map((itemLabel) => (
                          <Typography key={itemLabel} variant="body2">
                            • {itemLabel}
                          </Typography>
                        ))}
                      </Stack>
                    ) : null}
                    {!status.membership ? (
                      <>
                        <Stack gap={0.5}>
                          {MEMBERSHIP_DESCRIPTIONS[type].map((desc) => (
                            <Typography key={desc} variant="body2" color="text.secondary">
                              • {desc}
                            </Typography>
                          ))}
                        </Stack>
                        <Stack direction="row">
                          <Anchor href={MEMBERSHIP_JOIN_HREF[type]} className="button small action">
                            자세히 알아보기
                          </Anchor>
                        </Stack>
                      </>
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
        )}
      </section>

      <Snackbar
        open={Boolean(errorMessage)}
        message={errorMessage}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        onClose={() => setErrorMessage('')}
      />

      <Dialog
        open={Boolean(cancelTarget)}
        onClose={() => !isChangingSubscription && setCancelTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {cancelTarget?.subscriptionStatus === 'canceled' ? '멤버십 구독 취소 철회' : '멤버십 구독 취소'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            {cancelTarget?.subscriptionStatus === 'canceled'
              ? '다음 결제부터 다시 자동 결제됩니다.'
              : '현재 이용 기간이 끝날 때까지 멤버십 기능을 이용할 수 있으며, 다음 결제일부터 자동 결제되지 않습니다.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            className="button medium close"
            disabled={isChangingSubscription}
            onClick={() => setCancelTarget(null)}
          >
            닫기
          </button>
          <button
            type="button"
            className="button medium submit"
            disabled={isChangingSubscription}
            onClick={() =>
              void handleSubscriptionChange(cancelTarget?.subscriptionStatus === 'canceled' ? 'resume' : 'cancel')
            }
          >
            {isChangingSubscription
              ? '처리 중'
              : cancelTarget?.subscriptionStatus === 'canceled'
                ? '취소 철회'
                : '구독 취소'}
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(refundTarget)}
        onClose={() => !isChangingSubscription && setRefundTarget(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>멤버십 환불</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            환불하면 멤버십 기능이 바로 종료됩니다. 결제 후 7일 이내에는 전액 환불되며, 이후에는 이용일수와 위약금 10%를
            공제한 금액이 환불됩니다.
          </Typography>
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            className="button medium close"
            disabled={isChangingSubscription}
            onClick={() => setRefundTarget(null)}
          >
            닫기
          </button>
          <button
            type="button"
            className="button medium warning"
            disabled={isChangingSubscription}
            onClick={() => void handleRefund()}
          >
            {isChangingSubscription ? '환불 중' : '환불'}
          </button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={isPaymentPopupOpen}
        onClose={() => !isSubmitting && setIsPaymentPopupOpen(false)}
        className="VhiDialog"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>멤버십 결제 확인</DialogTitle>
        <button
          type="button"
          className="close-button"
          onClick={() => setIsPaymentPopupOpen(false)}
          disabled={isSubmitting}
        >
          <CloseRoundedIcon />
        </button>
        <DialogContent>
          <Stack direction="row" alignItems="center" gap={1} mb={2}>
            <Typography variant="body2">
              멤버십을 월 {formatMembershipPrice(selectedPrice)} 원에 구독하시겠어요?
            </Typography>
          </Stack>
          <PaymentTerms type="subscription" disabled={isSubmitting} />
        </DialogContent>
        <DialogActions>
          <button
            type="button"
            className="button medium close"
            disabled={isSubmitting}
            onClick={() => setIsPaymentPopupOpen(false)}
          >
            취소
          </button>
          <button
            type="button"
            className="button medium submit"
            disabled={isSubmitting}
            onClick={() => void handlePayment()}
          >
            {isSubmitting ? '결제 중' : '결제 확정'}
          </button>
        </DialogActions>
      </Dialog>
    </>
  );
}
