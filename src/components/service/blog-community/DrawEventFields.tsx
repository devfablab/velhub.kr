'use client';

import { useState } from 'react';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ko } from 'date-fns/locale/ko';
import NumberField from '@/components/custom-ui/NumberField';
import styles from '@/app/board.module.sass';

export type BlogCommunityDrawState = {
  type: '' | 'first_come' | 'random';
  limit: number;
  endsAt: Date | null;
};

export function emptyBlogCommunityDraw(): BlogCommunityDrawState {
  return { type: '', limit: 1, endsAt: null };
}

function copyDraw(draw: BlogCommunityDrawState): BlogCommunityDrawState {
  return { ...draw, endsAt: draw.endsAt ? new Date(draw.endsAt) : null };
}

export default function DrawEventFields({
  value,
  onChange,
  disabled,
  classes,
}: {
  value: BlogCommunityDrawState;
  onChange: (value: BlogCommunityDrawState) => void;
  disabled: boolean;
  classes: Record<string, string>;
}) {
  const theme = useTheme();
  const isMobile = !useMediaQuery(theme.breakpoints.up('lg'));
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<BlogCommunityDrawState>(() => copyDraw(value));
  const [message, setMessage] = useState('');
  const enabled = Boolean(value.type);

  function openDialog() {
    setDraft(copyDraw(value));
    setMessage('');
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setMessage('');
  }

  function apply() {
    if (!draft.type) return setMessage('추첨 방식을 선택해주세요.');
    if (!Number.isInteger(draft.limit) || draft.limit < 1) return setMessage('당첨 인원수를 입력해주세요.');
    if (draft.type === 'random') {
      if (!draft.endsAt || Number.isNaN(draft.endsAt.getTime())) return setMessage('추첨 마감 일시를 입력해주세요.');
      if (draft.endsAt.getTime() <= Date.now()) return setMessage('추첨 마감 일시는 최소 1분 뒤로 설정해주세요.');
    }
    onChange(copyDraw(draft));
    closeDialog();
  }

  function remove() {
    onChange(emptyBlogCommunityDraw());
    closeDialog();
  }

  const settings = (
    <>
      {message ? <DialogContentText>{message}</DialogContentText> : null}
      <FormControl className={`${classes['draw-end-at']} vh-form-control`}>
        <FormLabel id="draw-type-label">추첨 방식</FormLabel>
        <RadioGroup
          row
          className="vh-radio"
          aria-labelledby="draw-type-label"
          value={draft.type}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              type: event.target.value as BlogCommunityDrawState['type'],
              endsAt: event.target.value === 'first_come' ? null : current.endsAt,
            }))
          }
        >
          <FormControlLabel value="first_come" control={<Radio />} label="선착순" />
          <FormControlLabel value="random" control={<Radio />} label="마감 후 무작위 추첨" />
        </RadioGroup>
      </FormControl>
      <div className={`${classes['form-group']} vh-form-control`}>
        <NumberField
          label="당첨 인원수"
          min={1}
          value={draft.limit}
          size="small"
          onValueChange={(nextValue) =>
            setDraft((current) => ({
              ...current,
              limit: typeof nextValue === 'number' && Number.isFinite(nextValue) ? nextValue : 1,
            }))
          }
        />
      </div>
      {draft.type === 'random' ? (
        <div className={`${classes['draw-setting-end']} ${classes['draw-absolute-end']} vh-form-control`}>
          <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
            <DateTimePicker
              value={draft.endsAt}
              onChange={(endsAt) => setDraft((current) => ({ ...current, endsAt }))}
              ampm={false}
              views={['year', 'month', 'day', 'hours', 'minutes']}
              format="yyyy년 MM월 dd일 hh시 m분"
              slotProps={{ textField: { fullWidth: true, size: 'small' } }}
            />
          </LocalizationProvider>
          <span>에 마감</span>
        </div>
      ) : null}
    </>
  );

  const desktopActions = enabled ? (
    <>
      <button type="button" onClick={remove} className="delete-button">
        추첨 이벤트 삭제
      </button>
      <div className="complex-button">
        <button type="button" onClick={closeDialog} className="cancel-button">
          취소
        </button>
        <button type="button" onClick={apply}>
          추첨 이벤트 설정
        </button>
      </div>
    </>
  ) : (
    <>
      <button type="button" onClick={closeDialog} className="cancel-button">
        취소
      </button>
      <button type="button" onClick={apply}>
        추첨 이벤트 설정
      </button>
    </>
  );

  return (
    <>
      <div className={styles.image}>
        <button
          type="button"
          onClick={openDialog}
          disabled={disabled}
          className={enabled ? classes.enabled : undefined}
        >
          {enabled ? <Inventory2RoundedIcon /> : <Inventory2OutlinedIcon />}
          <span>추첨 이벤트</span>
        </button>
      </div>
      {isMobile ? (
        <Drawer
          anchor="bottom"
          open={open}
          onClose={closeDialog}
          className={`VhiDrawer-bottom VhiDrawer-bottom-service ${classes['draw-dialog']}`}
        >
          <h2>추첨 이벤트 설정</h2>
          <button type="button" className="close-button" onClick={closeDialog} aria-label="추첨 이벤트 설정 닫기">
            <CloseRoundedIcon />
          </button>
          <div className={`VhiDrawer-bottom-content ${classes['draw-dialog-content']}`}>{settings}</div>
          <div className="drawer-dialog-actions">
            {enabled ? (
              <>
                <button type="button" onClick={remove} className="button small danger">
                  추첨 이벤트 삭제
                </button>
                <div className="complex-button">
                  <button type="button" onClick={closeDialog} className="button small cancel">
                    취소
                  </button>
                  <button type="button" onClick={apply} className="button small submit">
                    추첨 이벤트 설정
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={closeDialog} className="button small cancel">
                  취소
                </button>
                <button type="button" onClick={apply} className="button small submit">
                  추첨 이벤트 설정
                </button>
              </>
            )}
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={open}
          onClose={closeDialog}
          fullWidth={true}
          maxWidth="sm"
          className={`vh-dialog vh-alert-dialog ${classes['draw-dialog']}`}
        >
          <DialogTitle>추첨 이벤트 설정</DialogTitle>
          <button type="button" className="close-button" onClick={closeDialog} aria-label="추첨 이벤트 설정 닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent className={classes['draw-dialog-content']}>{settings}</DialogContent>
          <DialogActions className={enabled ? 'complex-buttons' : undefined}>{desktopActions}</DialogActions>
        </Dialog>
      )}
    </>
  );
}
