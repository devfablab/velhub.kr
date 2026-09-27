'use client';

import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Select, type SelectProps } from '@mui/material';

export function SelectCheckAdornment() {
  return <CheckRoundedIcon aria-hidden sx={{ width: 14, height: 14, mr: 1, flex: '0 0 14px' }} />;
}

export default function SelectWithCheck<Value = unknown>(props: SelectProps<Value>) {
  return <Select {...props} startAdornment={props.startAdornment ?? <SelectCheckAdornment />} />;
}
