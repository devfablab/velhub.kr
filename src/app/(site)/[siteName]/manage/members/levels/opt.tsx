'use client';

import { useEffect, useRef, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { normalizeText } from '@/lib/utils';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type RequirementType = 'manual' | 'automatic';

type LevelRow = {
  id: string;
  lv: number;
  icon: string | null;
  icon_url: string;
  name: string | null;
  description: string | null;
  requirement_type: RequirementType;
  required_posts: number;
  required_comments: number;
  required_checkins: number;
  required_days: number;
  required_likes: number;
};

type LevelResponse = {
  ok?: boolean;
  enabled?: boolean;
  levels?: LevelRow[];
  error?: string;
};

type IconResponse = {
  ok?: boolean;
  levelId?: string;
  icon?: string;
  iconUrl?: string;
  error?: string;
};

const requirementTypeOptions: Array<{ value: RequirementType; label: string }> = [
  { value: 'manual', label: '설정안함' },
  { value: 'automatic', label: '자동등업' },
];

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [enabled, setEnabled] = useState(false);
  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnabling, setIsEnabling] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isIconDialogOpen, setIsIconDialogOpen] = useState(false);
  const [targetLevelId, setTargetLevelId] = useState('');
  const [isUploadingIcon, setIsUploadingIcon] = useState(false);
  const [deletingIconLevelId, setDeletingIconLevelId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  async function loadLevels() {
    const response = await fetch(`/api/manage/members/levels?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as LevelResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '등급 정보를 불러오지 못했습니다.');
    }

    setEnabled(Boolean(result.enabled));
    setLevels(Array.isArray(result.levels) ? result.levels : []);
  }

  useEffect(() => {
    async function init() {
      try {
        setErrorMessage('');
        await loadLevels();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '등급 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('등급 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, [siteName]);

  function handleOpenIconDialog() {
    setIsIconDialogOpen(true);
  }

  function handleCloseIconDialog() {
    if (isUploadingIcon || Boolean(deletingIconLevelId)) {
      return;
    }

    setIsIconDialogOpen(false);
    setTargetLevelId('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleNameChange(levelId: string, event: TextFieldChangeEvent) {
    const nextValue = event.currentTarget.value;

    setLevels((previousLevels) =>
      previousLevels.map((level) =>
        level.id === levelId
          ? {
              ...level,
              name: nextValue,
            }
          : level,
      ),
    );
  }

  function handleDescriptionChange(levelId: string, event: TextFieldChangeEvent) {
    const nextValue = event.currentTarget.value;

    setLevels((previousLevels) =>
      previousLevels.map((level) =>
        level.id === levelId
          ? {
              ...level,
              description: nextValue,
            }
          : level,
      ),
    );
  }

  function handleRequirementTypeChange(levelId: string, value: RequirementType) {
    setLevels((previousLevels) =>
      previousLevels.map((level) =>
        level.id === levelId
          ? {
              ...level,
              requirement_type: value,
            }
          : level,
      ),
    );
  }

  function handleNumericChange(
    levelId: string,
    field: 'required_posts' | 'required_comments' | 'required_checkins' | 'required_days' | 'required_likes',
    event: TextFieldChangeEvent,
  ) {
    const nextValue = Number(event.currentTarget.value);

    setLevels((previousLevels) =>
      previousLevels.map((level) =>
        level.id === levelId
          ? {
              ...level,
              [field]: Number.isFinite(nextValue) && nextValue >= 0 ? Math.floor(nextValue) : 0,
            }
          : level,
      ),
    );
  }

  function handleClearLevel(levelId: string) {
    setLevels((previousLevels) =>
      previousLevels.map((level) =>
        level.id === levelId
          ? {
              ...level,
              icon: null,
              icon_url: '',
              name: null,
              description: null,
              requirement_type: 'manual',
              required_posts: 0,
              required_comments: 0,
              required_checkins: 0,
              required_days: 0,
              required_likes: 0,
            }
          : level,
      ),
    );
  }

  async function handleEnableLevels() {
    if (isEnabling) {
      return;
    }

    try {
      setErrorMessage('');
      setIsEnabling(true);

      const response = await fetch('/api/manage/members/levels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'enable',
          siteName,
        }),
      });

      const result = (await response.json()) as LevelResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '등업 시스템 생성에 실패했습니다.');
      }

      setEnabled(Boolean(result.enabled));
      setLevels(Array.isArray(result.levels) ? result.levels : []);
      setSnackbarMessage('등업 시스템이 생성되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '등업 시스템 생성에 실패했습니다.');
      } else {
        setErrorMessage('등업 시스템 생성에 실패했습니다.');
      }
    } finally {
      setIsEnabling(false);
    }
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/manage/members/levels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'save',
          siteName,
          levels: levels.map((level) => ({
            id: level.id,
            lv: level.lv,
            icon: level.icon,
            name: level.name,
            description: level.description,
            requirement_type: level.lv === 1 ? 'manual' : level.requirement_type,
            required_posts: level.lv === 1 ? 0 : level.required_posts,
            required_comments: level.lv === 1 ? 0 : level.required_comments,
            required_checkins: level.lv === 1 ? 0 : level.required_checkins,
            required_days: level.lv === 1 ? 0 : level.required_days,
            required_likes: level.lv === 1 ? 0 : level.required_likes,
          })),
        }),
      });

      const result = (await response.json()) as LevelResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '등급 저장에 실패했습니다.');
      }

      setEnabled(Boolean(result.enabled));
      setLevels(Array.isArray(result.levels) ? result.levels : []);
      setSnackbarMessage('저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '등급 저장에 실패했습니다.');
      } else {
        setErrorMessage('등급 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleClickIconUpload(levelId: string) {
    if (isUploadingIcon) {
      return;
    }

    setTargetLevelId(levelId);
    fileInputRef.current?.click();
  }

  async function handleIconFileChange(event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || !targetLevelId || isUploadingIcon) {
      inputElement.value = '';
      return;
    }

    try {
      setErrorMessage('');
      setIsUploadingIcon(true);

      const formData = new FormData();
      formData.append('siteName', siteName);
      formData.append('levelId', targetLevelId);
      formData.append('file', selectedFile);

      const response = await fetch('/api/manage/members/levels', {
        method: 'PUT',
        credentials: 'include',
        body: formData,
      });

      const result = (await response.json()) as IconResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '아이콘 업로드에 실패했습니다.');
      }

      setLevels((previousLevels) =>
        previousLevels.map((level) =>
          level.id === result.levelId
            ? {
                ...level,
                icon: result.icon ?? null,
                icon_url: result.iconUrl ?? '',
              }
            : level,
        ),
      );

      setSnackbarMessage('아이콘이 저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '아이콘 업로드에 실패했습니다.');
      } else {
        setErrorMessage('아이콘 업로드에 실패했습니다.');
      }
    } finally {
      setIsUploadingIcon(false);
      setTargetLevelId('');
      inputElement.value = '';
    }
  }

  async function handleDeleteIcon(levelId: string) {
    if (deletingIconLevelId) {
      return;
    }

    try {
      setErrorMessage('');
      setDeletingIconLevelId(levelId);

      const response = await fetch('/api/manage/members/levels', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          action: 'delete-icon',
          siteName,
          levelId,
        }),
      });

      const result = (await response.json()) as IconResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '아이콘 삭제에 실패했습니다.');
      }

      setLevels((previousLevels) =>
        previousLevels.map((level) =>
          level.id === levelId
            ? {
                ...level,
                icon: null,
                icon_url: '',
              }
            : level,
        ),
      );

      setSnackbarMessage('아이콘이 삭제되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '아이콘 삭제에 실패했습니다.');
      } else {
        setErrorMessage('아이콘 삭제에 실패했습니다.');
      }
    } finally {
      setDeletingIconLevelId('');
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Container pageTitle="멤버 등급 관리" menu="members">
      <div className="container">
        <div className={`content ${styles.content} ${styles['content-manage']}`}>
          {errorMessage ? (
            <Alert severity="error" variant="filled">
              {errorMessage}
            </Alert>
          ) : null}

          {!enabled ? (
            <Paper variant="outlined">
              <Stack spacing={2}>
                <Typography variant="h6" component="h2">
                  등업 시스템을 사용하시겠어요?
                </Typography>

                <Box>
                  <Button type="button" variant="contained" onClick={handleEnableLevels} disabled={isEnabling}>
                    등업 시스템 사용하기
                  </Button>
                </Box>
              </Stack>
            </Paper>
          ) : (
            <>
              <Stack direction="row" justifyContent="flex-end">
                <Button type="button" variant="outlined" onClick={handleOpenIconDialog}>
                  아이콘 변경
                </Button>
              </Stack>

              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  {levels.map((level) => (
                    <Stack key={level.id} direction="row" spacing={1.5}>
                      <Box sx={{ pt: 1 }}>
                        {level.icon_url ? (
                          <Box
                            component="img"
                            src={level.icon_url}
                            alt={`lv${level.lv}`}
                            sx={{
                              width: 25,
                              height: 25,
                              objectFit: 'contain',
                              display: 'block',
                            }}
                          />
                        ) : (
                          <Typography variant="body2">lv.{level.lv}</Typography>
                        )}
                      </Box>

                      <Stack spacing={1.5} sx={{ flex: 1 }}>
                        <Stack direction="row" spacing={1.5}>
                          <TextField
                            value={level.name ?? ''}
                            onChange={(event) => handleNameChange(level.id, event)}
                            sx={{ width: 270 }}
                            size="small"
                            placeholder="등급명"
                          />
                          <TextField
                            value={level.description ?? ''}
                            onChange={(event) => handleDescriptionChange(level.id, event)}
                            fullWidth
                            size="small"
                            placeholder="설명"
                          />
                          <Select
                            value={level.lv === 1 ? 'manual' : level.requirement_type}
                            onChange={(event) =>
                              handleRequirementTypeChange(
                                level.id,
                                event.target.value === 'automatic' ? 'automatic' : 'manual',
                              )
                            }
                            size="small"
                            sx={{ minWidth: 120 }}
                            disabled={level.lv === 1}
                          >
                            {requirementTypeOptions.map((option) => (
                              <MenuItem key={option.value} value={option.value}>
                                {option.label}
                              </MenuItem>
                            ))}
                          </Select>
                          <Button
                            type="button"
                            variant="outlined"
                            color="error"
                            onClick={() => handleClearLevel(level.id)}
                          >
                            삭제
                          </Button>
                        </Stack>

                        {level.lv !== 1 && level.requirement_type === 'automatic' ? (
                          <Stack
                            direction={isNotMobile ? 'row' : 'column'}
                            spacing={1}
                            alignItems={isNotMobile ? 'center' : 'flex-start'}
                          >
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2">게시글</Typography>
                              <TextField
                                type="text"
                                inputMode="numeric"
                                value={level.required_posts}
                                onChange={(event) => handleNumericChange(level.id, 'required_posts', event)}
                                size="small"
                                sx={{ width: 60 }}
                              />
                              <Typography variant="body2">개,</Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2">댓글</Typography>
                              <TextField
                                type="text"
                                inputMode="numeric"
                                value={level.required_comments}
                                onChange={(event) => handleNumericChange(level.id, 'required_comments', event)}
                                size="small"
                                sx={{ width: 60 }}
                              />
                              <Typography variant="body2">개,</Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2">방문</Typography>
                              <TextField
                                type="text"
                                inputMode="numeric"
                                value={level.required_checkins}
                                onChange={(event) => handleNumericChange(level.id, 'required_checkins', event)}
                                size="small"
                                sx={{ width: 60 }}
                              />
                              <Typography variant="body2">회,</Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2">좋아요</Typography>
                              <TextField
                                type="text"
                                inputMode="numeric"
                                value={level.required_likes}
                                onChange={(event) => handleNumericChange(level.id, 'required_likes', event)}
                                size="small"
                                sx={{ width: 60 }}
                              />
                              <Typography variant="body2">회,</Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="body2">가입</Typography>
                              <TextField
                                type="text"
                                inputMode="numeric"
                                value={level.required_days}
                                onChange={(event) => handleNumericChange(level.id, 'required_days', event)}
                                size="small"
                                sx={{ width: 60 }}
                              />
                              <Typography variant="body2">일 후 만족 시 자동등업</Typography>
                            </Stack>
                          </Stack>
                        ) : null}
                      </Stack>
                    </Stack>
                  ))}

                  <Stack direction="row" justifyContent="flex-end">
                    <Button type="submit" variant="contained" disabled={isSubmitting}>
                      저장
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </>
          )}

          <Dialog open={isIconDialogOpen} onClose={handleCloseIconDialog} fullWidth maxWidth="sm">
            <DialogTitle>아이콘 변경</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Paper variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {levels.map((level) => (
                    <Stack
                      key={level.id}
                      direction="row"
                      spacing={2}
                      alignItems="center"
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="subtitle2">lv {level.lv}</Typography>

                        <Box
                          sx={{
                            width: 25,
                            height: 25,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {level.icon_url ? (
                            <Box
                              component="img"
                              src={level.icon_url}
                              alt={`lv-${level.lv}`}
                              sx={{
                                width: 25,
                                height: 25,
                                objectFit: 'contain',
                                display: 'block',
                              }}
                            />
                          ) : (
                            <Typography variant="body2">{level.lv}</Typography>
                          )}
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={1}>
                        <Button
                          type="button"
                          variant="outlined"
                          onClick={() => handleClickIconUpload(level.id)}
                          disabled={isUploadingIcon}
                        >
                          아이콘 변경
                        </Button>

                        {level.icon ? (
                          <Button
                            type="button"
                            variant="outlined"
                            color="error"
                            onClick={() => handleDeleteIcon(level.id)}
                            disabled={deletingIconLevelId === level.id}
                          >
                            삭제
                          </Button>
                        ) : null}
                      </Stack>
                    </Stack>
                  ))}
                </Paper>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml"
                  style={{ display: 'none' }}
                  onChange={handleIconFileChange}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                type="button"
                onClick={handleCloseIconDialog}
                disabled={isUploadingIcon || Boolean(deletingIconLevelId)}
              >
                닫기
              </Button>
            </DialogActions>
          </Dialog>

          <Snackbar
            open={Boolean(snackbarMessage)}
            autoHideDuration={2500}
            onClose={() => setSnackbarMessage('')}
            message={snackbarMessage}
          />
        </div>
      </div>
    </Container>
  );
}
