'use client';

import { useEffect, useState } from 'react';
import {
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';

export type MockIdentity = {
  id: string;
  name: string;
  birth_date: string;
  gender: string;
  verification_tx_id: string;
  used: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (bypass: boolean, mockTxId?: string) => void;
};

export default function DevIdentityBypassModal({ open, onClose, onConfirm }: Props) {
  const [bypass, setBypass] = useState(false);
  const [identities, setIdentities] = useState<MockIdentity[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (bypass && identities.length === 0) {
      setIsLoading(true);
      fetch('/api/dev/mock-identities')
        .then((res) => res.json())
        .then((data: MockIdentity[]) => {
          setIdentities(data || []);
        })
        .catch(console.error)
        .finally(() => setIsLoading(false));
    }
  }, [bypass, identities.length]);

  // Reset state when opened/closed
  useEffect(() => {
    if (!open) {
      setBypass(false);
      setSelectedTxId('');
    }
  }, [open]);

  const handleSubmit = () => {
    onConfirm(bypass, bypass ? selectedTxId : undefined);
  };

  if (process.env.NEXT_PUBLIC_APP_ENV !== 'test') {
    return null;
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>개발용 본인인증 바이패스</DialogTitle>
      <DialogContent dividers>
        <FormControlLabel
          control={<Checkbox checked={bypass} onChange={(e) => setBypass(e.target.checked)} />}
          label="본인인증 바이패스 (훼이크 DB 사용)"
        />
        {bypass && (
          <Stack sx={{ mt: 2, maxHeight: 400, overflowY: 'auto' }}>
            {isLoading ? (
              <Typography>로딩 중...</Typography>
            ) : (
              <RadioGroup value={selectedTxId} onChange={(e) => setSelectedTxId(e.target.value)}>
                {identities.map((m) => (
                  <FormControlLabel
                    key={m.id}
                    value={m.verification_tx_id}
                    control={<Radio size="small" />}
                    label={
                      <Typography variant="body2" color={m.used ? 'text.secondary' : 'text.primary'}>
                        {m.name} / {m.birth_date} / {m.gender} {m.used && <strong style={{ color: 'red' }}>(사용됨)</strong>}
                      </Typography>
                    }
                  />
                ))}
              </RadioGroup>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          취소
        </Button>
        <Button
          onClick={handleSubmit}
          className="button action"
          disabled={bypass && !selectedTxId}
        >
          {bypass ? '가짜 데이터로 인증하기' : '원래대로 진행'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
