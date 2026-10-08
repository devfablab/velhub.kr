'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { FormControlLabel, IconButton, Stack, TextField, Typography } from '@mui/material';
import { normalizeText } from '@/lib/utils';
import { IOSSwitch } from '@/components/custom-ui/CustomizedSwitches';
import FormErrorDialog from '@/components/FormErrorDialog';
import PopupMessage from '@/components/PopupMessage';
import BlogAdImageDialog from '@/components/service/blog/BlogAdImageDialog';
import IdentityVerificationButton from '@/components/service/common/IdentityVerificationButton';
import ScreenState from '@/components/service/ScreenState';
import styles from '@/app/manage.module.sass';

type Data = {
  isEnabled: boolean;
  isEligible: boolean;
  hasBeenOpenFor15Days: boolean;
  postCount: number;
  totalViews: number;
  isIdentityVerified: boolean;
  isAtLeastAge14: boolean;
};

type AdItem = { id?: string; productName: string; thumbnailImage: string; thumbnailUrl: string; linkUrl: string };

export default function Opt({ initialData }: { initialData: Data }) {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();
  const [isEnabled, setIsEnabled] = useState(initialData.isEnabled);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [items, setItems] = useState<AdItem[]>([]);
  const [shopName, setShopName] = useState('');
  const [isLoadingItems, setIsLoadingItems] = useState(initialData.isEnabled);

  const unavailableReason = !initialData.hasBeenOpenFor15Days
    ? initialData.postCount < 10
      ? '블로그 개설한지 15일이 되지 않았으며 쓴 글도 10개 미만입니다. 광고를 설정할 수 없습니다.'
      : '블로그 개설한지 15일이 되지 않았으므로 광고를 설정할 수 없습니다.'
    : initialData.postCount < 10
      ? '쓴 글이 10개 미만이므로 광고를 설정할 수 없습니다.'
      : initialData.totalViews < 1000
        ? '게시된 글의 전체 조회수가 1,000회 미만이므로 광고를 설정할 수 없습니다.'
        : '';

  async function changeEnabled(nextValue: boolean) {
    if (isSubmitting || !initialData.isEligible) return;
    if (!initialData.isIdentityVerified) {
      return;
    }
    if (!initialData.isAtLeastAge14) {
      setError('만 14세 미만은 광고를 설정할 수 없습니다.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/manage/blog-ads', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName, isEnabled: nextValue }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || '광고 사용 상태를 변경하지 못했습니다.');
      setIsEnabled(nextValue);
      if (nextValue) void loadItems();
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '광고 사용 상태를 변경하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function loadItems() {
    setIsLoadingItems(true);
    try {
      const response = await fetch(`/api/manage/blog-ads/common?siteName=${encodeURIComponent(siteName)}`);
      const data = (await response.json()) as {
        ads?: {
          id: string;
          product_name: string;
          shop_name: string | null;
          thumbnail_image: string;
          thumbnail_url: string;
          link_url: string;
        }[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || '기본 광고를 불러오지 못했습니다.');
      setItems(
        (data.ads ?? []).map((item) => ({
          id: item.id,
          productName: item.product_name,
          thumbnailImage: item.thumbnail_image,
          thumbnailUrl: item.thumbnail_url,
          linkUrl: item.link_url,
        })),
      );
      setShopName(data.ads?.[0]?.shop_name ?? '');
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '기본 광고를 불러오지 못했습니다.');
    } finally {
      setIsLoadingItems(false);
    }
  }

  useEffect(() => {
    if (initialData.isEnabled) void loadItems();
  }, []);

  function updateItem(index: number, patch: Partial<AdItem>) {
    setItems((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }

  async function uploadThumbnail(file: File) {
    const formData = new FormData();
    formData.append('siteName', siteName);
    formData.append('file', file);
    const response = await fetch('/api/manage/blog-ads/image', { method: 'POST', body: formData });
    const data = (await response.json()) as { path?: string; url?: string; error?: string };
    if (!response.ok || !data.path || !data.url) throw new Error(data.error || '상품 썸네일 업로드에 실패했습니다.');
    return { path: data.path, url: data.url };
  }

  async function saveItems() {
    if (isSubmitting) return;
    const messages = items.flatMap((item, index) => {
      const itemName = `기본 광고 ${index + 1}`;
      if (!item.productName.trim()) return [`${itemName}의 상품명을 입력해주세요.`];
      if (item.productName.trim().length > 50) return [`${itemName}의 상품명은 50자 이하로 입력해주세요.`];
      if (!item.thumbnailImage) return [`${itemName}의 상품 썸네일을 등록해주세요.`];
      if (!item.linkUrl.trim().startsWith('https://')) return [`${itemName}의 링크는 HTTPS 주소로 입력해주세요.`];
      if (item.linkUrl.trim().length > 100) return [`${itemName}의 링크는 100자 이하로 입력해주세요.`];
      return [];
    });
    if (!shopName.trim()) messages.unshift('쇼핑몰명을 입력해주세요.');
    if (shopName.trim().length > 50) messages.unshift('쇼핑몰명은 50자 이하로 입력해주세요.');
    if (messages.length) {
      setError(messages[0]);
      return;
    }
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/manage/blog-ads/common', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteName, shopName, items }),
      });
      const data = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || !data.ok) throw new Error(data.error || '기본 광고를 저장하지 못했습니다.');
      await loadItems();
      setSuccessMessage('상품이 성공적으로 등록되었습니다.');
    } catch (unknownError) {
      setError(unknownError instanceof Error ? unknownError.message : '기본 광고를 저장하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={`container ${styles.container}`}>
      <div className={`content ${styles.content}`}>
        {unavailableReason ? <ScreenState kind="error">{unavailableReason}</ScreenState> : null}
        {!unavailableReason && !initialData.isIdentityVerified ? (
          <>
            <p>광고를 설정하려면 본인인증이 필요합니다.</p>
            <IdentityVerificationButton onVerified={() => window.location.reload()} />
          </>
        ) : null}
        {!unavailableReason && initialData.isIdentityVerified && !initialData.isAtLeastAge14 ? (
          <p>만 14세 미만은 광고를 설정할 수 없습니다.</p>
        ) : null}
        {!unavailableReason && initialData.isIdentityVerified && initialData.isAtLeastAge14 ? (
          <Stack sx={{ p: 2 }}>
            <FormControlLabel
              label="광고 설정"
              control={
                <IOSSwitch
                  sx={{ m: 1 }}
                  checked={isEnabled}
                  onChange={(_, checked) => void changeEnabled(checked)}
                  disabled={
                    isSubmitting ||
                    Boolean(unavailableReason) ||
                    !initialData.isIdentityVerified ||
                    !initialData.isAtLeastAge14
                  }
                />
              }
            />
          </Stack>
        ) : null}
        {isEnabled ? (
          <div className={`paper ${styles.paper}`}>
            <Typography variant="subtitle2">기본 적용 광고</Typography>
            <Typography variant="body2">연재글에 표시할 상품을 최대 10개까지 등록할 수 있습니다.</Typography>
            {isLoadingItems ? <p>기본 광고를 불러오는 중입니다.</p> : null}
            <TextField
              placeholder="쇼핑몰명"
              value={shopName}
              onChange={(event) => setShopName(event.target.value)}
              inputProps={{ maxLength: 50 }}
              disabled={isSubmitting}
              size="small"
            />
            {items.map((item, index) => (
              <div key={item.id ?? `new-${index}`} className={styles['ad-product-item']}>
                <div className={styles['ad-product-thumbnail']}>
                  <BlogAdImageDialog
                    disabled={isSubmitting}
                    value={item.thumbnailImage}
                    previewUrl={item.thumbnailUrl}
                    onUpload={uploadThumbnail}
                    onChange={(image) => updateItem(index, { thumbnailImage: image.path, thumbnailUrl: image.url })}
                    onError={setError}
                  />
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" />
                  ) : (
                    <Typography variant="body2">이미지 없음</Typography>
                  )}
                </div>
                <div className={styles['ad-product-fields']}>
                  <Stack direction="column" gap={1}>
                    <TextField
                      placeholder="상품명"
                      value={item.productName}
                      onChange={(event) => updateItem(index, { productName: event.target.value })}
                      inputProps={{ maxLength: 50 }}
                      size="small"
                    />
                    <TextField
                      placeholder="링크"
                      value={item.linkUrl}
                      onChange={(event) => updateItem(index, { linkUrl: event.target.value })}
                      inputProps={{ maxLength: 100 }}
                      size="small"
                    />
                  </Stack>
                </div>
                <div className={styles['ad-product-delete']}>
                  <IconButton
                    aria-label="상품 삭제"
                    onClick={() => setItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  >
                    <CloseRoundedIcon />
                  </IconButton>
                </div>
              </div>
            ))}
            <button
              type="button"
              className={`button small action ${styles['add-product-button']}`}
              disabled={items.length >= 10 || isSubmitting}
              onClick={() =>
                setItems((current) => [
                  ...current,
                  { productName: '', thumbnailImage: '', thumbnailUrl: '', linkUrl: '' },
                ])
              }
            >
              상품 추가{' '}
              <span>
                <AddRoundedIcon fontSize="small" />
              </span>
            </button>
            <button
              type="button"
              className="button medium submit"
              disabled={isSubmitting}
              onClick={() => void saveItems()}
            >
              상품 등록하기
            </button>
          </div>
        ) : null}
      </div>
      <FormErrorDialog open={Boolean(error)} messages={error ? [error] : []} onClose={() => setError('')} />
      <PopupMessage open={Boolean(successMessage)} message={successMessage} onClose={() => setSuccessMessage('')} />
    </div>
  );
}
