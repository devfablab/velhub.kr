'use client';

import { type JSX, useState } from 'react';
import { useParams } from 'next/navigation';
import { MenuItem, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import type { SiteCategoryGroup } from '@/lib/service/siteCategories';
import { normalizeText } from '@/lib/utils';
import FormErrorDialog from '@/components/FormErrorDialog';
import PopupMessage from '@/components/PopupMessage';
import ScreenState from '@/components/service/ScreenState';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type SiteInfoInfo = {
  created_at: string;
  site_key: string;
  site_label: string | null;
  profile_picture: string | null;
  profile_logo: string | null;
  summary: string | null;
  site_type: string;
  visibility_type: string;
  theme_type: string;
  is_shutdown: boolean;
};

type SitesRow = {
  owner_id: string;
  updated_at: string;
  updated_by: string;
  site_id: string;
  log: string | null;
  visibility_member: string | null;
  search_keywords: string | null;
  google_analytics: string | null;
  google_search: string | null;
};

export type AdvancedSitesResponse = {
  sites?: SitesRow;
  categoryId?: number | null;
  categoryGroups?: SiteCategoryGroup[];
  canEditCategory?: boolean;
  error?: string;
};

function findCategoryGroupId(groups: SiteCategoryGroup[], categoryId: number | null | undefined) {
  if (!categoryId) {
    return '';
  }

  const group = groups.find((item) => item.categories.some((category) => category.id === categoryId));

  return group ? String(group.id) : '';
}

export type AdvancedInfoResponse = { siteInfo?: SiteInfoInfo; error?: string };

type EditResponse = {
  ok?: boolean;
  sites?: SitesRow;
  error?: string;
};

type AdvancedField = 'searchKeywords' | 'googleAnalytics' | 'googleSearch' | 'category';
type FieldErrors = Record<AdvancedField, string>;

const EMPTY_FIELD_ERRORS: FieldErrors = {
  searchKeywords: '',
  googleAnalytics: '',
  googleSearch: '',
  category: '',
};
const GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN = /^G-[A-Z0-9]+$/;

type OptProps = {
  initialInfo: AdvancedInfoResponse | null;
  initialSites: AdvancedSitesResponse | null;
  initialError: string;
};

export default function Opt({ initialInfo, initialSites, initialError }: OptProps) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [siteInfo] = useState<SiteInfoInfo | null>(initialInfo?.siteInfo ?? null);

  const [searchKeywords, setSearchKeywords] = useState(initialSites?.sites?.search_keywords ?? '');
  const [googleAnalytics, setGoogleAnalytics] = useState(initialSites?.sites?.google_analytics ?? '');
  const [googleSearch, setGoogleSearch] = useState(initialSites?.sites?.google_search ?? '');
  const categoryGroups = initialSites?.categoryGroups ?? [];
  const canEditCategory = initialSites?.canEditCategory === true;
  const [categoryGroupId, setCategoryGroupId] = useState(findCategoryGroupId(categoryGroups, initialSites?.categoryId));
  const [categoryId, setCategoryId] = useState(initialSites?.categoryId ? String(initialSites.categoryId) : '');
  const selectedCategoryGroup = categoryGroups.find((group) => String(group.id) === categoryGroupId);

  const [errorMessage, setErrorMessage] = useState(initialError);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>(EMPTY_FIELD_ERRORS);
  const [isErrorDialogOpen, setIsErrorDialogOpen] = useState(Boolean(initialError));
  const [errorDialogTitle, setErrorDialogTitle] = useState<string | null>(initialError ? '고급 설정' : null);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  function showError(message: string, nextFieldErrors: Partial<FieldErrors> = {}, title: string | null = '고급 설정') {
    setErrorMessage(message);
    setFieldErrors({ ...EMPTY_FIELD_ERRORS, ...nextFieldErrors });
    setErrorDialogTitle(title);
    setIsErrorDialogOpen(true);
  }

  async function loadSites() {
    const response = await fetch(`/api/info/advanced/site/${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as AdvancedSitesResponse;

    if (!response.ok) {
      throw new Error(result.error ?? 'sites 정보를 불러오지 못했습니다.');
    }

    if (!result.sites) {
      throw new Error('sites 정보를 불러오지 못했습니다.');
    }

    setSearchKeywords(result.sites.search_keywords ?? '');
    setGoogleAnalytics(result.sites.google_analytics ?? '');
    setGoogleSearch(result.sites.google_search ?? '');
    setCategoryGroupId(findCategoryGroupId(result.categoryGroups ?? categoryGroups, result.categoryId));
    setCategoryId(result.categoryId ? String(result.categoryId) : '');
  }

  function handleCategoryGroupChange(event: InputChangeEvent) {
    setCategoryGroupId(event.target.value);
    setCategoryId('');
    setFieldErrors((previousErrors) => ({ ...previousErrors, category: '' }));
  }

  function handleCategoryChange(event: InputChangeEvent) {
    setCategoryId(event.target.value);
    setFieldErrors((previousErrors) => ({ ...previousErrors, category: '' }));
  }

  function handleSearchKeywordsChange(event: InputChangeEvent) {
    setSearchKeywords(event.currentTarget.value);
    setFieldErrors((previousErrors) => ({ ...previousErrors, searchKeywords: '' }));
  }

  function handleGoogleAnalyticsChange(event: InputChangeEvent) {
    setGoogleAnalytics(event.currentTarget.value);
    setFieldErrors((previousErrors) => ({ ...previousErrors, googleAnalytics: '' }));
  }

  function handleGoogleSearchChange(event: InputChangeEvent) {
    setGoogleSearch(event.currentTarget.value);
    setFieldErrors((previousErrors) => ({ ...previousErrors, googleSearch: '' }));
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const nextFieldErrors: FieldErrors = {
      searchKeywords: /[^\p{L}\p{N}\s,]/u.test(searchKeywords)
        ? '검색엔진 등록 키워드는 글자, 숫자, 쉼표만 입력해 주세요.'
        : '',
      googleAnalytics:
        googleAnalytics.trim() && !GOOGLE_ANALYTICS_MEASUREMENT_ID_PATTERN.test(googleAnalytics.trim().toUpperCase())
          ? 'Google Analytics 측정 ID는 G-로 시작하는 값으로 입력해 주세요.'
          : '',
      googleSearch: '',
      category: categoryGroupId && !categoryId ? '소분류를 선택해 주세요.' : '',
    };
    const validationMessages = Object.values(nextFieldErrors).filter(Boolean);
    if (validationMessages.length > 0) {
      showError(validationMessages.join('\n'), nextFieldErrors);
      return;
    }

    try {
      setErrorMessage('');
      setFieldErrors(EMPTY_FIELD_ERRORS);
      setIsSubmitting(true);

      const response = await fetch(`/api/info/advanced/site/${siteName}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          searchKeywords,
          googleAnalytics,
          googleSearch,
          categoryId: categoryId ? Number(categoryId) : null,
        }),
      });

      const result = (await response.json()) as EditResponse;

      if (!response.ok) {
        const message = result.error ?? '사이트 설정 저장에 실패했습니다.';
        const matchingFieldErrors: Partial<FieldErrors> = message.includes('Analytics')
          ? { googleAnalytics: message }
          : message.includes('키워드')
            ? { searchKeywords: message }
            : message.includes('카테고리')
              ? { category: message }
              : {};
        showError(message, matchingFieldErrors, response.status >= 500 ? null : '고급 설정');
        return;
      }

      await loadSites();
      setSnackbarMessage('저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        showError(unknownError.message || '사이트 설정 저장에 실패했습니다.', {}, null);
      } else {
        showError('사이트 설정 저장에 실패했습니다.', {}, null);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!siteInfo) {
    return (
      <Container pageTitle="사이트 정보" pageBack={`/${siteName}/manage`} menu="settings">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <ScreenState kind="error">{initialError || '사이트 정보를 불러오지 못했습니다.'}</ScreenState>
            <FormErrorDialog
              open={isErrorDialogOpen}
              title={errorDialogTitle}
              messages={errorMessage ? errorMessage.split('\n') : []}
              onClose={() => setIsErrorDialogOpen(false)}
            />
          </div>
        </div>
      </Container>
    );
  }

  if (!initialSites?.sites) {
    return (
      <Container pageTitle="고급 설정" pageBack={`/${siteName}/manage`} menu="settings">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            <ScreenState kind="error">{initialError || '고급 설정을 불러오지 못했습니다.'}</ScreenState>
            <FormErrorDialog
              open={isErrorDialogOpen}
              title={errorDialogTitle}
              messages={errorMessage ? errorMessage.split('\n') : []}
              onClose={() => setIsErrorDialogOpen(false)}
            />
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container
      pageTitle={siteInfo.site_type === 'community' ? '커뮤니티 정보' : '블로그 정보'}
      pageBack={`/${siteName}/manage`}
      menu="settings"
    >
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Stack component="form" gap={3} onSubmit={handleSubmit}>
            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">카테고리</Typography>
              <Stack direction="row" gap={1}>
                <TextField
                  select
                  value={categoryGroupId}
                  onChange={handleCategoryGroupChange}
                  fullWidth
                  size="small"
                  disabled={!canEditCategory}
                  slotProps={{ select: { displayEmpty: true } }}
                >
                  <MenuItem value="" disabled>
                    선택하세요
                  </MenuItem>
                  {categoryGroups.map((group) => (
                    <MenuItem key={group.id} value={String(group.id)}>
                      {group.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  value={categoryId}
                  onChange={handleCategoryChange}
                  fullWidth
                  size="small"
                  disabled={!canEditCategory || !selectedCategoryGroup}
                  error={Boolean(fieldErrors.category)}
                  slotProps={{ select: { displayEmpty: true } }}
                >
                  <MenuItem value="" disabled>
                    선택하세요
                  </MenuItem>
                  {(selectedCategoryGroup?.categories ?? []).map((category) => (
                    <MenuItem key={category.id} value={String(category.id)}>
                      {category.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
              {fieldErrors.category || !canEditCategory ? (
                <Typography variant="caption" color={fieldErrors.category ? 'error' : 'textSecondary'}>
                  {fieldErrors.category || '카테고리는 운영자만 변경할 수 있습니다.'}
                </Typography>
              ) : null}
            </div>

            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">검색엔진 등록 키워드</Typography>
              <TextField
                value={searchKeywords}
                onChange={handleSearchKeywordsChange}
                fullWidth
                size="small"
                error={Boolean(fieldErrors.searchKeywords)}
                helperText={fieldErrors.searchKeywords || '쉼표(,)로 구분해서 입력'}
              />
            </div>

            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">Google Analytics ID</Typography>
              <TextField
                value={googleAnalytics}
                onChange={handleGoogleAnalyticsChange}
                fullWidth
                size="small"
                error={Boolean(fieldErrors.googleAnalytics)}
                helperText={fieldErrors.googleAnalytics || 'G-로 시작하는 Google Analytics 측정 ID를 입력하세요.'}
                placeholder="G-XXXXXXXXXX"
              />
            </div>

            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">Google Search Console 인증 코드</Typography>
              <TextField
                value={googleSearch}
                onChange={handleGoogleSearchChange}
                fullWidth
                size="small"
                error={Boolean(fieldErrors.googleSearch)}
                helperText={fieldErrors.googleSearch || 'meta 태그의 content 값만 입력하세요'}
              />
            </div>

            {isMobile ? (
              <div className={styles['button-top']}>
                <button type="submit" className={`button ${styles.button}`} disabled={isSubmitting}>
                  저장
                </button>
              </div>
            ) : (
              <Stack direction="row" justifyContent="flex-end">
                <button type="submit" className="button medium submit" disabled={isSubmitting}>
                  저장
                </button>
              </Stack>
            )}

            {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
          </Stack>

          <PopupMessage
            open={Boolean(snackbarMessage)}
            message={snackbarMessage}
            onClose={() => setSnackbarMessage('')}
          />
          <FormErrorDialog
            open={isErrorDialogOpen}
            title={errorDialogTitle}
            messages={errorMessage ? errorMessage.split('\n') : []}
            onClose={() => setIsErrorDialogOpen(false)}
          />
        </div>
      </div>
    </Container>
  );
}
