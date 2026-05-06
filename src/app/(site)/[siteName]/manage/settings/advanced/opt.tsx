'use client';

import { useEffect, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type SitesRow = {
  owner_id: string;
  updated_at: string;
  updated_by: string;
  site_id: string;
  log: string | null;
  visibility_member: string | null;
  search_keywords: string | null;
};

type GetResponse = {
  sites?: SitesRow;
  error?: string;
};

type EditResponse = {
  ok?: boolean;
  sites?: SitesRow;
  error?: string;
};

type VisibilityMember = 'public' | 'private';

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [visibilityMember, setVisibilityMember] = useState<VisibilityMember>('public');
  const [searchKeywords, setSearchKeywords] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  async function loadSites() {
    const response = await fetch(`/api/info/advanced/site/${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as GetResponse;

    if (!response.ok) {
      throw new Error(result.error ?? 'sites 정보를 불러오지 못했습니다.');
    }

    if (!result.sites) {
      throw new Error('sites 정보를 불러오지 못했습니다.');
    }

    setVisibilityMember(result.sites.visibility_member === 'private' ? 'private' : 'public');
    setSearchKeywords(result.sites.search_keywords ?? '');
  }

  useEffect(() => {
    async function init() {
      try {
        setErrorMessage('');
        await loadSites();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || 'sites 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('sites 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, [siteName]);

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

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={5}>
      {isNotMobile ? (
        <Typography variant="h5" component="h1">
          추가 설정
        </Typography>
      ) : null}

      <Stack component="form" spacing={3} onSubmit={handleSubmit}>
        <Stack spacing={1}>
          <Typography variant="subtitle2">멤버 목록 공개여부</Typography>
          <RadioGroup value={visibilityMember} onChange={handleVisibilityMemberChange} row>
            <FormControlLabel value="public" control={<Radio />} label="공개" />
            <FormControlLabel value="private" control={<Radio />} label="비공개" />
          </RadioGroup>
        </Stack>

        <TextField
          label="검색용 키워드"
          value={searchKeywords}
          onChange={handleSearchKeywordsChange}
          fullWidth
          size="small"
          helperText="쉼표(,)로 구분해서 입력"
        />

        <Stack direction="row" justifyContent="flex-end">
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            저장
          </Button>
        </Stack>

        {errorMessage ? (
          <Alert severity="error" variant="filled">
            {errorMessage}
          </Alert>
        ) : null}
      </Stack>

      <Snackbar
        open={Boolean(snackbarMessage)}
        autoHideDuration={2500}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Stack>
  );
}
