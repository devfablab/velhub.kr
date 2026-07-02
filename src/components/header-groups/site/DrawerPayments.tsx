import MenuItem from '@mui/material/MenuItem';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import Anchor from '@/components/Anchor';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import DoneOutlinedIcon from '@mui/icons-material/DoneOutlined';

type Props = {
  siteName: string;
  onClose: () => void;
};

export default function DrawerPayments({ siteName, onClose }: Props) {
  return (
    <>
      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/payments`}>
          <DashboardOutlinedIcon fontSize="small" />
          <span>수익정산 홈</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/payments/transactions`}>
          <ReceiptLongOutlinedIcon fontSize="small" />
          <span>전체 거래 내역</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/payments/refunds`}>
          <UndoOutlinedIcon fontSize="small" />
          <span>전체 환불 내역</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/payments/scheduled`}>
          <ScheduleOutlinedIcon fontSize="small" />
          <span>정산 예정</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/payments/confirmed`}>
          <LockOutlinedIcon fontSize="small" />
          <span>정산 확정</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/payments/completed`}>
          <DoneOutlinedIcon fontSize="small" />
          <span>정산 완료</span>
        </Anchor>
      </MenuItem>
    </>
  );
}
