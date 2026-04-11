'use client';

import { useState, type JSX } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, FormControlLabel, Paper, Radio, RadioGroup, Stack, TextField, Typography } from '@mui/material';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type FormSubmitEvent = Parameters<NonNullable<JSX.IntrinsicElements['form']['onSubmit']>>[0];

type ProductType = 'service' | 'custom';

export default function Opt() {
  const router = useRouter();

  const [categoryKey, setCategoryKey] = useState('');
  const [categoryLabel, setCategoryLabel] = useState('');
  const [planKey, setPlanKey] = useState('');
  const [planLabel, setPlanLabel] = useState('');
  const [price, setPrice] = useState('');
  const [productType, setProductType] = useState<ProductType>('service');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      const response = await fetch('/api/plans', {
        method: 'POST',
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
        throw new Error(result.error ?? '요금제 추가에 실패했습니다.');
      }

      router.replace(`/concierge/admin/plans/${result.planId}`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '요금제 추가에 실패했습니다.');
      } else {
        setErrorMessage('요금제 추가에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Paper elevation={0} sx={{ p: 3 }}>
      <Stack component="form" spacing={2} onSubmit={handleSubmit}>
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

        <Stack spacing={1}>
          <Typography>상품 종류</Typography>
          <RadioGroup value={productType} onChange={handleProductTypeChange}>
            <FormControlLabel value="service" control={<Radio />} label="서비스" />
            <FormControlLabel value="custom" control={<Radio />} label="커스텀" />
          </RadioGroup>
        </Stack>

        <Button type="submit" variant="contained" disabled={isSubmitting}>
          저장
        </Button>

        {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      </Stack>
    </Paper>
  );
}
