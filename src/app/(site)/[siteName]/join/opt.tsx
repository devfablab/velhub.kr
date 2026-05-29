'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  InputAdornment,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];
type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
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
  siteName?: string;
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
    rejected_at?: string | null;
  };
  error?: string;
};

type NicknameCheckResponse = {
  ok?: boolean;
  isAvailable?: boolean;
  error?: string;
};

type AnswerRow = {
  question_id: string;
  answer_text: string;
  selected_option: string;
  answer_image: string;
  answer_image_url: string;
};

type Props = {
  siteName: string;
};

export default function Opt({ siteName }: Props) {
  const router = useRouter();

  const [nickname, setNickname] = useState('');
  const [joinNotice, setJoinNotice] = useState('');
  const [joinQuestionStatus, setJoinQuestionStatus] = useState('');
  const [joinQuestions, setJoinQuestions] = useState<JoinQuestionRow[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({});
  const [isRejectedHistory, setIsRejectedHistory] = useState(false);
  const [nicknameErrorMessage, setNicknameErrorMessage] = useState('');
  const [nicknameSuccessMessage, setNicknameSuccessMessage] = useState('');
  const [isNicknameChecked, setIsNicknameChecked] = useState(false);
  const [checkedNickname, setCheckedNickname] = useState('');
  const [isCheckingNickname, setIsCheckingNickname] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingQuestionId, setUploadingQuestionId] = useState('');

  useEffect(() => {
    async function loadJoinInfo() {
      try {
        setErrorMessage('');

        const response = await fetch(`/api/manage/join/conditions?siteName=${siteName}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = (await response.json()) as JoinResponse;

        if (!response.ok) {
          throw new Error(result.error ?? '가입 정보를 불러오지 못했습니다.');
        }

        const join = result.join;

        if (!join) {
          throw new Error('가입 정보를 불러오지 못했습니다.');
        }

        setJoinNotice(join.join_notice ?? '');
        setJoinQuestionStatus(join.join_question_status);
        setJoinQuestions(
          join.join_question_status === 'enabled' && Array.isArray(join.join_questions) ? join.join_questions : [],
        );
        setAnswers(
          (join.join_question_status === 'enabled' ? join.join_questions : []).reduce<Record<string, AnswerRow>>(
            (accumulator, question) => {
              accumulator[question.id] = {
                question_id: question.id,
                answer_text: '',
                selected_option: '',
                answer_image: '',
                answer_image_url: '',
              };
              return accumulator;
            },
            {},
          ),
        );
        setIsRejectedHistory(Boolean(join.rejected_at));
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

    void loadJoinInfo();
  }, [siteName]);

  function handleNicknameChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    setNickname(nextValue);
    setIsNicknameChecked(false);
    setCheckedNickname('');
    setNicknameErrorMessage('');
    setNicknameSuccessMessage('');
    setErrorMessage('');
  }

  async function handleCheckNickname() {
    const trimmedNickname = nickname.trim();

    if (!trimmedNickname) {
      setNicknameErrorMessage('닉네임을 입력해주세요.');
      setNicknameSuccessMessage('');
      setIsNicknameChecked(false);
      setCheckedNickname('');
      return;
    }

    try {
      setIsCheckingNickname(true);
      setNicknameErrorMessage('');
      setNicknameSuccessMessage('');

      const response = await fetch(
        `/api/manage/join/approved/check-nickname?siteName=${siteName}&nickname=${encodeURIComponent(trimmedNickname)}`,
        {
          method: 'GET',
          credentials: 'include',
        },
      );

      const result = (await response.json()) as NicknameCheckResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '닉네임을 확인하지 못했습니다.');
      }

      if (result.isAvailable === false) {
        setNicknameErrorMessage('이미 사용 중인 닉네임입니다.');
        setNicknameSuccessMessage('');
        setIsNicknameChecked(false);
        setCheckedNickname('');
        return;
      }

      setNicknameSuccessMessage('사용 가능한 닉네임입니다.');
      setNicknameErrorMessage('');
      setIsNicknameChecked(true);
      setCheckedNickname(trimmedNickname);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setNicknameErrorMessage(unknownError.message || '닉네임을 확인하지 못했습니다.');
      } else {
        setNicknameErrorMessage('닉네임을 확인하지 못했습니다.');
      }
      setNicknameSuccessMessage('');
      setIsNicknameChecked(false);
      setCheckedNickname('');
    } finally {
      setIsCheckingNickname(false);
    }
  }

  function handleAnswerTextChange(questionId: string, event: TextFieldChangeEvent) {
    const nextValue = event.currentTarget.value;

    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [questionId]: {
        ...previousAnswers[questionId],
        answer_text: nextValue,
      },
    }));
    setErrorMessage('');
  }

  function handleAnswerOptionChange(questionId: string, event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    setAnswers((previousAnswers) => ({
      ...previousAnswers,
      [questionId]: {
        ...previousAnswers[questionId],
        selected_option: nextValue,
      },
    }));
    setErrorMessage('');
  }

  async function handleAnswerImageChange(questionId: string, event: InputChangeEvent) {
    const inputElement = event.currentTarget;
    const selectedFile = inputElement.files?.[0];

    if (!selectedFile || uploadingQuestionId) {
      inputElement.value = '';
      return;
    }

    try {
      setErrorMessage('');
      setUploadingQuestionId(questionId);

      const previousAnswerImage = answers[questionId]?.answer_image ?? '';

      if (previousAnswerImage) {
        await fetch('/api/attachment/delete/community-answer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            path: previousAnswerImage,
          }),
        });
      }

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/attachment/add/community-answer', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '이미지 업로드에 실패했습니다.');
      }

      if (!result.answerImage || !result.url) {
        throw new Error('이미지 업로드에 실패했습니다.');
      }

      setAnswers((previousAnswers) => ({
        ...previousAnswers,
        [questionId]: {
          ...previousAnswers[questionId],
          answer_image: result.answerImage,
          answer_image_url: result.url,
        },
      }));
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '이미지 업로드에 실패했습니다.');
      } else {
        setErrorMessage('이미지 업로드에 실패했습니다.');
      }
    } finally {
      setUploadingQuestionId('');
      inputElement.value = '';
    }
  }

  async function handleDeleteAnswerImage(questionId: string) {
    const targetImagePath = answers[questionId]?.answer_image ?? '';

    if (!targetImagePath || uploadingQuestionId) {
      return;
    }

    try {
      setErrorMessage('');
      setUploadingQuestionId(questionId);

      const response = await fetch('/api/attachment/delete/community-answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          path: targetImagePath,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '이미지 삭제에 실패했습니다.');
      }

      setAnswers((previousAnswers) => ({
        ...previousAnswers,
        [questionId]: {
          ...previousAnswers[questionId],
          answer_image: '',
          answer_image_url: '',
        },
      }));
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '이미지 삭제에 실패했습니다.');
      } else {
        setErrorMessage('이미지 삭제에 실패했습니다.');
      }
    } finally {
      setUploadingQuestionId('');
    }
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting || uploadingQuestionId || isCheckingNickname) {
      return;
    }

    const trimmedNickname = nickname.trim();

    if (trimmedNickname) {
      if (!isNicknameChecked || checkedNickname !== trimmedNickname) {
        setErrorMessage('닉네임 중복 확인을 해주세요.');
        return;
      }

      if (nicknameErrorMessage) {
        setErrorMessage('닉네임을 확인해주세요.');
        return;
      }
    }

    const normalizedAnsweredQuestions = joinQuestions.map((question) => {
      const answer = answers[question.id] ?? {
        question_id: question.id,
        answer_text: '',
        selected_option: '',
        answer_image: '',
        answer_image_url: '',
      };

      return {
        question_id: question.id,
        type: question.type,
        question: question.question,
        answer_text: question.type === 'subjective' && !question.allow_image ? answer.answer_text.trim() : null,
        selected_option: question.type === 'objective' ? answer.selected_option.trim() : null,
        answer_image: question.type === 'subjective' && question.allow_image ? answer.answer_image.trim() : null,
      };
    });

    const hasEmptySubjectiveText = normalizedAnsweredQuestions.some(
      (answer) => answer.type === 'subjective' && answer.answer_image === null && !answer.answer_text,
    );

    if (hasEmptySubjectiveText) {
      setErrorMessage('주관식 답변을 입력해주세요.');
      return;
    }

    const hasEmptyObjective = normalizedAnsweredQuestions.some(
      (answer) => answer.type === 'objective' && !answer.selected_option,
    );

    if (hasEmptyObjective) {
      setErrorMessage('객관식 답변을 선택해주세요.');
      return;
    }

    const hasEmptySubjectiveImage = normalizedAnsweredQuestions.some(
      (answer) => answer.type === 'subjective' && answer.answer_text === null && !answer.answer_image,
    );

    if (hasEmptySubjectiveImage) {
      setErrorMessage('이미지 답변을 업로드해주세요.');
      return;
    }

    try {
      setErrorMessage('');
      setIsSubmitting(true);

      const response = await fetch('/api/manage/members/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          siteName,
          nickname,
          answeredQuestions: normalizedAnsweredQuestions,
        }),
      });

      const result = (await response.json()) as JoinResponse;

      if (!response.ok) {
        throw new Error(result.error ?? '가입에 실패했습니다.');
      }

      router.replace(`/${siteName}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '가입에 실패했습니다.');
      } else {
        setErrorMessage('가입에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Stack component="form" gap={2.5} onSubmit={handleSubmit}>
      {joinNotice ? (
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {joinNotice}
          </Typography>
        </Paper>
      ) : null}

      {isRejectedHistory ? (
        <Alert variant="filled" severity="warning">
          가입 반려 이력이 있는 사용자입니다.
        </Alert>
      ) : null}

      <Alert variant="outlined" severity="info">
        닉네임은 선택입니다. 입력하지 않으면 기본 활동명이 자동으로 사용됩니다.
      </Alert>

      <TextField
        label="닉네임"
        value={nickname}
        onChange={handleNicknameChange}
        fullWidth
        size="medium"
        error={Boolean(nicknameErrorMessage)}
        helperText={nicknameErrorMessage || nicknameSuccessMessage || ' '}
        slotProps={{
          input: {
            endAdornment: (
              <InputAdornment position="end">
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleCheckNickname}
                  disabled={!nickname.trim() || isCheckingNickname}
                  size="small"
                >
                  중복 확인
                </Button>
              </InputAdornment>
            ),
          },
        }}
      />

      {joinQuestionStatus === 'enabled' ? (
        <Stack gap={2}>
          <Alert variant="outlined" severity="warning">
            다음 지문에 답해 주세요. (필수입력)
          </Alert>
          {joinQuestions.map((question, index) => (
            <Stack key={question.id} gap={1.5}>
              <Typography variant="subtitle2">{`질문 ${index + 1}`}</Typography>
              <Typography variant="body2">{question.question}</Typography>

              {question.type === 'objective' ? (
                <RadioGroup
                  value={answers[question.id]?.selected_option ?? ''}
                  onChange={(event) => handleAnswerOptionChange(question.id, event)}
                >
                  {question.options.map((option, optionIndex) => (
                    <FormControlLabel
                      key={`${question.id}-${optionIndex}`}
                      value={option}
                      control={<Radio />}
                      label={option}
                    />
                  ))}
                </RadioGroup>
              ) : null}

              {question.type === 'subjective' && !question.allow_image ? (
                <TextField
                  label="답변"
                  value={answers[question.id]?.answer_text ?? ''}
                  onChange={(event) => handleAnswerTextChange(question.id, event)}
                  fullWidth
                  multiline
                  minRows={3}
                  size="small"
                />
              ) : null}

              {question.type === 'subjective' && question.allow_image ? (
                <Stack gap={1.5}>
                  {answers[question.id]?.answer_image_url ? (
                    <Box
                      component="img"
                      src={answers[question.id]?.answer_image_url}
                      alt="답변 이미지"
                      sx={{
                        width: '100%',
                        maxWidth: 320,
                        display: 'block',
                        borderRadius: 1,
                      }}
                    />
                  ) : null}

                  <Stack direction="row" gap={1}>
                    <Button component="label" variant="outlined" disabled={Boolean(uploadingQuestionId)}>
                      {answers[question.id]?.answer_image ? '이미지 교체' : '이미지 업로드'}
                      <input
                        hidden
                        type="file"
                        accept="image/webp,image/jpeg,image/png"
                        onChange={(event) => void handleAnswerImageChange(question.id, event)}
                      />
                    </Button>

                    {answers[question.id]?.answer_image ? (
                      <Button
                        type="button"
                        variant="outlined"
                        color="error"
                        onClick={() => void handleDeleteAnswerImage(question.id)}
                        disabled={Boolean(uploadingQuestionId)}
                      >
                        이미지 삭제
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : null}

      <Stack direction="row" justifyContent="flex-end">
        <Button type="submit" variant="contained" disabled={isSubmitting || Boolean(uploadingQuestionId)}>
          가입하기
        </Button>
      </Stack>

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}
    </Stack>
  );
}
