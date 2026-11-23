import { Chip } from '@mui/material';
import { getAiUsageChipLabel, normalizeAiUsage } from '@/lib/service/site/blog/aiUsage';

export default function AiUsageChip({ value, className }: { value: unknown; className?: string }) {
  const label = getAiUsageChipLabel(value);

  if (!label) {
    return null;
  }

  return (
    <Chip
      size="small"
      label={label}
      className={['chip', normalizeAiUsage(value) === 'partial' ? 'normal' : 'success', className]
        .filter(Boolean)
        .join(' ')}
      sx={{ position: 'relative', top: 2 }}
    />
  );
}
