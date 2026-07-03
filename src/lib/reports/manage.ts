import {
  guidelineReportItemsByTargetType,
  type GuidelineReportCategory,
  type ReportTargetType,
} from '@/lib/reports/guidelines';
import { normalizeText } from '@/lib/utils';

export const reportManageTargetTypes = ['board', 'post', 'comment'] as const;

export type ReportManageTargetType = (typeof reportManageTargetTypes)[number];

export type ReportStatus = 'received' | 'reviewing' | 'dismissed' | 'completed';

export const reportStatusLabels: Record<ReportStatus, string> = {
  received: '접수됨',
  reviewing: '확인 중',
  dismissed: '이상 없음',
  completed: '처리완료',
};

export function isReportManageTargetType(value: unknown): value is ReportManageTargetType {
  return value === 'board' || value === 'post' || value === 'comment';
}

export function isReportStatus(value: unknown): value is ReportStatus {
  return value === 'received' || value === 'reviewing' || value === 'dismissed' || value === 'completed';
}

export function getAllowedReportStatuses(targetType: ReportManageTargetType) {
  if (targetType === 'board') {
    return ['reviewing', 'dismissed', 'completed'] as const;
  }

  return ['dismissed', 'completed'] as const;
}

export function isAllowedReportStatus(targetType: ReportManageTargetType, status: ReportStatus) {
  return getAllowedReportStatuses(targetType).includes(status as never);
}

export function getReportCategoryTitle(targetType: ReportTargetType, category: GuidelineReportCategory | string) {
  const reportItem = guidelineReportItemsByTargetType[targetType].find((item) => item.value === category);

  return reportItem?.title ?? String(category);
}

export function stripHtml(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function stripMarkdown(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getPostContentText({
  boardType,
  contentHtml,
  contentMarkdown,
  contentSimple,
  summary,
  youtubeUrl,
}: {
  boardType: string | null;
  contentHtml: string | null;
  contentMarkdown: string | null;
  contentSimple: string | null;
  summary: string | null;
  youtubeUrl: string | null;
}) {
  if (boardType === 'basic') {
    return stripHtml(contentHtml) || stripMarkdown(contentMarkdown);
  }

  if (boardType === 'feed') {
    return normalizeText(contentSimple);
  }

  if (boardType === 'youtube') {
    return [normalizeText(summary), normalizeText(youtubeUrl)].filter(Boolean).join('\n');
  }

  if (boardType === 'gallery') {
    return normalizeText(summary) || stripHtml(contentHtml) || stripMarkdown(contentMarkdown);
  }

  return (
    normalizeText(contentSimple) || stripHtml(contentHtml) || stripMarkdown(contentMarkdown) || normalizeText(summary)
  );
}
