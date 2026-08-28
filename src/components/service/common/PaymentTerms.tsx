'use client';

import { useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

export type PaymentTermsType = 'donation' | 'subscription' | 'purchase';

const TERMS: Record<PaymentTermsType, { title: string; items: string[] }> = {
  donation: {
    title: '후원 안내',
    items: [
      '후원은 블로그, 연재, 게시판 또는 게시글에 보내는 단건 결제입니다.',
      '후원은 콘텐츠 구매나 구독이 아니며, 후원만으로 별도의 콘텐츠 열람 권한이나 혜택이 제공되지는 않습니다.',
      '후원 금액은 결제와 동시에 후원 대상에게 전달됩니다.',
      '정상적으로 완료된 후원은 취소하거나 환불할 수 없습니다.',
      '후원 대상 콘텐츠가 수정되거나 무료로 전환되더라도 이미 완료된 후원금은 반환되지 않습니다.',
      '만 19세 미만 회원이 법정대리인의 동의 없이 후원한 경우에는 법정대리인이 환불을 요청할 수 있습니다. 이 경우 본인인증 정보, 결제 정보 및 법정대리인임을 확인할 수 있는 자료를 확인합니다.',
      '후원을 처음 이용하는 계정은 본인인증이 필요합니다.',
    ],
  },
  subscription: {
    title: '구독 안내',
    items: [
      '구독은 블로그 구독, 연재 또는 연재 게시판의 콘텐츠를 이용하기 위한 월결제 서비스입니다.',
      '구독을 시작하면 최초 결제 시각을 기준으로 매월 자동 결제됩니다.',
      '구독을 취소하면 현재 결제기간이 끝날 때까지 구독 혜택을 이용할 수 있으며, 다음 결제일부터 자동 결제되지 않습니다.',
      '취소한 구독은 현재 결제기간이 끝나기 전까지 다시 활성화할 수 있습니다.',
      '구독을 환불하면 환불 완료와 동시에 구독 혜택을 이용할 수 없습니다.',
      '결제 후 24시간 이내에는 전액 환불됩니다. 24시간 초과부터 7일 이내에는 사용일수를 30일 기준으로 계산하여 공제한 뒤 환불됩니다. 결제 후 7일이 지나면 환불되지 않으며, 다음 결제만 취소할 수 있습니다.',
      '구독료가 변경되면 변경된 금액은 다음 결제일부터 적용됩니다.',
      '구독 자동 결제에 실패하면 구독이 종료됩니다. 결제는 자동으로 다시 시도되지 않으며, 계속 이용하려면 직접 다시 구독해야 합니다.',
      '만 19세 미만 회원이 법정대리인의 동의 없이 구독한 경우에는 법정대리인이 환불을 요청할 수 있습니다.',
      '구독을 처음 이용하는 계정은 본인인증이 필요합니다.',
    ],
  },
  purchase: {
    title: '유료 게시글 구매 안내',
    items: [
      '유료 게시글은 결제가 완료되면 즉시 전체 내용을 열람할 수 있는 단건 결제 콘텐츠입니다.',
      '결제 완료와 동시에 콘텐츠 제공이 시작되므로, 정상적으로 완료된 구매는 취소하거나 환불할 수 없습니다.',
      '구매한 게시글이 나중에 무료로 전환되더라도 환불되지 않습니다.',
      '구매한 게시글은 마이허브에서 다시 열람할 수 있습니다. 해당 사이트에서 탈퇴하거나 활동정지, 강제탈퇴 또는 가입불가 처리를 받더라도 열람 권한은 유지됩니다.',
      '구매가 완료된 게시글은 작성자, 운영자 또는 매니저가 삭제할 수 없습니다.',
      '유료 게시글 구매는 해당 게시글을 열람할 수 있는 권한만 제공하며, 저작권이나 복제 · 배포 권한을 제공하지 않습니다.',
      '만 19세 미만 회원이 법정대리인의 동의 없이 구매한 경우에는 법정대리인이 환불을 요청할 수 있습니다.',
      '유료 게시글을 처음 구매하는 계정은 본인인증이 필요합니다.',
    ],
  },
};

type Props = {
  type: PaymentTermsType;
  disabled?: boolean;
};

export default function PaymentTerms({ type, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const terms = TERMS[type];
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={0.5} pt={isMobile ? undefined : 1}>
        <Typography variant="body2">유의사항에 동의 합니다</Typography>
        <button type="button" className="button-term" onClick={() => setOpen(true)} disabled={disabled}>
          안내보기
        </button>
      </Stack>
      {isMobile ? (
        <Drawer anchor="bottom" open={open} onClose={() => setOpen(false)} className="VhiDrawer-bottom">
          <h2>{terms.title}</h2>
          <button className="close-button" onClick={() => setOpen(false)}>
            <CloseRoundedIcon />
          </button>
          <Stack gap={3}>
            <Stack gap={1.25}>
              {terms.items.map((item, index) => (
                <Typography key={item} variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {index + 1}. {item}
                </Typography>
              ))}
            </Stack>
            <Stack direction="column" spacing={1.5}>
              <button type="button" className="button medium cancel" onClick={() => setOpen(false)}>
                닫기
              </button>
            </Stack>
          </Stack>
        </Drawer>
      ) : (
        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm" className="VhiDialog">
          <DialogTitle>{terms.title}</DialogTitle>
          <button type="button" className="close-button" onClick={() => setOpen(false)}>
            <CloseRoundedIcon />
          </button>
          <DialogContent>
            <Stack gap={1.25}>
              {terms.items.map((item, index) => (
                <Typography key={item} variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                  {index + 1}. {item}
                </Typography>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium close" onClick={() => setOpen(false)}>
              닫기
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
