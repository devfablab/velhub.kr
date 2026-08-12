'use client';

import React from 'react';

type AdFitProps = {
  isAdFree: boolean;
  unitId?: string; // 애드핏 광고 단위 ID
};

export default function AdFit({ isAdFree, unitId = 'DAN-XXXXXXXXX' }: AdFitProps) {
  if (isAdFree) {
    return null; // 광고 숨김 (멤버십 혜택)
  }

  // TODO: 실제 카카오 애드핏 스크립트 렌더링 로직 추가
  // 추후 실운영 시 애드핏 스크립트를 useEffect 등으로 마운트하세요.
  
  return (
    <div className="adfit-container" style={{ margin: '16px 0', textAlign: 'center' }}>
      {/* 애드핏 광고 영역 Placeholder */}
      <ins
        className="kakao_ad_area"
        style={{ display: 'none' }}
        data-ad-unit={unitId}
        data-ad-width="320"
        data-ad-height="100"
      ></ins>
    </div>
  );
}
