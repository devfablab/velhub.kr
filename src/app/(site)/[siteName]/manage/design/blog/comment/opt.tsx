'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  FormControl,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  TextField,
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

type CommentProvider = 'none' | 'giscus' | 'disqus' | 'velhub';
type GiscusInputPosition = 'top' | 'bottom';
type GiscusFlag = '0' | '1';

type GiscusSettings = {
  repo: string;
  repoId: string;
  strict: GiscusFlag;
  reactionsEnabled: GiscusFlag;
  emitMetadata: GiscusFlag;
  inputPosition: GiscusInputPosition;
};

type BlogCommentRow = {
  commentProvider: CommentProvider;
  giscusSettings: GiscusSettings;
};

type BlogCommentResponse = {
  ok?: boolean;
  blog?: BlogCommentRow;
  error?: string;
};

const COMMENT_PROVIDER_OPTIONS: Array<{ label: string; value: CommentProvider; description: string }> = [
  {
    label: '댓글 사용 안함',
    value: 'none',
    description: '블로그 글에서 댓글 영역을 사용하지 않습니다.',
  },
  {
    label: '데브허브 댓글',
    value: 'velhub',
    description: '데브허브 유저만 댓글을 작성할 수 있습니다.',
  },
  {
    label: 'Disqus',
    value: 'disqus',
    description: 'Disqus 댓글을 사용합니다.',
  },
  {
    label: 'Giscus',
    value: 'giscus',
    description: 'GitHub Discussions 기반 댓글을 사용합니다.',
  },
];

function isCommentProvider(value: string): value is CommentProvider {
  return value === 'none' || value === 'giscus' || value === 'disqus' || value === 'velhub';
}

function isGiscusFlag(value: string): value is GiscusFlag {
  return value === '0' || value === '1';
}

function isGiscusInputPosition(value: string): value is GiscusInputPosition {
  return value === 'top' || value === 'bottom';
}

const DEFAULT_GISCUS_SETTINGS: GiscusSettings = {
  repo: '',
  repoId: '',
  strict: '0',
  reactionsEnabled: '0',
  emitMetadata: '0',
  inputPosition: 'bottom',
};

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName);

  const [commentProvider, setCommentProvider] = useState<CommentProvider>('none');
  const [giscusSettings, setGiscusSettings] = useState<GiscusSettings>(DEFAULT_GISCUS_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const isSubmitDisabled = useMemo(() => {
    if (isSubmitting) {
      return true;
    }

    if (commentProvider !== 'giscus') {
      return false;
    }

    return !giscusSettings.repo.trim() || !giscusSettings.repoId.trim() || !giscusSettings.inputPosition;
  }, [commentProvider, giscusSettings, isSubmitting]);

  useEffect(() => {
    async function loadComments() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/manage/design/blog/comments?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as BlogCommentResponse;

        if (!response.ok || !result.blog) {
          throw new Error(result.error ?? '댓글 설정을 불러오지 못했습니다.');
        }

        setCommentProvider(result.blog.commentProvider);
        setGiscusSettings(result.blog.giscusSettings);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '댓글 설정을 불러오지 못했습니다.');
        } else {
          setErrorMessage('댓글 설정을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadComments();
  }, [siteName]);

  function handleChangeGiscusTextField(key: 'repo' | 'repoId', value: string) {
    setGiscusSettings((previousValue) => ({
      ...previousValue,
      [key]: value,
    }));
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleChangeGiscusFlag(key: 'strict' | 'reactionsEnabled' | 'emitMetadata', value: string) {
    if (!isGiscusFlag(value)) {
      return;
    }

    setGiscusSettings((previousValue) => ({
      ...previousValue,
      [key]: value,
    }));
    setErrorMessage('');
    setSuccessMessage('');
  }

  function handleChangeGiscusInputPosition(value: string) {
    if (!isGiscusInputPosition(value)) {
      return;
    }

    setGiscusSettings((previousValue) => ({
      ...previousValue,
      inputPosition: value,
    }));
    setErrorMessage('');
    setSuccessMessage('');
  }

  async function handleSubmit() {
    if (isSubmitDisabled) {
      return;
    }

    try {
      setErrorMessage('');
      setSuccessMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/manage/design/blog/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          commentProvider,
          giscusSettings: {
            repo: giscusSettings.repo.trim(),
            repoId: giscusSettings.repoId.trim(),
            strict: giscusSettings.strict || '0',
            reactionsEnabled: giscusSettings.reactionsEnabled || '0',
            emitMetadata: giscusSettings.emitMetadata || '0',
            inputPosition: giscusSettings.inputPosition,
          },
        }),
      });

      const result = (await response.json()) as BlogCommentResponse;

      if (!response.ok || !result.blog) {
        throw new Error(result.error ?? '댓글 설정 저장에 실패했습니다.');
      }

      setCommentProvider(result.blog.commentProvider);
      setGiscusSettings(result.blog.giscusSettings);
      setSuccessMessage('적용되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '댓글 설정 저장에 실패했습니다.');
      } else {
        setErrorMessage('댓글 설정 저장에 실패했습니다.');
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
          <div className={`paper ${styles.paper}`}>
            <FormControl>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                댓글 방식
              </Typography>

              <RadioGroup
                className={styles['radio-group']}
                value={commentProvider}
                onChange={(event) => {
                  const nextValue = event.target.value;

                  if (!isCommentProvider(nextValue)) {
                    return;
                  }

                  setCommentProvider(nextValue);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
              >
                {COMMENT_PROVIDER_OPTIONS.map((option) => (
                  <FormControlLabel
                    key={option.value}
                    value={option.value}
                    control={<Radio />}
                    label={
                      <Stack>
                        <Typography variant="body1">{option.label}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {option.description}
                        </Typography>
                      </Stack>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>

            {commentProvider === 'giscus' ? (
              <div className={`paper ${styles['paper-sub']}`} style={{ marginTop: 12 }}>
                <Stack gap={2}>
                  <Typography variant="subtitle1">Giscus 설정</Typography>
                  <Stack>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      repo
                    </Typography>
                    <TextField
                      value={giscusSettings.repo}
                      onChange={(event) => handleChangeGiscusTextField('repo', event.target.value)}
                      fullWidth
                      size="small"
                      required
                    />
                  </Stack>
                  <Stack>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      repoId
                    </Typography>
                    <TextField
                      value={giscusSettings.repoId}
                      onChange={(event) => handleChangeGiscusTextField('repoId', event.target.value)}
                      fullWidth
                      size="small"
                      required
                    />
                  </Stack>

                  <Stack>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      inputPosition
                    </Typography>
                    <TextField
                      select
                      value={giscusSettings.inputPosition}
                      onChange={(event) => handleChangeGiscusInputPosition(event.target.value)}
                      fullWidth
                      size="small"
                      required
                    >
                      <MenuItem value="top">
                        {giscusSettings.inputPosition === 'top' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        top
                      </MenuItem>
                      <MenuItem value="bottom">
                        {giscusSettings.inputPosition === 'bottom' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        bottom
                      </MenuItem>
                    </TextField>
                  </Stack>

                  <Stack>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      strict
                    </Typography>
                    <TextField
                      select
                      value={giscusSettings.strict}
                      onChange={(event) => handleChangeGiscusFlag('strict', event.target.value)}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="0">
                        {giscusSettings.strict === '0' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        0
                      </MenuItem>
                      <MenuItem value="1">
                        {giscusSettings.strict === '1' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        1
                      </MenuItem>
                    </TextField>
                  </Stack>

                  <Stack>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      reactionsEnabled
                    </Typography>
                    <TextField
                      select
                      value={giscusSettings.reactionsEnabled}
                      onChange={(event) => handleChangeGiscusFlag('reactionsEnabled', event.target.value)}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="0">
                        {giscusSettings.reactionsEnabled === '0' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        0
                      </MenuItem>
                      <MenuItem value="1">
                        {giscusSettings.reactionsEnabled === '1' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        1
                      </MenuItem>
                    </TextField>
                  </Stack>

                  <Stack>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      emitMetadata
                    </Typography>
                    <TextField
                      select
                      value={giscusSettings.emitMetadata}
                      onChange={(event) => handleChangeGiscusFlag('emitMetadata', event.target.value)}
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="0">
                        {giscusSettings.emitMetadata === '0' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        0
                      </MenuItem>
                      <MenuItem value="1">
                        {giscusSettings.emitMetadata === '1' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        1
                      </MenuItem>
                    </TextField>
                  </Stack>
                </Stack>
              </div>
            ) : null}
          </div>

          {isMobile ? (
            <div className={styles['button-top']}>
              <button
                type="button"
                className={`button ${styles.button}`}
                onClick={() => void handleSubmit()}
                disabled={isSubmitDisabled}
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
                disabled={isSubmitDisabled}
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
        </div>
      </div>
    </Container>
  );
}
