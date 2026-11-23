'use client';

import { Chip, FormControlLabel, FormHelperText, Radio, RadioGroup, Stack, Typography } from '@mui/material';
import { AI_USAGE_OPTIONS, type AiUsage, normalizeAiUsage } from '@/lib/service/site/blog/aiUsage';

type Props = {
  value: AiUsage | null;
  onChange: (value: AiUsage) => void;
  disabled?: boolean;
  errorMessage?: string;
};

export default function BlogPostAiUsageField({ value, onChange, disabled = false, errorMessage }: Props) {
  return (
    <Stack gap={1} className="ai-usage-field">
      <Typography variant="subtitle2" component="span" id="blog-post-ai-usage-label">
        AI 활용 *
      </Typography>
      <Typography variant="body2">
        이 글을 쓸 때 AI의 도움을 얼마나 받았나요? 독자는 글을 열기 전에 이 표시를 보게 돼요.
      </Typography>
      <RadioGroup
        aria-labelledby="blog-post-ai-usage-label"
        value={value ?? ''}
        onChange={(event) => {
          const nextValue = normalizeAiUsage(event.target.value);

          if (nextValue) {
            onChange(nextValue);
          }
        }}
        sx={{ gap: 1 }}
      >
        {AI_USAGE_OPTIONS.map((option) => (
          <FormControlLabel
            key={option.value}
            value={option.value}
            disabled={disabled}
            control={<Radio />}
            label={
              <Stack gap={0.25}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography variant="body1" component="span">
                    {option.label}
                  </Typography>
                  {option.chipLabel ? (
                    <Chip
                      size="small"
                      label={option.chipLabel}
                      className={`chip  ${option.value === 'partial' ? 'normal' : 'success'}`}
                    />
                  ) : null}
                </Stack>
                <Typography variant="body2" component="span">
                  {option.description}
                </Typography>
              </Stack>
            }
          />
        ))}
      </RadioGroup>
      {errorMessage ? (
        <FormHelperText error role="alert">
          {errorMessage}
        </FormHelperText>
      ) : null}
    </Stack>
  );
}
