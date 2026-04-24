'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type PlanRow = {
  id: string;
  category_key: string;
  category_label: string;
  plan_key: string;
  plan_label: string;
  price: number | string;
  product_type: 'service' | 'custom';
};

type Props = {
  planId: string;
};

function formatPrice(value: number | string) {
  const priceNumber = typeof value === 'number' ? value : Number(value ?? 0);
  return `${priceNumber.toLocaleString()} 원`;
}

function formatProductType(value: 'service' | 'custom') {
  return value === 'service' ? '서비스' : '커스텀';
}

export default function Opt({ planId }: Props) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<PlanRow | null>(null);

  const [isEditorImage, setIsEditorImage] = useState<boolean>(false);
  const [isMember, setIsMember] = useState<boolean>(false);
  const [isBoardAttachment, setIsBoardAttachment] = useState<boolean>(false);
  const [countSubpage, setCountSubpage] = useState('');
  const [countBoard, setCountBoard] = useState('');
  const [countUser, setCountUser] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadPlan() {
      try {
        const response = await fetch(`/api/plans/${planId}`, {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '요금제 정보를 불러오지 못했습니다.');
        }

        if (result.feature) {
          throw new Error('이미 요금제 기능이 등록되어 있습니다.');
        }

        setPlan(result.plan as PlanRow);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '요금제 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('요금제 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPlan();
  }, [planId]);

  function handleIsEditorImageChange(event: InputChangeEvent) {
    setIsEditorImage(event.currentTarget.value === 'true');
  }

  function handleIsMemberChange(event: InputChangeEvent) {
    setIsMember(event.currentTarget.value === 'true');
  }

  function handleIsBoardAttachmentChange(event: InputChangeEvent) {
    setIsBoardAttachment(event.currentTarget.value === 'true');
  }

  function handleCountSubpageChange(event: InputChangeEvent) {
    setCountSubpage(event.currentTarget.value);
  }

  function handleCountBoardChange(event: InputChangeEvent) {
    setCountBoard(event.currentTarget.value);
  }

  function handleCountUserChange(event: InputChangeEvent) {
    setCountUser(event.currentTarget.value);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/plans/${planId}/feature`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          isEditorImage,
          isMember,
          isBoardAttachment,
          countSubpage,
          countBoard,
          countUser,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '요금제 기능 추가에 실패했습니다.');
      }

      router.replace(`/concierge/admin/plans/${planId}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '요금제 기능 추가에 실패했습니다.');
      } else {
        setErrorMessage('요금제 기능 추가에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={3}>
      {plan ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={1.5}>
            <Typography>{plan.category_label}</Typography>
            <Typography>{plan.plan_label}</Typography>
            <Typography>{formatPrice(plan.price)}</Typography>
            <Typography>{formatProductType(plan.product_type)}</Typography>
          </Stack>
        </Paper>
      ) : null}

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          <Stack spacing={1}>
            <Typography>에디터에 이미지 삽입 가능</Typography>
            <RadioGroup value={String(isEditorImage)} onChange={handleIsEditorImageChange}>
              <FormControlLabel value="true" control={<Radio />} label="가능" />
              <FormControlLabel value="false" control={<Radio />} label="불가" />
            </RadioGroup>
          </Stack>

          <Stack spacing={1}>
            <Typography>멤버 추가 가능</Typography>
            <RadioGroup value={String(isMember)} onChange={handleIsMemberChange}>
              <FormControlLabel value="true" control={<Radio />} label="가능" />
              <FormControlLabel value="false" control={<Radio />} label="불가" />
            </RadioGroup>
          </Stack>

          <Stack spacing={1}>
            <Typography>게시판에 파일첨부 가능</Typography>
            <RadioGroup value={String(isBoardAttachment)} onChange={handleIsBoardAttachmentChange}>
              <FormControlLabel value="true" control={<Radio />} label="가능" />
              <FormControlLabel value="false" control={<Radio />} label="불가" />
            </RadioGroup>
          </Stack>

          <TextField label="추가 가능한 페이지수" value={countSubpage} onChange={handleCountSubpageChange} fullWidth />

          <TextField label="추가 가능한 게시판수" value={countBoard} onChange={handleCountBoardChange} fullWidth />

          <TextField label="추가 가능한 회원수" value={countUser} onChange={handleCountUserChange} fullWidth />

          <Button type="submit" variant="contained" disabled={isSubmitting}>
            저장
          </Button>

          {errorMessage ? (
            <Alert severity="error" variant="filled">
              {errorMessage}
            </Alert>
          ) : null}
        </Stack>
      </Paper>
    </Stack>
  );
}
