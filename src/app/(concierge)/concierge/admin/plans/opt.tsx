'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material';

type PlanRow = {
  id: string;
  category_key: string;
  category_label: string;
  plan_key: string;
  plan_label: string;
  price: number | string;
  product_type: 'service' | 'custom';
  has_feature: boolean;
};

function formatPrice(value: number | string) {
  const priceNumber = typeof value === 'number' ? value : Number(value ?? 0);
  return `${priceNumber.toLocaleString()} 원`;
}

function formatProductType(value: 'service' | 'custom') {
  return value === 'service' ? '서비스' : '커스텀';
}

export default function Opt() {
  const router = useRouter();

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PlanRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    async function loadPlans() {
      try {
        const response = await fetch('/api/plans', {
          method: 'GET',
          credentials: 'include',
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '요금제 목록을 불러오지 못했습니다.');
        }

        setPlans(Array.isArray(result.plans) ? result.plans : []);
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '요금제 목록을 불러오지 못했습니다.');
        } else {
          setErrorMessage('요금제 목록을 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadPlans();
  }, []);

  function handleMoveToNew() {
    router.push('/concierge/admin/plans/new');
  }

  function handleView(planId: string) {
    router.push(`/concierge/admin/plans/${planId}`);
  }

  function handleMoveToFeature(planId: string, hasFeature: boolean) {
    if (hasFeature) {
      router.push(`/concierge/admin/plans/${planId}/feature/edit`);
      return;
    }

    router.push(`/concierge/admin/plans/${planId}/feature/new`);
  }

  function handleOpenDeleteDialog(plan: PlanRow) {
    setDeleteTarget(plan);
  }

  function handleCloseDeleteDialog() {
    if (isDeleting) {
      return;
    }

    setDeleteTarget(null);
  }

  async function handleDelete() {
    if (!deleteTarget || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage('');

    try {
      const response = await fetch(`/api/plans/${deleteTarget.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error ?? '요금제 삭제에 실패했습니다.');
      }

      setPlans((previousValue) => previousValue.filter((planRow) => planRow.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '요금제 삭제에 실패했습니다.');
      } else {
        setErrorMessage('요금제 삭제에 실패했습니다.');
      }
    } finally {
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="flex-end">
        <Button type="button" variant="contained" onClick={handleMoveToNew}>
          요금제 추가
        </Button>
      </Stack>

      <TableContainer component={Paper}>
        <Table>
          <TableBody>
            {plans.map((planRow) => (
              <TableRow key={planRow.id} hover>
                <TableCell onClick={() => handleView(planRow.id)} sx={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {`${planRow.category_label} / ${planRow.plan_label}`}
                </TableCell>
                <TableCell onClick={() => handleView(planRow.id)} sx={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {formatPrice(planRow.price)}
                </TableCell>
                <TableCell onClick={() => handleView(planRow.id)} sx={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  {formatProductType(planRow.product_type)}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Button
                    type="button"
                    variant="outlined"
                    onClick={() => handleMoveToFeature(planRow.id, planRow.has_feature)}
                  >
                    {planRow.has_feature ? '기능 수정' : '기능 추가'}
                  </Button>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Button type="button" color="error" onClick={() => handleOpenDeleteDialog(planRow)}>
                    삭제
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {errorMessage ? (
        <Alert severity="error" variant="filled">
          {errorMessage}
        </Alert>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onClose={handleCloseDeleteDialog} fullWidth maxWidth="xs">
        <DialogTitle>요금제를 삭제합니다</DialogTitle>
        <DialogContent>
          <Typography>기능이 있으면 같이 삭제됩니다.</Typography>
        </DialogContent>
        <DialogActions>
          <Button type="button" variant="outlined" onClick={handleCloseDeleteDialog} disabled={isDeleting}>
            취소
          </Button>
          <Button type="button" color="error" variant="contained" onClick={handleDelete} disabled={isDeleting}>
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
