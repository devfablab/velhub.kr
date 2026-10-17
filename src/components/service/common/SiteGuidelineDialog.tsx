'use client';

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
import type { SiteGuidelineDialogData } from '@/lib/siteGuidelines/server';
import AppIconAvatar from '@/components/custom-ui/AppIconAvatar';

type Props = {
  open: boolean;
  onClose: () => void;
  data: SiteGuidelineDialogData;
};

export default function SiteGuidelineDialog({ open, onClose, data }: Props) {
  const title = data.site.siteType === 'blog' ? '블로그 이용 가이드라인 안내' : '커뮤니티 이용 가이드라인 안내';
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const content = (
    <Stack gap={2}>
      <Stack direction="row" alignItems="center" gap={1.5}>
        <AppIconAvatar site={data.site.siteType} src={data.site.avatarUrl} alt="" size={48} />
        <Stack gap={0.25}>
          <Typography variant="subtitle2">{data.site.name}</Typography>
          {data.site.summary ? <Typography variant="body2">{data.site.summary}</Typography> : null}
        </Stack>
      </Stack>

      <Stack component="ol" gap={1}>
        {data.items.map((item, index) => (
          <Stack component="li" key={item.id} direction="row" alignItems="flex-start" gap={1}>
            <Typography
              component="span"
              aria-hidden
              sx={{
                display: 'inline-flex',
                flex: '0 0 auto',
                justifyContent: 'center',
                alignItems: 'center',
                width: 28,
                height: 28,
                borderRadius: '50%',
                bgcolor: 'action.selected',
                fontWeight: 700,
              }}
            >
              {index + 1}
            </Typography>
            <Typography component="span" variant="body2" sx={{ pt: 0.25 }}>
              {item.content}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );

  if (isMobile) {
    return (
      <Drawer anchor="bottom" open={open} onClose={onClose} className="VhiDrawer-bottom VhiDrawer-bottom-service">
        <h2>{title}</h2>
        <button type="button" className="close-button" onClick={onClose} aria-label="닫기">
          <CloseRoundedIcon />
        </button>
        <div className="VhiDrawer-bottom-content">{content}</div>
        <div className="drawer-dialog-actions">
          <button type="button" className="button medium submit" onClick={onClose}>
            확인
          </button>
        </div>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" className="vh-dialog vh-alert-dialog">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{content}</DialogContent>
      <DialogActions>
        <button type="button" className="button medium action" onClick={onClose}>
          확인
        </button>
      </DialogActions>
    </Dialog>
  );
}
