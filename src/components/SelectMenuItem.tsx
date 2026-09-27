'use client';

import { forwardRef } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Box, MenuItem, type MenuItemProps } from '@mui/material';

const SelectMenuItem = forwardRef<HTMLLIElement, MenuItemProps>(function SelectMenuItem(
  { children, selected, ...props },
  ref,
) {
  return (
    <MenuItem ref={ref} selected={selected} {...props}>
      <Box component="span" aria-hidden sx={{ width: 14, height: 14, mr: 1, flex: '0 0 14px', display: 'inline-flex' }}>
        {selected ? <CheckRoundedIcon sx={{ width: 14, height: 14 }} /> : null}
      </Box>
      {children}
    </MenuItem>
  );
});

export default SelectMenuItem;
