'use client';

import { useEffect, useState, type JSX } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { normalizeText } from '@/lib/utils';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

type JoinQuestionRow = {
  id: string;
  type: 'subjective' | 'objective';
  question: string;
  allow_image: boolean;
  options: string[];
};

type JoinResponse = {
  ok?: boolean;
  siteType?: string | null;
  join?: {
    join_notice: string;
    join_question_status: string;
    join_questions: JoinQuestionRow[];
    join_accept_status: string;
    join_accept_start_day: string | null;
    join_accept_end_day: string | null;
    join_type: string;
    policy_post: string;
    policy_comment: string;
  };
  error?: string;
};

function createQuestionId() {
  return `join_question_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptyQuestion(): JoinQuestionRow {
  return {
    id: createQuestionId(),
    type: 'subjective',
    question: '',
    allow_image: false,
    options: [],
  };
}

function normalizeQuestionText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizeNoticeText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .join('\n');
}

function parseDayValue(value: string) {
  if (!value) {
    return null;
  }

  const parts = value.split('-').map(Number);

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDayValue(value: Date | null) {
  if (!value) {
    return '';
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function Opt() {
  const params = useParams();
  const router = useRouter();
  const siteName = normalizeText(params.siteName);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('sm'));

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [joinNotice, setJoinNotice] = useState('');
  const [joinQuestionStatus, setJoinQuestionStatus] = useState<'enabled' | 'disabled'>('disabled');
  const [joinQuestions, setJoinQuestions] = useState<JoinQuestionRow[]>([]);
  const [joinAcceptStatus, setJoinAcceptStatus] = useState<'enabled' | 'disabled' | 'period'>('enabled');
  const [joinAcceptStartDay, setJoinAcceptStartDay] = useState('');
  const [joinAcceptEndDay, setJoinAcceptEndDay] = useState('');
  const [joinType, setJoinType] = useState<'open' | 'invite'>('open');
  const [policyPost, setPolicyPost] = useState<'comment_0' | 'comment_1' | 'comment_3' | 'comment_5'>('comment_1');
  const [policyComment, setPolicyComment] = useState<'estimate_0' | 'estimate_1' | 'estimate_3' | 'estimate_5'>(
    'estimate_0',
  );

  const [errorMessage, setErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  async function loadJoinConditions() {
    const response = await fetch(`/api/manage/join/conditions?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as JoinResponse;

    if (response.status === 400 && result.error === '커뮤니티만 사용할 수 있습니다.') {
      router.replace(`/${siteName}/manage`);
      return;
    }

    if (!response.ok) {
      throw new Error(result.error ?? '가입 정보를 불러오지 못했습니다.');
    }

    if (result.siteType !== 'community') {
      router.replace(`/${siteName}/manage`);
      return;
    }

    if (!result.join) {
      throw new Error('가입 정보를 불러오지 못했습니다.');
    }

    setJoinNotice(result.join.join_notice ?? '');
    setJoinQuestionStatus(result.join.join_question_status === 'enabled' ? 'enabled' : 'disabled');
    setJoinQuestions(Array.isArray(result.join.join_questions) ? result.join.join_questions : []);
    setJoinAcceptStatus(
      result.join.join_accept_status === 'disabled' || result.join.join_accept_status === 'period'
        ? result.join.join_accept_status
        : 'enabled',
    );
    setJoinAcceptStartDay(result.join.join_accept_start_day ?? '');
    setJoinAcceptEndDay(result.join.join_accept_end_day ?? '');
    setJoinType(result.join.join_type === 'invite' ? 'invite' : 'open');
    setPolicyPost(
      result.join.policy_post === 'comment_0' ||
        result.join.policy_post === 'comment_1' ||
        result.join.policy_post === 'comment_3' ||
        result.join.policy_post === 'comment_5'
        ? result.join.policy_post
        : 'comment_1',
    );
    setPolicyComment(
      result.join.policy_comment === 'estimate_0' ||
        result.join.policy_comment === 'estimate_1' ||
        result.join.policy_comment === 'estimate_3' ||
        result.join.policy_comment === 'estimate_5'
        ? result.join.policy_comment
        : 'estimate_0',
    );
  }

  useEffect(() => {
    async function init() {
      try {
        setErrorMessage('');
        await loadJoinConditions();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '가입 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('가입 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, [siteName]);

  function handleJoinNoticeChange(event: InputChangeEvent) {
    setJoinNotice(event.currentTarget.value);
  }

  function handleJoinQuestionStatusChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;
    if (nextValue !== 'enabled' && nextValue !== 'disabled') {
      return;
    }

    setJoinQuestionStatus(nextValue);
  }

  function handleJoinAcceptStatusChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;
    if (nextValue !== 'enabled' && nextValue !== 'disabled' && nextValue !== 'period') {
      return;
    }

    setJoinAcceptStatus(nextValue);
  }

  function handleJoinTypeChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;
    if (nextValue !== 'open' && nextValue !== 'invite') {
      return;
    }

    setJoinType(nextValue);
  }

  function handlePolicyPostChange(event: any) {
    const nextValue = event.target.value;

    if (
      nextValue !== 'comment_0' &&
      nextValue !== 'comment_1' &&
      nextValue !== 'comment_3' &&
      nextValue !== 'comment_5'
    ) {
      return;
    }

    setPolicyPost(nextValue);
  }

  function handlePolicyCommentChange(event: any) {
    const nextValue = event.target.value;

    if (
      nextValue !== 'estimate_0' &&
      nextValue !== 'estimate_1' &&
      nextValue !== 'estimate_3' &&
      nextValue !== 'estimate_5'
    ) {
      return;
    }

    setPolicyComment(nextValue);
  }

  function handleQuestionTypeChange(questionId: string, nextType: 'subjective' | 'objective') {
    setJoinQuestions((previousQuestions) =>
      previousQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              type: nextType,
              options: nextType === 'objective' ? question.options : [],
              allow_image: nextType === 'subjective' ? question.allow_image : false,
            }
          : question,
      ),
    );
  }

  function handleQuestionTextChange(questionId: string, event: TextFieldChangeEvent) {
    const nextValue = event.currentTarget.value;

    setJoinQuestions((previousQuestions) =>
      previousQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              question: nextValue,
            }
          : question,
      ),
    );
  }

  function handleQuestionAllowImageChange(questionId: string, event: InputChangeEvent) {
    const nextChecked = event.currentTarget.checked;

    setJoinQuestions((previousQuestions) =>
      previousQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              allow_image: nextChecked,
            }
          : question,
      ),
    );
  }

  function handleAddQuestion() {
    setJoinQuestions((previousQuestions) => [...previousQuestions, createEmptyQuestion()]);
  }

  function handleDeleteQuestion(questionId: string) {
    setJoinQuestions((previousQuestions) => previousQuestions.filter((question) => question.id !== questionId));
  }

  function handleAddOption(questionId: string) {
    setJoinQuestions((previousQuestions) =>
      previousQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: [...question.options, ''],
            }
          : question,
      ),
    );
  }

  function handleOptionChange(questionId: string, optionIndex: number, event: TextFieldChangeEvent) {
    const nextValue = event.currentTarget.value;

    setJoinQuestions((previousQuestions) =>
      previousQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.map((option, index) => (index === optionIndex ? nextValue : option)),
            }
          : question,
      ),
    );
  }

  function handleDeleteOption(questionId: string, optionIndex: number) {
    setJoinQuestions((previousQuestions) =>
      previousQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              options: question.options.filter((_, index) => index !== optionIndex),
            }
          : question,
      ),
    );
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedQuestions = joinQuestions
      .map((question) => ({
        ...question,
        question: normalizeQuestionText(question.question),
        options: question.options.map((option) => normalizeQuestionText(option)).filter(Boolean),
        allow_image: question.type === 'subjective' ? question.allow_image : false,
      }))
      .filter((question) => question.question);

    if (joinQuestionStatus === 'enabled') {
      if (normalizedQuestions.length === 0) {
        setErrorMessage('가입 질문을 1개 이상 입력해주세요.');
        return;
      }

      const hasInvalidObjectiveQuestion = normalizedQuestions.some(
        (question) => question.type === 'objective' && question.options.length === 0,
      );

      if (hasInvalidObjectiveQuestion) {
        setErrorMessage('객관식 문항의 선택지는 1개 이상 입력해주세요.');
        return;
      }
    }

    if (joinAcceptStatus === 'period') {
      if (!joinAcceptStartDay || !joinAcceptEndDay) {
        setErrorMessage('가입불가 기간을 입력해주세요.');
        return;
      }

      if (joinAcceptStartDay > joinAcceptEndDay) {
        setErrorMessage('종료일은 시작일보다 빠를 수 없습니다.');
        return;
      }
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/manage/join/conditions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          joinNotice: normalizeNoticeText(joinNotice),
          joinQuestionStatus,
          joinQuestions: joinQuestionStatus === 'enabled' ? normalizedQuestions : [],
          joinAcceptStatus,
          joinAcceptStartDay: joinAcceptStatus === 'period' ? joinAcceptStartDay : null,
          joinAcceptEndDay: joinAcceptStatus === 'period' ? joinAcceptEndDay : null,
          joinType,
          policyPost,
          policyComment,
        }),
      });

      const result = (await response.json()) as JoinResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '가입 정보 저장에 실패했습니다.');
      }

      await loadJoinConditions();
      setSnackbarMessage('저장되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '가입 정보 저장에 실패했습니다.');
      } else {
        setErrorMessage('가입 정보 저장에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Stack spacing={2}>
        {isNotMobile ? (
          <Typography variant="h5" component="h1">
            가입 정보 관리
          </Typography>
        ) : null}

        <Stack component="form" spacing={3} onSubmit={handleSubmit}>
          <TextField
            label="가입 안내"
            value={joinNotice}
            onChange={handleJoinNoticeChange}
            fullWidth
            multiline
            minRows={4}
            size="small"
          />

          <Stack spacing={1}>
            <Typography variant="subtitle2">가입 방식</Typography>
            <RadioGroup value={joinType} onChange={handleJoinTypeChange} row>
              <FormControlLabel value="open" control={<Radio />} label="오픈 가입" />
              <FormControlLabel value="invite" control={<Radio />} label="초대가입" />
            </RadioGroup>
          </Stack>

          <TextField
            select
            label="글 작성 정책"
            value={policyPost}
            onChange={handlePolicyPostChange}
            fullWidth
            size="small"
          >
            <MenuItem value="comment_0">가입 후 바로 글쓰기 가능</MenuItem>
            <MenuItem value="comment_1">댓글 1개 등록 후 글쓰기 가능</MenuItem>
            <MenuItem value="comment_3">댓글 3개 등록 후 글쓰기 가능</MenuItem>
            <MenuItem value="comment_5">댓글 5개 등록 후 글쓰기 가능</MenuItem>
          </TextField>

          <TextField
            select
            label="댓글 작성 정책"
            value={policyComment}
            onChange={handlePolicyCommentChange}
            fullWidth
            size="small"
          >
            <MenuItem value="estimate_0">가입 후 바로 댓글쓰기 가능</MenuItem>
            <MenuItem value="estimate_1">가입 6시간 이후 댓글쓰기 가능</MenuItem>
            <MenuItem value="estimate_3">가입 12시간 이후 댓글쓰기 가능</MenuItem>
            <MenuItem value="estimate_5">가입 24시간 이후 댓글쓰기 가능</MenuItem>
          </TextField>

          <Stack spacing={1}>
            <Typography variant="subtitle2">가입 질문</Typography>
            <RadioGroup value={joinQuestionStatus} onChange={handleJoinQuestionStatusChange} row>
              <FormControlLabel value="enabled" control={<Radio />} label="사용함" />
              <FormControlLabel value="disabled" control={<Radio />} label="사용안함" />
            </RadioGroup>
          </Stack>

          {joinQuestionStatus === 'enabled' ? (
            <Stack spacing={2}>
              <Alert severity="warning" variant="outlined">
                답변 데이터 보호를 위해 저장된 가입 질문의 순서 변경은 제한됩니다.
              </Alert>

              <Alert severity="error" variant="outlined">
                문항 순서 변경은 지원하지 않습니다. 필요한 경우 새 문항을 추가하고 기존 문항을 삭제해주세요.
              </Alert>

              {joinQuestions.map((question, questionIndex) => (
                <Paper key={question.id} elevation={3} sx={{ p: 2 }}>
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="subtitle2">질문 {questionIndex + 1}</Typography>
                      <IconButton onClick={() => handleDeleteQuestion(question.id)} size="small">
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Stack>

                    <TextField
                      select
                      label="질문 유형"
                      value={question.type}
                      onChange={(event) =>
                        handleQuestionTypeChange(
                          question.id,
                          event.target.value === 'objective' ? 'objective' : 'subjective',
                        )
                      }
                      fullWidth
                      size="small"
                    >
                      <MenuItem value="subjective">주관식</MenuItem>
                      <MenuItem value="objective">객관식</MenuItem>
                    </TextField>

                    <TextField
                      label="질문 내용"
                      value={question.question}
                      onChange={(event) => handleQuestionTextChange(question.id, event)}
                      fullWidth
                      multiline
                      minRows={2}
                      size="small"
                    />

                    {question.type === 'subjective' ? (
                      <FormControlLabel
                        control={
                          <Switch
                            checked={question.allow_image}
                            onChange={(event) => handleQuestionAllowImageChange(question.id, event)}
                          />
                        }
                        label={question.allow_image ? '이미지로 답변' : '텍스트로 답변'}
                      />
                    ) : null}

                    {question.type === 'objective' ? (
                      <Stack spacing={1.5}>
                        <Typography variant="subtitle2">선택지</Typography>

                        {question.options.map((option, optionIndex) => (
                          <Stack key={`${question.id}-${optionIndex}`} direction="row" spacing={1}>
                            <TextField
                              label={`문항 ${optionIndex + 1}`}
                              value={option}
                              onChange={(event) => handleOptionChange(question.id, optionIndex, event)}
                              fullWidth
                              size="small"
                            />
                            <Button
                              type="button"
                              variant="outlined"
                              color="error"
                              onClick={() => handleDeleteOption(question.id, optionIndex)}
                            >
                              삭제
                            </Button>
                          </Stack>
                        ))}

                        <Box>
                          <Button type="button" variant="outlined" onClick={() => handleAddOption(question.id)}>
                            문항 추가
                          </Button>
                        </Box>
                      </Stack>
                    ) : null}
                  </Stack>
                </Paper>
              ))}

              <Box>
                <Button type="button" variant="outlined" onClick={handleAddQuestion}>
                  질문 추가
                </Button>
              </Box>
            </Stack>
          ) : null}

          <Stack spacing={1}>
            <Typography variant="subtitle2">가입 신청</Typography>
            <RadioGroup value={joinAcceptStatus} onChange={handleJoinAcceptStatusChange} row>
              <FormControlLabel value="enabled" control={<Radio />} label="항상 받음" />
              <FormControlLabel value="disabled" control={<Radio />} label="받지 않음" />
              <FormControlLabel value="period" control={<Radio />} label="가입불가 기간설정" />
            </RadioGroup>
          </Stack>

          {joinAcceptStatus === 'period' ? (
            <Stack direction={isNotMobile ? 'row' : 'column'} spacing={2}>
              <DatePicker
                label="시작일"
                value={parseDayValue(joinAcceptStartDay)}
                onChange={(value) => setJoinAcceptStartDay(formatDayValue(value))}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                  },
                }}
              />
              <DatePicker
                label="종료일"
                value={parseDayValue(joinAcceptEndDay)}
                onChange={(value) => setJoinAcceptEndDay(formatDayValue(value))}
                slotProps={{
                  textField: {
                    fullWidth: true,
                    size: 'small',
                  },
                }}
              />
            </Stack>
          ) : null}

          <Stack direction="row" justifyContent="flex-end" spacing={1.5}>
            <Button type="button" variant="outlined" onClick={() => router.push(`/${siteName}/manage`)}>
              취소
            </Button>
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
    </LocalizationProvider>
  );
}
