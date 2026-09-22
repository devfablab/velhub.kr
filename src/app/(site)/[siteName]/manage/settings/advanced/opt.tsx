'use client';

import { type JSX, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import PopupMessage from '@/components/PopupMessage';
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
  error?: string;
};

export type AdvancedInfoResponse = { siteInfo?: SiteInfoInfo; error?: string };

type EditResponse = {
  ok?: boolean;
  sites?: SitesRow;
  error?: string;
};

type VisibilityMember = 'public' | 'private';

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

  const [visibilityMember, setVisibilityMember] = useState<VisibilityMember>(
    initialSites?.sites?.visibility_member === 'private' ? 'private' : 'public',
  );
  const [searchKeywords, setSearchKeywords] = useState(initialSites?.sites?.search_keywords ?? '');
  const [googleAnalytics, setGoogleAnalytics] = useState(initialSites?.sites?.google_analytics ?? '');
  const [googleSearch, setGoogleSearch] = useState(initialSites?.sites?.google_search ?? '');

  const [errorMessage, setErrorMessage] = useState(initialError);
  const [snackbarMessage, setSnackbarMessage] = useState('');

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

    setVisibilityMember(result.sites.visibility_member === 'private' ? 'private' : 'public');
    setSearchKeywords(result.sites.search_keywords ?? '');
    setGoogleAnalytics(result.sites.google_analytics ?? '');
    setGoogleSearch(result.sites.google_search ?? '');
  }

  function handleVisibilityMemberChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;
    if (nextValue !== 'public' && nextValue !== 'private') {
      return;
    }

    setVisibilityMember(nextValue);
  }

  function handleSearchKeywordsChange(event: InputChangeEvent) {
    setSearchKeywords(event.currentTarget.value);
  }

  function handleGoogleAnalyticsChange(event: InputChangeEvent) {
    setGoogleAnalytics(event.currentTarget.value);
  }

  function handleGoogleSearchChange(event: InputChangeEvent) {
    setGoogleSearch(event.currentTarget.value);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch(`/api/info/advanced/site/${siteName}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          visibilityMember,
          searchKeywords,
          googleAnalytics,
          googleSearch,
        }),
      });

      const result = (await response.json()) as EditResponse;

      if (!response.ok) {
        throw new Error(result.error ?? 'sites 정보 저장에 실패했습니다.');
      }

      await loadSites();
      setSnackbarMessage('저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || 'sites 정보 저장에 실패했습니다.');
      } else {
        setErrorMessage('sites 정보 저장에 실패했습니다.');
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
            <div className={`paper paper-error ${styles.paper}`}>사이트 정보를 불러오지 못했습니다</div>
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
              <Typography variant="subtitle2">검색엔진 등록 키워드</Typography>
              <TextField
                value={searchKeywords}
                onChange={handleSearchKeywordsChange}
                fullWidth
                size="small"
                helperText="쉼표(,)로 구분해서 입력"
              />
            </div>

            <div className={`paper ${styles.paper}`}>
              <Typography variant="subtitle2">Google Analytics ID</Typography>
              <TextField
                value={googleAnalytics}
                onChange={handleGoogleAnalyticsChange}
                fullWidth
                size="small"
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
                helperText="meta 태그의 content 값만 입력하세요"
              />
            </div>

            {isMobile ? (
              <div className={styles['button-top']}>
                <button type="submit" className={`button ${styles.button}`}>
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
        </div>
      </div>
    </Container>
  );
}
