'use client';

import { useState } from 'react';
import type { SiteGuidelineDialogData } from '@/lib/siteGuidelines/server';
import ReportButton from '@/components/service/common/ReportButton';
import SiteGuidelineDialog from '@/components/service/common/SiteGuidelineDialog';
import styles from '@/app/board.module.sass';

type Props = {
  siteName: string;
  data: SiteGuidelineDialogData | null | undefined;
};

export default function SiteGuidelineActions({ siteName, data }: Props) {
  const [open, setOpen] = useState(false);

  if (!data || data.items.length === 0) {
    return null;
  }

  const title = data.site.siteType === 'blog' ? '블로그 이용 가이드라인 안내' : '커뮤니티 이용 가이드라인 안내';

  return (
    <div className={`paper ${styles['guideline-area']}`}>
      <button type="button" className="link-normal" onClick={() => setOpen(true)}>
        {title}
      </button>
      <ReportButton
        targetType="site"
        reportItemsTargetType="blog_community_post"
        siteName={siteName}
        menuLabel="가이드라인 신고하기"
      />
      <SiteGuidelineDialog open={open} onClose={() => setOpen(false)} data={data} />
    </div>
  );
}
