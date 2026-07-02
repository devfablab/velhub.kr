export function getPaymentTypeLabel(value: string | null) {
  const labels: Record<string, string> = {
    plan_billing: '요금제',
    membership_blog: '블로그 멤버십',
    subscription_board: '게시판 구독',
    subscription_series: '연재 구독',
    donation_site: '블로그 후원',
    donation_board: '게시판 후원',
    donation_series: '연재 후원',
    donation_post: '포스팅 후원',
    purchase_post: '포스팅 구매',
  };

  if (!value) {
    return '';
  }

  return labels[value] ?? value;
}

export function getPaymentStatusLabel(value: string | null) {
  const labels: Record<string, string> = {
    ready: '대기',
    paid: '결제완료',
    failed: '실패',
    canceled: '취소',
    cancelled: '취소',
    refunded: '환불',
    partial_refunded: '부분환불',
    partially_refunded: '부분환불',
  };

  if (!value) {
    return '';
  }

  return labels[value] ?? value;
}

export function getSettlementStatusLabel(value: string | null) {
  const labels: Record<string, string> = {
    scheduled: '정산 예정',
    confirmed: '정산 확정',
    completed: '정산 완료',
  };

  if (!value) {
    return '';
  }

  return labels[value] ?? value;
}
