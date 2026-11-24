'use client';

import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Checkbox, FormControlLabel, FormHelperText, Stack, Typography } from '@mui/material';
import SecurityPinInput from '@/components/auth/SecurityPinInput';
import styles from '@/app/auth.module.sass';

type SecurityPinFieldsProps = {
  pin: string;
  pinConfirm: string;
  isAcknowledged: boolean;
  onPinChange: (value: string) => void;
  onPinConfirmChange: (value: string) => void;
  onAcknowledgedChange: (value: boolean) => void;
  showWarning: boolean;
  isOptional?: boolean;
  errorMessage?: string;
  disabled?: boolean;
};

export default function SecurityPinFields({
  pin,
  pinConfirm,
  isAcknowledged,
  onPinChange,
  onPinConfirmChange,
  onAcknowledgedChange,
  showWarning,
  isOptional,
  errorMessage,
  disabled,
}: SecurityPinFieldsProps) {
  return (
    <Stack gap={1.5} className="security-pin-fields">
      {showWarning ? (
        <div className={`alert error ${styles.alert}`}>
          <WarningAmberRoundedIcon />
          <div>
            <p>
              <strong>보안 비밀번호는 잊어버리면 되찾을 수 없습니다!</strong>
            </p>
            <p>
              처음 쓰는 기기이거나 접속한 적 없는 지역, <br />
              그리고 개인 설정을 열 때 이 번호로 본인인지 확인합니다.
            </p>
            <p>생일이나 전화번호처럼 남이 짐작할 수 있는 번호는 피해 주세요.</p>
          </div>
        </div>
      ) : null}

      <Stack gap={0.75}>
        <Typography variant="subtitle2" component="span">
          {isOptional ? '보안 비밀번호 (숫자 6자리, 선택)' : '보안 비밀번호 (숫자 6자리)'}
        </Typography>
        <SecurityPinInput
          label="보안 비밀번호"
          value={pin}
          onChange={onPinChange}
          disabled={disabled}
          error={Boolean(errorMessage)}
        />
      </Stack>

      <Stack gap={0.75}>
        <Typography variant="subtitle2" component="span">
          보안 비밀번호 확인
        </Typography>
        <SecurityPinInput
          label="보안 비밀번호 확인"
          value={pinConfirm}
          onChange={onPinConfirmChange}
          disabled={disabled}
          error={Boolean(errorMessage)}
        />
      </Stack>

      {errorMessage ? (
        <FormHelperText error role="alert">
          {errorMessage}
        </FormHelperText>
      ) : null}

      {showWarning ? (
        <FormControlLabel
          control={
            <Checkbox
              checked={isAcknowledged}
              onChange={(event) => onAcknowledgedChange(event.currentTarget.checked)}
              disabled={disabled}
            />
          }
          label="보안 비밀번호를 잊어버리면 되찾을 수 없다는 것을 확인했습니다."
        />
      ) : null}
    </Stack>
  );
}
