'use client';

import { useEffect, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { FormControl, IconButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import MenuItem from '@/components/SelectMenuItem';
import Select from '@/components/SelectWithCheck';
import BlogAdImageDialog from '@/components/service/blog/BlogAdImageDialog';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';

export type BlogPromotionReport = {
  status: 'pending' | 'issue';
  reasonDescription: string;
  isImmediatelyStopped: boolean;
};
export type BlogPromotionItem = {
  id?: string;
  productName: string;
  thumbnailImage: string;
  thumbnailUrl: string;
  linkUrl: string;
  report?: BlogPromotionReport | null;
};
export type BlogPromotionValue = {
  type: 'none' | 'advertisement' | 'sponsorship';
  shopName: string;
  sponsorName: string;
  linkUrl: string;
  item: BlogPromotionItem;
  items: BlogPromotionItem[];
  report?: BlogPromotionReport | null;
};

export type BlogPromotionStatus = {
  isEnabled: boolean;
  isEligible: boolean;
  isIdentityVerified: boolean;
  isAtLeastAge14: boolean;
};
type Props = {
  siteName: string;
  isSubscriptionSeries: boolean;
  classes: {
    adProductItem: string;
    adProductItemError: string;
    adProductThumbnail: string;
    adProductFields: string;
    adProductDelete: string;
    addProductButton: string;
  };
  disabled?: boolean;
  initialStatus?: BlogPromotionStatus | null;
  value: BlogPromotionValue;
  onChange: (value: BlogPromotionValue) => void;
  onError: (message: string) => void;
};
const emptyItem = (): BlogPromotionItem => ({ productName: '', thumbnailImage: '', thumbnailUrl: '', linkUrl: '' });

const reportedFieldSx = (isReported: boolean) =>
  isReported
    ? (theme: Theme) => ({
        '& .MuiOutlinedInput-notchedOutline': {
          borderColor: `${theme.palette.error.main} !important`,
        },
      })
    : undefined;

export function emptyBlogPromotion(): BlogPromotionValue {
  return {
    type: 'none',
    shopName: '',
    sponsorName: '',
    linkUrl: '',
    item: emptyItem(),
    items: [emptyItem()],
    report: null,
  };
}

export default function BlogPostPromotionFields({
  siteName,
  isSubscriptionSeries,
  classes,
  disabled = false,
  initialStatus = null,
  value,
  onChange,
  onError,
}: Props) {
  const [status, setStatus] = useState<BlogPromotionStatus | null>(initialStatus);
  useEffect(() => {
    if (initialStatus) return;
    let active = true;
    fetch(`/api/manage/blog-ads?siteName=${encodeURIComponent(siteName)}`)
      .then(async (response) => {
        const data = (await response.json()) as BlogPromotionStatus & { error?: string };
        if (!response.ok) throw new Error(data.error || '광고 상태를 불러오지 못했습니다.');
        if (active) setStatus(data);
      })
      .catch((error) => active && onError(error instanceof Error ? error.message : '광고 상태를 불러오지 못했습니다.'));
    return () => {
      active = false;
    };
  }, [initialStatus, onError, siteName]);
  const available = status?.isEnabled && status.isEligible && status.isIdentityVerified && status.isAtLeastAge14;
  const currentItems = isSubscriptionSeries ? value.items : [value.item];
  const reportForItem = (item: BlogPromotionItem) => item.report ?? (!isSubscriptionSeries ? value.report : null);
  const hasImmediatelyStoppedItem = currentItems.some((item) => reportForItem(item)?.isImmediatelyStopped);
  const hasReportedItem = currentItems.some((item) => reportForItem(item));
  const isImmediatelyStoppedPromotion = Boolean(value.report?.isImmediatelyStopped);
  const hasReportedPromotion = Boolean(value.report);
  const locked = hasImmediatelyStoppedItem || isImmediatelyStoppedPromotion;
  const hasStoppedPromotion = locked;
  function patchItem(patch: Partial<BlogPromotionItem>) {
    onChange({ ...value, item: { ...value.item, ...patch } });
  }
  function patchMultiItem(index: number, patch: Partial<BlogPromotionItem>) {
    onChange({
      ...value,
      items: value.items.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    });
  }
  async function upload(file: File) {
    const formData = new FormData();
    formData.append('siteName', siteName);
    formData.append('file', file);
    const response = await fetch('/api/manage/blog-ads/image', { method: 'POST', body: formData });
    const data = (await response.json()) as { path?: string; url?: string; error?: string };
    if (!response.ok || !data.path || !data.url) throw new Error(data.error || '상품 썸네일 업로드에 실패했습니다.');
    return { path: data.path, url: data.url };
  }
  return (
    <Stack gap={1}>
      <Typography variant="subtitle2">협찬 또는 광고</Typography>
      {!status ? <Typography variant="body2">광고 사용 상태를 확인하는 중입니다.</Typography> : null}
      {status && !status.isEnabled ? (
        <Typography variant="body2">광고 관리에서 광고 사용을 켠 뒤 설정할 수 있습니다.</Typography>
      ) : null}
      {status?.isEnabled && !status.isIdentityVerified ? (
        <>
          <Typography variant="body2">협찬 또는 광고를 설정하려면 본인인증이 필요합니다.</Typography>
          <IdentityVerificationButton onVerified={() => window.location.reload()} />
        </>
      ) : null}
      {status?.isEnabled && status.isIdentityVerified && !status.isAtLeastAge14 ? (
        <Typography variant="body2">만 14세 미만은 광고 또는 협찬을 설정할 수 없습니다.</Typography>
      ) : null}
      <FormControl fullWidth size="small" disabled={disabled || !available}>
        <Select
          value={value.type}
          onChange={(event) => onChange({ ...value, type: event.target.value as BlogPromotionValue['type'] })}
        >
          <MenuItem value="none">
            <ListItemText primary="협찬/광고 없음" />
          </MenuItem>
          <MenuItem value="advertisement" disabled={locked && value.type !== 'advertisement'}>
            <ListItemText primary="광고" />
          </MenuItem>
          <MenuItem value="sponsorship" disabled={locked && value.type !== 'sponsorship'}>
            <ListItemText primary="협찬" />
          </MenuItem>
        </Select>
      </FormControl>
      {hasStoppedPromotion ? (
        <Typography variant="body2" color="warning">
          광고집행 정지 사유를 컨시어지팀에서 확인 중입니다.
        </Typography>
      ) : null}
      {available && value.type === 'sponsorship' ? (
        <>
          <TextField
            disabled={disabled || isImmediatelyStoppedPromotion}
            placeholder="협찬사명"
            value={value.sponsorName}
            error={hasReportedPromotion}
            sx={reportedFieldSx(hasReportedPromotion)}
            slotProps={{ htmlInput: { maxLength: 50 } }}
            onChange={(event) => onChange({ ...value, sponsorName: event.target.value })}
            size="small"
          />
          <TextField
            disabled={disabled || isImmediatelyStoppedPromotion}
            placeholder="협찬 링크"
            value={value.linkUrl}
            error={hasReportedPromotion}
            sx={reportedFieldSx(hasReportedPromotion)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            onChange={(event) => onChange({ ...value, linkUrl: event.target.value })}
            helperText="https 주소만 등록할 수 있습니다."
            size="small"
          />
          {value.report && !value.report.isImmediatelyStopped ? (
            <Typography variant="body2" color="warning">
              [{value.report.reasonDescription}] 사유로 광고가 거절되었습니다.
            </Typography>
          ) : null}
        </>
      ) : null}
      {available && value.type === 'advertisement' ? (
        <>
          <TextField
            disabled={disabled || hasImmediatelyStoppedItem}
            placeholder="쇼핑몰명"
            value={value.shopName}
            error={hasReportedItem}
            sx={reportedFieldSx(hasReportedItem)}
            slotProps={{ htmlInput: { maxLength: 50 } }}
            onChange={(event) => onChange({ ...value, shopName: event.target.value })}
            size="small"
          />
          {currentItems.map((item, index) => {
            const itemReport = reportForItem(item);

            return (
              <div
                key={item.id ?? (isSubscriptionSeries ? `${index}-${item.thumbnailImage}` : 'single')}
                className={`${classes.adProductItem} ${itemReport ? classes.adProductItemError : ''}`}
              >
                <div className={classes.adProductThumbnail}>
                  <BlogAdImageDialog
                    disabled={disabled || itemReport?.isImmediatelyStopped}
                    value={item.thumbnailImage}
                    previewUrl={item.thumbnailUrl}
                    onUpload={upload}
                    onChange={(image) =>
                      isSubscriptionSeries
                        ? patchMultiItem(index, { thumbnailImage: image.path, thumbnailUrl: image.url })
                        : patchItem({ thumbnailImage: image.path, thumbnailUrl: image.url })
                    }
                    onError={onError}
                  />
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" />
                  ) : (
                    <Typography variant="body2">이미지 없음</Typography>
                  )}
                </div>
                <div className={classes.adProductFields}>
                  <Stack direction="column" gap={1}>
                    {isSubscriptionSeries ? <Typography variant="body2">상품 #{index + 1}</Typography> : null}
                    <TextField
                      disabled={disabled || itemReport?.isImmediatelyStopped}
                      placeholder="상품명"
                      value={item.productName}
                      error={Boolean(itemReport)}
                      sx={reportedFieldSx(Boolean(itemReport))}
                      slotProps={{ htmlInput: { maxLength: 50 } }}
                      onChange={(event) =>
                        isSubscriptionSeries
                          ? patchMultiItem(index, { productName: event.target.value })
                          : patchItem({ productName: event.target.value })
                      }
                      size="small"
                    />
                    <TextField
                      disabled={disabled || itemReport?.isImmediatelyStopped}
                      placeholder="링크"
                      value={item.linkUrl}
                      error={Boolean(itemReport)}
                      sx={reportedFieldSx(Boolean(itemReport))}
                      slotProps={{ htmlInput: { maxLength: 100 } }}
                      onChange={(event) =>
                        isSubscriptionSeries
                          ? patchMultiItem(index, { linkUrl: event.target.value })
                          : patchItem({ linkUrl: event.target.value })
                      }
                      helperText="https 주소만 등록할 수 있습니다."
                      size="small"
                    />
                    {itemReport && !itemReport.isImmediatelyStopped ? (
                      <Typography variant="body2" color="warning">
                        [{itemReport.reasonDescription}] 사유로 광고가 거절되었습니다.
                      </Typography>
                    ) : null}
                  </Stack>
                </div>
                {isSubscriptionSeries && value.items.length > 1 ? (
                  <div className={classes.adProductDelete}>
                    <IconButton
                      aria-label="상품 삭제"
                      disabled={disabled}
                      onClick={() =>
                        onChange({ ...value, items: value.items.filter((_, itemIndex) => itemIndex !== index) })
                      }
                    >
                      <CloseRoundedIcon />
                    </IconButton>
                  </div>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}
      {available && value.type === 'advertisement' && isSubscriptionSeries && value.items.length < 10 ? (
        <button
          type="button"
          className={`button small action ${classes.addProductButton}`}
          disabled={disabled || hasImmediatelyStoppedItem}
          onClick={() => onChange({ ...value, items: [...value.items, emptyItem()] })}
        >
          상품 추가 <AddRoundedIcon fontSize="small" />
        </button>
      ) : null}
    </Stack>
  );
}
