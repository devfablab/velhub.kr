'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FormControl,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../../menu';
import styles from '@/app/manage.module.sass';

type ApplyScope = 'subject' | 'description' | 'both';
type FontFamily = 'neo' | 'pre' | 'sans' | 'serif' | 'ham';

type BlogFontRow = {
  subject_font_family: FontFamily | null;
  subject_letter_spacing: number | null;
  subject_line_height: number | null;
  description_font_family: FontFamily | null;
  description_letter_spacing: number | null;
  description_line_height: number | null;
  description_font_size: number | null;
  description_margin: number | null;
};

const SUBJECT_FONT_OPTIONS: Array<{ label: string; value: FontFamily | '' }> = [
  { label: '나눔 스퀘어 네오 (기본 서체)', value: 'neo' },
  { label: '프리텐다드', value: 'pre' },
  { label: '노토 산스/본고딕', value: 'sans' },
  { label: '노토 세리프/본명조', value: 'serif' },
  { label: '함렛', value: 'ham' },
];

const DESCRIPTION_FONT_OPTIONS: Array<{ label: string; value: FontFamily | '' }> = [
  { label: '나눔 스퀘어 네오', value: 'neo' },
  { label: '프리텐다드 (기본 서체)', value: 'pre' },
  { label: '노토 산스/본고딕', value: 'sans' },
  { label: '노토 세리프/본명조', value: 'serif' },
  { label: '함렛', value: 'ham' },
];

const LETTER_SPACING_OPTIONS: Array<{ label: string; value: number | '' }> = [
  { label: '좁게', value: -0.075 },
  { label: '기본', value: -0.005 },
  { label: '넓게', value: 0.7 },
];

const LINE_HEIGHT_OPTIONS: Array<{ label: string; value: number | '' }> = [
  { label: '좁게', value: 1.2 },
  { label: '기본', value: 1.5 },
  { label: '넓게', value: 1.7 },
];

const FONT_SIZE_OPTIONS: Array<{ label: string; value: number | '' }> = [
  { label: '작게', value: 14 },
  { label: '기본', value: 16 },
  { label: '크게', value: 18 },
];

const MARGIN_OPTIONS: Array<{ label: string; value: number | '' }> = [
  { label: '작게', value: 14 },
  { label: '기본', value: 16 },
  { label: '크게', value: 18 },
];

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [isLoading, setIsLoading] = useState(true);
  const [applyScope, setApplyScope] = useState<ApplyScope>('subject');
  const [subjectFontFamily, setSubjectFontFamily] = useState<FontFamily | ''>('neo');
  const [subjectLetterSpacing, setSubjectLetterSpacing] = useState<number | ''>(-0.005);
  const [subjectLineHeight, setSubjectLineHeight] = useState<number | ''>(1.5);
  const [descriptionFontFamily, setDescriptionFontFamily] = useState<FontFamily | ''>('pre');
  const [descriptionLetterSpacing, setDescriptionLetterSpacing] = useState<number | ''>(-0.005);
  const [descriptionLineHeight, setDescriptionLineHeight] = useState<number | ''>(1.5);
  const [descriptionFontSize, setDescriptionFontSize] = useState<number | ''>(16);
  const [descriptionMargin, setDescriptionMargin] = useState<number | ''>(16);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  useEffect(() => {
    async function loadFonts() {
      try {
        const response = await fetch(`/api/manage/design/blog/fonts?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '기본 서체 설정을 불러오지 못했습니다.');
        }

        const blog = (result.blog ?? {}) as BlogFontRow;

        const nextSubjectFontFamily = (blog.subject_font_family ?? 'neo') as FontFamily;
        const nextSubjectLetterSpacing = blog.subject_letter_spacing ?? -0.005;
        const nextSubjectLineHeight = blog.subject_line_height ?? 1.5;
        const nextDescriptionFontFamily = (blog.description_font_family ?? 'pre') as FontFamily;
        const nextDescriptionLetterSpacing = blog.description_letter_spacing ?? -0.005;
        const nextDescriptionLineHeight = blog.description_line_height ?? 1.5;
        const nextDescriptionFontSize = blog.description_font_size ?? 16;
        const nextDescriptionMargin = blog.description_margin ?? 16;

        setSubjectFontFamily(nextSubjectFontFamily);
        setSubjectLetterSpacing(nextSubjectLetterSpacing);
        setSubjectLineHeight(nextSubjectLineHeight);
        setDescriptionFontFamily(nextDescriptionFontFamily);
        setDescriptionLetterSpacing(nextDescriptionLetterSpacing);
        setDescriptionLineHeight(nextDescriptionLineHeight);
        setDescriptionFontSize(nextDescriptionFontSize);
        setDescriptionMargin(nextDescriptionMargin);

        if (
          blog.subject_font_family !== null ||
          blog.subject_letter_spacing !== null ||
          blog.subject_line_height !== null
        ) {
          if (
            blog.description_font_family !== null ||
            blog.description_letter_spacing !== null ||
            blog.description_line_height !== null ||
            blog.description_font_size !== null ||
            blog.description_margin !== null
          ) {
            setApplyScope('both');
          } else {
            setApplyScope('subject');
          }
        } else if (
          blog.description_font_family !== null ||
          blog.description_letter_spacing !== null ||
          blog.description_line_height !== null ||
          blog.description_font_size !== null ||
          blog.description_margin !== null
        ) {
          setApplyScope('description');
        } else {
          setApplyScope('subject');
        }
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '기본 서체 설정을 불러오지 못했습니다.');
        } else {
          setErrorMessage('기본 서체 설정을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadFonts();
  }, [siteName]);

  const subjectPayload = useMemo(() => {
    if (applyScope === 'description') {
      return {
        subjectFontFamily: null,
        subjectLetterSpacing: null,
        subjectLineHeight: null,
      };
    }

    return {
      subjectFontFamily: subjectFontFamily || null,
      subjectLetterSpacing: subjectLetterSpacing === '' ? null : subjectLetterSpacing,
      subjectLineHeight: subjectLineHeight === '' ? null : subjectLineHeight,
    };
  }, [applyScope, subjectFontFamily, subjectLetterSpacing, subjectLineHeight]);

  const descriptionPayload = useMemo(() => {
    if (applyScope === 'subject') {
      return {
        descriptionFontFamily: null,
        descriptionLetterSpacing: null,
        descriptionLineHeight: null,
        descriptionFontSize: null,
        descriptionMargin: null,
      };
    }

    return {
      descriptionFontFamily: descriptionFontFamily || null,
      descriptionLetterSpacing: descriptionLetterSpacing === '' ? null : descriptionLetterSpacing,
      descriptionLineHeight: descriptionLineHeight === '' ? null : descriptionLineHeight,
      descriptionFontSize: descriptionFontSize === '' ? null : descriptionFontSize,
      descriptionMargin: descriptionMargin === '' ? null : descriptionMargin,
    };
  }, [
    applyScope,
    descriptionFontFamily,
    descriptionLetterSpacing,
    descriptionLineHeight,
    descriptionFontSize,
    descriptionMargin,
  ]);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch('/api/manage/design/blog/fonts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          applyScope,
          ...subjectPayload,
          ...descriptionPayload,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '기본 서체 설정 저장에 실패했습니다.');
      }

      setSuccessMessage('적용되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '기본 서체 설정 저장에 실패했습니다.');
      } else {
        setErrorMessage('기본 서체 설정 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="블로그 디자인 설정" pageBack={`/${siteName}/manage`} menu="design">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container pageTitle="블로그 디자인 설정" pageBack={`/${siteName}/manage`} menu="design">
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          <Stack gap={3}>
            <div className={`paper ${styles.paper}`}>
              <FormControl>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  적용 범위
                </Typography>
                <RadioGroup
                  row
                  value={applyScope}
                  onChange={(event) => setApplyScope(event.target.value as ApplyScope)}
                >
                  <FormControlLabel value="subject" control={<Radio />} label="제목" />
                  <FormControlLabel value="description" control={<Radio />} label="본문" />
                  <FormControlLabel value="both" control={<Radio />} label="제목+본문" />
                </RadioGroup>
              </FormControl>
            </div>

            {(applyScope === 'subject' || applyScope === 'both') && (
              <div className={`paper ${styles.paper}`}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  제목
                </Typography>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    서체
                  </Typography>
                  <Select
                    size="small"
                    value={subjectFontFamily}
                    onChange={(event) => setSubjectFontFamily(event.target.value as FontFamily | '')}
                  >
                    {SUBJECT_FONT_OPTIONS.map((option) => (
                      <MenuItem key={option.label} value={option.value}>
                        {subjectFontFamily === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    자간
                  </Typography>
                  <Select
                    size="small"
                    value={subjectLetterSpacing}
                    onChange={(event) => setSubjectLetterSpacing(event.target.value as number | '')}
                  >
                    {LETTER_SPACING_OPTIONS.map((option) => (
                      <MenuItem key={option.label} value={option.value}>
                        {subjectLetterSpacing === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    행간
                  </Typography>
                  <Select
                    size="small"
                    value={subjectLineHeight}
                    onChange={(event) => setSubjectLineHeight(event.target.value as number | '')}
                  >
                    {LINE_HEIGHT_OPTIONS.map((option) => (
                      <MenuItem key={option.label} value={option.value}>
                        {subjectLineHeight === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            )}

            {(applyScope === 'description' || applyScope === 'both') && (
              <div className={`paper ${styles.paper}`}>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  본문
                </Typography>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    서체
                  </Typography>
                  <Select
                    size="small"
                    value={descriptionFontFamily}
                    onChange={(event) => setDescriptionFontFamily(event.target.value as FontFamily | '')}
                  >
                    {DESCRIPTION_FONT_OPTIONS.map((option) => (
                      <MenuItem key={option.label} value={option.value}>
                        {descriptionFontFamily === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    크기
                  </Typography>
                  <Select
                    size="small"
                    value={descriptionFontSize}
                    onChange={(event) => setDescriptionFontSize(event.target.value as number | '')}
                  >
                    {FONT_SIZE_OPTIONS.map((option) => (
                      <MenuItem key={option.label} value={option.value}>
                        {descriptionFontSize === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    자간
                  </Typography>
                  <Select
                    size="small"
                    value={descriptionLetterSpacing}
                    onChange={(event) => setDescriptionLetterSpacing(event.target.value as number | '')}
                  >
                    {LETTER_SPACING_OPTIONS.map((option) => (
                      <MenuItem key={option.label} value={option.value}>
                        {descriptionLetterSpacing === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    행간
                  </Typography>
                  <Select
                    size="small"
                    value={descriptionLineHeight}
                    onChange={(event) => setDescriptionLineHeight(event.target.value as number | '')}
                  >
                    {LINE_HEIGHT_OPTIONS.map((option) => (
                      <MenuItem key={option.label} value={option.value}>
                        {descriptionLineHeight === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    마진
                  </Typography>
                  <Select
                    size="small"
                    value={descriptionMargin}
                    onChange={(event) => setDescriptionMargin(event.target.value as number | '')}
                  >
                    {MARGIN_OPTIONS.map((option) => (
                      <MenuItem key={option.label} value={option.value}>
                        {descriptionMargin === option.value ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </div>
            )}

            {isMobile ? (
              <div className={styles['button-top']}>
                <button
                  type="button"
                  className={`button ${styles.button}`}
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                >
                  저장
                </button>
              </div>
            ) : (
              <Stack direction="row" justifyContent="flex-end">
                <button
                  type="button"
                  className="button medium submit"
                  onClick={() => void handleSubmit()}
                  disabled={isSubmitting}
                >
                  적용하기
                </button>
              </Stack>
            )}

            {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}
            <Snackbar
              open={Boolean(successMessage)}
              autoHideDuration={2700}
              anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
              onClose={() => setSuccessMessage('')}
              message={successMessage}
            />
          </Stack>
        </div>
      </div>
    </Container>
  );
}
