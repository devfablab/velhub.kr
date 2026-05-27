'use client';

import { useEffect, useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type ProductType = 'service' | 'custom';

type PlanRow = {
  id: string;
  category_key: string;
  category_label: string;
  plan_key: string;
  plan_label: string;
  price: number | string;
  product_type: ProductType;
};

type Props = {
  planId: string;
};

export default function Opt({ planId }: Props) {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [categoryKey, setCategoryKey] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [planKey, setPlanKey] = useState('');
  const [planLabel, setPlanLabel] = useState('');
  const [price, setPrice] = useState('');
  const [productType, setProductType] = useState<ProductType>('service');
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

        const plan = result.plan as PlanRow;

        setCategoryKey(plan.category_key ?? '');
        setCategoryLabel(plan.category_label ?? '');
        setPlanKey(plan.plan_key ?? '');
        setPlanLabel(plan.plan_label ?? '');
        setPrice(String(plan.price ?? ''));
        setProductType(plan.product_type);
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

  function handleCategoryKeyChange(event: InputChangeEvent) {
    setCategoryKey(event.currentTarget.value);
  }

  function handleCategoryLabelChange(event: InputChangeEvent) {
    setCategoryLabel(event.currentTarget.value);
  }

  function handlePlanKeyChange(event: InputChangeEvent) {
    setPlanKey(event.currentTarget.value);
  }

  function handlePlanLabelChange(event: InputChangeEvent) {
    setPlanLabel(event.currentTarget.value);
  }

  function handlePriceChange(event: InputChangeEvent) {
    setPrice(event.currentTarget.value);
  }

  function handleProductTypeChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    if (nextValue !== 'service' && nextValue !== 'custom') {
      return;
    }

    setProductType(nextValue);
  }

  async function handleSubmit(event: FormSubmitEvent) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMessage('');
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/plans/${planId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          categoryKey,
          categoryLabel,
          planKey,
          planLabel,
          price,
          productType,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '요금제 수정에 실패했습니다.');
      }

      router.replace(`/concierge/admin/plans/${planId}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '요금제 수정에 실패했습니다.');
      } else {
        setErrorMessage('요금제 수정에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack component="form" gap={2} onSubmit={handleSubmit}>
        <TextField label="요금제 카테고리 영문명" value={categoryKey} onChange={handleCategoryKeyChange} fullWidth />

        <TextField
          label="요금제 카테고리 한글명"
          value={categoryLabel}
          onChange={handleCategoryLabelChange}
          fullWidth
        />

        <TextField label="요금제 영문명" value={planKey} onChange={handlePlanKeyChange} fullWidth />

        <TextField label="요금제 한글명" value={planLabel} onChange={handlePlanLabelChange} fullWidth />

        <TextField label="가격" value={price} onChange={handlePriceChange} fullWidth />

        <Stack gap={1}>
          <Typography>상품 종류</Typography>
          <RadioGroup value={productType} onChange={handleProductTypeChange}>
            <FormControlLabel value="service" control={<Radio />} label="서비스" />
            <FormControlLabel value="custom" control={<Radio />} label="커스텀" />
          </RadioGroup>
        </Stack>

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
  );
}
