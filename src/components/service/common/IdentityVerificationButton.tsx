'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import PortOne from '@portone/browser-sdk/v2';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  MenuItem,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { BANK_OPTIONS, BUSINESS_INCOME_CODE_OPTIONS } from '@/lib/settlement/options';

type Identity = {
  name: string;
  birth_date: string;
  gender: string;
  identity_verified_at: string;
};

type SettlementType = 'individual' | 'business';

type Settlement = {
  settlement_type: SettlementType;
  resident_registration_number: string | null;
  business_registration_number: string | null;
  business_license: string | null;
  business_income_code: string | null;
  bank_code: string | null;
  account_number: string | null;
  account_holder: string | null;
  account_verified_at: string | null;
};

type IdentityStatusResponse = {
  exists: boolean;
  identity: Identity | null;
};

type SettlementResponse = {
  exists: boolean;
  identity: Identity | null;
  settlement: Settlement | null;
};

type IdentityVerificationRequest = {
  storeId: string;
  channelKey: string;
  identityVerificationId: string;
};

type IdentityVerificationSuccessResponse = {
  name: string;
  birth_date: string;
  gender: string;
};

function onlyDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '');
}

function getMessage(error: unknown) {
  return error instanceof Error ? error.message : '요청 처리에 실패했습니다.';
}

function isMessageResponse(value: unknown): value is { message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'message' in value &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

function getBirthDatePrefix(birthDate: string | null | undefined) {
  const digits = onlyDigits(birthDate);

  if (digits.length === 8) {
    return digits.slice(2, 8);
  }

  return digits.slice(0, 6);
}

function isAdult(birthDate: string | null | undefined) {
  const digits = onlyDigits(birthDate);

  if (digits.length !== 8) {
    return false;
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const today = new Date();
  const birthdayThisYear = new Date(today.getFullYear(), month - 1, day);
  let age = today.getFullYear() - year;

  if (today < birthdayThisYear) {
    age -= 1;
  }

  return age >= 19;
}

function getExpectedResidentGenderDigits(birthDate: string, gender: string) {
  const digits = onlyDigits(birthDate);
  const year = Number(digits.slice(0, 4));

  if (gender === 'MALE') {
    return year >= 2000 ? ['3'] : ['1'];
  }

  if (gender === 'FEMALE') {
    return year >= 2000 ? ['4'] : ['2'];
  }

  return [];
}

function isValidResidentRegistrationNumber(value: string) {
  if (!/^\d{13}$/.test(value)) {
    return false;
  }

  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0);
  const checkDigit = (11 - (sum % 11)) % 10;

  return checkDigit === Number(value[12]);
}

function validateResidentSuffix(
  identity: Identity,
  birthDatePrefix: string,
  residentSuffix: string,
  residentSuffixConfirm: string,
) {
  if (residentSuffix.length !== 7 || residentSuffixConfirm.length !== 7) {
    throw new Error('주민등록번호 뒷자리를 입력해 주세요.');
  }

  if (residentSuffix !== residentSuffixConfirm) {
    throw new Error('주민등록번호 뒷자리 확인값이 일치하지 않습니다.');
  }

  const expectedGenderDigits = getExpectedResidentGenderDigits(identity.birth_date, identity.gender);
  const genderDigit = residentSuffix.slice(0, 1);

  if (expectedGenderDigits.length > 0 && !expectedGenderDigits.includes(genderDigit)) {
    throw new Error('주민등록번호 뒷자리 첫 숫자가 본인인증 정보와 일치하지 않습니다.');
  }

  const residentRegistrationNumber = `${birthDatePrefix}${residentSuffix}`;

  if (!isValidResidentRegistrationNumber(residentRegistrationNumber)) {
    throw new Error('주민등록번호 형식이 올바르지 않습니다.');
  }

  return residentRegistrationNumber;
}

async function getJson<T>(url: string) {
  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
  });

  const data = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message = isMessageResponse(data) ? data.message : '요청 처리에 실패했습니다.';

    throw new Error(message);
  }

  return data as T;
}

async function sendJson<T>(url: string, method: 'POST' | 'PATCH', body?: unknown) {
  const response = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message = isMessageResponse(data) ? data.message : '요청 처리에 실패했습니다.';

    throw new Error(message);
  }

  return data as T;
}

async function sendFormData<T>(url: string, method: 'POST' | 'PATCH', body: FormData) {
  const response = await fetch(url, {
    method,
    credentials: 'include',
    body,
  });

  const data = (await response.json().catch(() => null)) as T | { message?: string } | null;

  if (!response.ok) {
    const message = isMessageResponse(data) ? data.message : '요청 처리에 실패했습니다.';

    throw new Error(message);
  }

  return data as T;
}

export default function IdentityVerificationButton() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<SettlementType | ''>('');

  const [residentSuffix, setResidentSuffix] = useState('');
  const [residentSuffixConfirm, setResidentSuffixConfirm] = useState('');
  const [businessRegistrationNumber, setBusinessRegistrationNumber] = useState('');
  const [businessLicenseFile, setBusinessLicenseFile] = useState<File | null>(null);
  const [businessIncomeCode, setBusinessIncomeCode] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const isEditing = Boolean(settlement);
  const isVerified = Boolean(identity);
  const canSettle = identity ? isAdult(identity.birth_date) : false;
  const birthDatePrefix = identity ? getBirthDatePrefix(identity.birth_date) : '';

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  const drawerSelectMenuProps = {
    sx: {
      zIndex: 20001,
    },
  };

  const buttonText = useMemo(() => {
    if (!isVerified) {
      return '본인인증';
    }

    if (!canSettle) {
      return '본인인증 완료';
    }

    if (!settlement) {
      return '정산 정보 입력';
    }

    return '정산 정보 수정';
  }, [canSettle, isVerified, settlement]);

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
  };

  const loadStatus = async () => {
    setIsLoading(true);

    try {
      const identityStatus = await getJson<IdentityStatusResponse>('/api/identity/portone/status');

      if (!identityStatus.exists || !identityStatus.identity) {
        setIdentity(null);
        setSettlement(null);
        return;
      }

      setIdentity(identityStatus.identity);

      const settlementStatus = await getJson<SettlementResponse>('/api/settlement');

      setSettlement(settlementStatus.settlement);
    } catch (error) {
      showSnackbar(getMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const resetForm = (type: SettlementType, nextSettlement: Settlement | null) => {
    setSelectedType(type);
    setResidentSuffix('');
    setResidentSuffixConfirm('');
    setBusinessRegistrationNumber(
      nextSettlement?.settlement_type === 'business' && nextSettlement.business_registration_number
        ? onlyDigits(nextSettlement.business_registration_number)
        : '',
    );
    setBusinessLicenseFile(null);
    setBusinessIncomeCode(
      nextSettlement?.settlement_type === 'individual' && nextSettlement.business_income_code
        ? nextSettlement.business_income_code
        : '',
    );
    setBankCode(nextSettlement?.bank_code ?? '');
    setAccountHolder(nextSettlement?.account_holder ?? '');
    setAccountNumber(nextSettlement?.account_number ? onlyDigits(nextSettlement.account_number) : '');
  };

  const handleVerify = async () => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      const request = await sendJson<IdentityVerificationRequest>('/api/identity/portone/start', 'POST');
      const result = await PortOne.requestIdentityVerification(request);
      const identityVerificationId = result?.identityVerificationId ?? request.identityVerificationId;

      if (!identityVerificationId || result?.code) {
        await sendJson('/api/identity/portone/fail', 'POST', {
          identityVerificationId: request.identityVerificationId,
          code: result?.code,
          message: result?.message,
        });

        throw new Error(result?.message || '본인인증이 완료되지 않았습니다.');
      }

      const verifiedIdentity = await sendJson<IdentityVerificationSuccessResponse>(
        '/api/identity/portone/success',
        'POST',
        { identityVerificationId },
      );

      setIdentity({
        ...verifiedIdentity,
        identity_verified_at: new Date().toISOString(),
      });
      setSettlement(null);
      showSnackbar('본인인증이 완료되었습니다.');
    } catch (error) {
      showSnackbar(getMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMainButtonClick = () => {
    if (!identity) {
      void handleVerify();
      return;
    }

    if (!canSettle) {
      return;
    }

    if (settlement) {
      resetForm(settlement.settlement_type, settlement);
      setFormDialogOpen(true);
      return;
    }

    setSelectedType('');
    setTypeDialogOpen(true);
  };

  const handleTypeNext = () => {
    if (!selectedType) {
      showSnackbar('개인 또는 사업자를 선택해 주세요.');
      return;
    }

    resetForm(selectedType, null);
    setTypeDialogOpen(false);
    setFormDialogOpen(true);
  };

  const handleBusinessLicenseChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    setBusinessLicenseFile(file);
  };

  const createFormData = () => {
    if (!identity) {
      throw new Error('본인인증이 필요합니다.');
    }

    if (!selectedType) {
      throw new Error('정산 유형을 선택해 주세요.');
    }

    if (!bankCode || !accountHolder.trim() || !accountNumber) {
      throw new Error('계좌 정보를 입력해 주세요.');
    }

    const formData = new FormData();

    formData.append('settlement_type', selectedType);
    formData.append('bank_code', bankCode);
    formData.append('account_number', accountNumber);
    formData.append('account_holder', accountHolder.trim());

    if (selectedType === 'individual') {
      const residentRegistrationNumber = validateResidentSuffix(
        identity,
        birthDatePrefix,
        residentSuffix,
        residentSuffixConfirm,
      );

      if (!businessIncomeCode) {
        throw new Error('업종코드를 선택해 주세요.');
      }

      formData.append('resident_registration_number', residentRegistrationNumber);
      formData.append('business_income_code', businessIncomeCode);

      return formData;
    }

    if (businessRegistrationNumber.length !== 10) {
      throw new Error('사업자등록번호를 입력해 주세요.');
    }

    if (businessLicenseFile && businessLicenseFile.type !== 'application/pdf') {
      throw new Error('사업자등록증은 PDF 파일만 등록할 수 있습니다.');
    }

    if (!isEditing && !businessLicenseFile) {
      throw new Error('사업자등록증 PDF를 등록해 주세요.');
    }

    if (
      isEditing &&
      !businessLicenseFile &&
      !(settlement?.settlement_type === 'business' && settlement.business_license)
    ) {
      throw new Error('사업자등록증 PDF를 등록해 주세요.');
    }

    formData.append('business_registration_number', businessRegistrationNumber);

    if (businessLicenseFile) {
      formData.append('business_license', businessLicenseFile);
    }

    return formData;
  };

  const handleSubmit = async () => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);

    try {
      const formData = createFormData();

      if (isEditing) {
        await sendFormData('/api/settlement/edit', 'PATCH', formData);
      } else {
        await sendFormData('/api/settlement/new', 'POST', formData);
      }

      setFormDialogOpen(false);
      await loadStatus();
      showSnackbar(isEditing ? '정산 정보가 수정되었습니다.' : '정산 정보가 등록되었습니다.');
    } catch (error) {
      showSnackbar(getMessage(error));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="button medium submit"
        onClick={handleMainButtonClick}
        disabled={isLoading || isProcessing}
      >
        {isProcessing ? '처리 중' : buttonText}
      </button>

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={typeDialogOpen}
          onClose={() => setTypeDialogOpen(false)}
          className="VhiDrawer-bottom"
        >
          <h2>정산 유형 선택</h2>
          <button type="button" className="close-button" onClick={() => setTypeDialogOpen(false)}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <Select
              fullWidth
              displayEmpty
              size="small"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as SettlementType | '')}
              MenuProps={drawerSelectMenuProps}
            >
              <MenuItem value="" disabled>
                정산 유형을 선택해 주세요
              </MenuItem>
              <MenuItem value="individual">개인</MenuItem>
              <MenuItem value="business">사업자</MenuItem>
            </Select>
            <Stack direction="column" spacing={1.5}>
              <button type="button" className="button medium cancel" onClick={() => setTypeDialogOpen(false)}>
                취소
              </button>
              <button type="button" className="button medium submit" onClick={handleTypeNext}>
                다음
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={typeDialogOpen}
          onClose={() => setTypeDialogOpen(false)}
          fullWidth
          maxWidth="xs"
          className="VhiDialog"
        >
          <DialogTitle>정산 유형 선택</DialogTitle>
          <DialogContent>
            <Select
              fullWidth
              displayEmpty
              size="small"
              value={selectedType}
              onChange={(event) => setSelectedType(event.target.value as SettlementType | '')}
            >
              <MenuItem value="" disabled>
                정산 유형을 선택해 주세요
              </MenuItem>
              <MenuItem value="individual">개인</MenuItem>
              <MenuItem value="business">사업자</MenuItem>
            </Select>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={() => setTypeDialogOpen(false)}>
              취소
            </button>
            <button type="button" className="button medium submit" onClick={handleTypeNext}>
              다음
            </button>
          </DialogActions>
        </Dialog>
      )}

      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={formDialogOpen}
          onClose={() => setFormDialogOpen(false)}
          className="VhiDrawer-bottom"
        >
          <h2>{isEditing ? '정산 정보 수정' : '정산 정보 입력'}</h2>
          <button type="button" className="close-button" onClick={() => setFormDialogOpen(false)}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <Stack gap={1}>
              {identity && selectedType === 'individual' ? (
                <>
                  <Typography variant="subtitle2">{identity.name}</Typography>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="body2">{birthDatePrefix}</Typography>
                    <Typography variant="body2">-</Typography>
                    <TextField
                      type="password"
                      placeholder="주민등록번호 뒷자리"
                      value={residentSuffix}
                      onChange={(event) => setResidentSuffix(onlyDigits(event.target.value).slice(0, 7))}
                      size="small"
                      slotProps={{
                        htmlInput: {
                          inputMode: 'numeric',
                          maxLength: 7,
                        },
                      }}
                    />
                    <TextField
                      type="password"
                      placeholder="주민등록번호 뒷자리 확인"
                      value={residentSuffixConfirm}
                      onChange={(event) => setResidentSuffixConfirm(onlyDigits(event.target.value).slice(0, 7))}
                      size="small"
                      slotProps={{
                        htmlInput: {
                          inputMode: 'numeric',
                          maxLength: 7,
                        },
                      }}
                    />
                  </Stack>

                  <Select
                    displayEmpty
                    size="small"
                    value={businessIncomeCode}
                    onChange={(event) => setBusinessIncomeCode(event.target.value)}
                    MenuProps={drawerSelectMenuProps}
                  >
                    <MenuItem value="" disabled>
                      업종코드를 선택해 주세요
                    </MenuItem>
                    {BUSINESS_INCOME_CODE_OPTIONS.map((option) => (
                      <MenuItem key={option.code} value={option.code}>
                        {option.code} ({option.label})
                      </MenuItem>
                    ))}
                  </Select>
                </>
              ) : null}

              {identity && selectedType === 'business' ? (
                <>
                  <Typography variant="subtitle2">대표자 이름 / {identity.name}</Typography>

                  <TextField
                    fullWidth
                    placeholder="사업자등록번호"
                    size="small"
                    value={businessRegistrationNumber}
                    onChange={(event) => setBusinessRegistrationNumber(onlyDigits(event.target.value).slice(0, 10))}
                    slotProps={{
                      htmlInput: {
                        inputMode: 'numeric',
                        maxLength: 10,
                      },
                    }}
                  />

                  <Button component="label" className="button small action">
                    사업자등록증 PDF 선택
                    <input type="file" accept="application/pdf" hidden onChange={handleBusinessLicenseChange} />
                  </Button>

                  {businessLicenseFile ? <p>{businessLicenseFile.name}</p> : null}
                </>
              ) : null}

              <Select
                displayEmpty
                size="small"
                value={bankCode}
                onChange={(event) => setBankCode(event.target.value)}
                MenuProps={drawerSelectMenuProps}
              >
                <MenuItem value="" disabled>
                  입금 은행을 선택해 주세요
                </MenuItem>
                {BANK_OPTIONS.map((option) => (
                  <MenuItem key={option.code} value={option.code}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>

              <TextField
                fullWidth
                placeholder="예금주"
                size="small"
                value={accountHolder}
                onChange={(event) => setAccountHolder(event.target.value)}
              />

              <TextField
                fullWidth
                placeholder="계좌번호"
                size="small"
                value={accountNumber}
                onChange={(event) => setAccountNumber(onlyDigits(event.target.value))}
                slotProps={{
                  htmlInput: {
                    inputMode: 'numeric',
                  },
                }}
              />
            </Stack>
            <Stack direction="column" spacing={1.5}>
              <button type="button" className="button medium cancel" onClick={() => setFormDialogOpen(false)}>
                취소
              </button>
              <button type="button" className="button medium submit" onClick={handleSubmit} disabled={isProcessing}>
                {isEditing ? '수정' : '등록'}
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog
          open={formDialogOpen}
          onClose={() => setFormDialogOpen(false)}
          fullWidth
          maxWidth="sm"
          className="VhiDialog"
        >
          <DialogTitle>{isEditing ? '정산 정보 수정' : '정산 정보 입력'}</DialogTitle>
          <DialogContent>
            <Stack gap={1} sx={{ p: 1 }}>
              {identity && selectedType === 'individual' ? (
                <>
                  <Typography variant="subtitle2">{identity.name}</Typography>
                  <Stack direction="row" alignItems="center" gap={1}>
                    <Typography variant="body2">{birthDatePrefix}</Typography>
                    <Typography variant="body2">-</Typography>
                    <TextField
                      type="password"
                      placeholder="주민등록번호 뒷자리"
                      value={residentSuffix}
                      onChange={(event) => setResidentSuffix(onlyDigits(event.target.value).slice(0, 7))}
                      size="small"
                      slotProps={{
                        htmlInput: {
                          inputMode: 'numeric',
                          maxLength: 7,
                        },
                      }}
                    />
                    <TextField
                      type="password"
                      placeholder="주민등록번호 뒷자리 확인"
                      value={residentSuffixConfirm}
                      onChange={(event) => setResidentSuffixConfirm(onlyDigits(event.target.value).slice(0, 7))}
                      size="small"
                      slotProps={{
                        htmlInput: {
                          inputMode: 'numeric',
                          maxLength: 7,
                        },
                      }}
                    />
                  </Stack>

                  <Select
                    displayEmpty
                    size="small"
                    value={businessIncomeCode}
                    onChange={(event) => setBusinessIncomeCode(event.target.value)}
                  >
                    <MenuItem value="" disabled>
                      업종코드를 선택해 주세요
                    </MenuItem>
                    {BUSINESS_INCOME_CODE_OPTIONS.map((option) => (
                      <MenuItem key={option.code} value={option.code}>
                        {option.code} ({option.label})
                      </MenuItem>
                    ))}
                  </Select>
                </>
              ) : null}

              {identity && selectedType === 'business' ? (
                <>
                  <Typography variant="subtitle2">대표자 이름 / {identity.name}</Typography>

                  <TextField
                    fullWidth
                    placeholder="사업자등록번호"
                    size="small"
                    value={businessRegistrationNumber}
                    onChange={(event) => setBusinessRegistrationNumber(onlyDigits(event.target.value).slice(0, 10))}
                    slotProps={{
                      htmlInput: {
                        inputMode: 'numeric',
                        maxLength: 10,
                      },
                    }}
                  />

                  <Button component="label" className="button small action">
                    사업자등록증 PDF 선택
                    <input type="file" accept="application/pdf" hidden onChange={handleBusinessLicenseChange} />
                  </Button>

                  {businessLicenseFile ? <p>{businessLicenseFile.name}</p> : null}
                </>
              ) : null}

              <Select displayEmpty size="small" value={bankCode} onChange={(event) => setBankCode(event.target.value)}>
                <MenuItem value="" disabled>
                  입금 은행을 선택해 주세요
                </MenuItem>
                {BANK_OPTIONS.map((option) => (
                  <MenuItem key={option.code} value={option.code}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>

              <TextField
                fullWidth
                placeholder="예금주"
                size="small"
                value={accountHolder}
                onChange={(event) => setAccountHolder(event.target.value)}
              />

              <TextField
                fullWidth
                placeholder="계좌번호"
                size="small"
                value={accountNumber}
                onChange={(event) => setAccountNumber(onlyDigits(event.target.value))}
                slotProps={{
                  htmlInput: {
                    inputMode: 'numeric',
                  },
                }}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={() => setFormDialogOpen(false)}>
              취소
            </button>
            <button type="button" className="button medium submit" onClick={handleSubmit} disabled={isProcessing}>
              {isEditing ? '수정' : '등록'}
            </button>
          </DialogActions>
        </Dialog>
      )}

      <Snackbar
        open={Boolean(snackbarMessage)}
        message={snackbarMessage}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        autoHideDuration={2700}
        onClose={() => setSnackbarMessage('')}
        sx={{
          zIndex: 20002,
        }}
      />
    </>
  );
}
