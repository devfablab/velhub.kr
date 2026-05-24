'use client';

import { useEffect, useMemo, useState, type JSX } from 'react';
import { useParams } from 'next/navigation';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { ko } from 'date-fns/locale';
import { formatDate, normalizeText } from '@/lib/utils';
import { LoadingIndicator } from '@/components/LoadingIndicator';
import Container from '../../menu';
import styles from '@/app/manage.module.sass';

type InputChangeEvent = Parameters<NonNullable<JSX.IntrinsicElements['input']['onChange']>>[0];
type TextFieldChangeEvent = React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;

type UserMembershipRow = {
  id: string;
  user_id: string;
  site_id: string;
  is_approval: boolean;
  blocked_at: string | null;
  block_count: number;
  approval_at: string | null;
  is_block: boolean;
  role: string | null;
  nickname: string | null;
  post_count: number;
  comment_count: number;
  checkin_count: number;
  last_checkin_at: string;
  handled_at: string | null;
  handled_by: string | null;
  staff_note: string | null;
  answered_questions: unknown;
  lv: string | null;
  like_count: number | null;
  kicked_at: string | null;
  kicked_by: string | null;
  banned_at: string | null;
  banned_by: string | null;
  block_reason?: string | null;
  kick_reason?: string | null;
  ban_reason?: string | null;
};

type UserLevelRow = {
  id: string;
  lv: number;
  name: string;
  icon: string | null;
  iconUrl: string;
};

type UserRow = {
  email: string | null;
  avatar: string | null;
  membership: UserMembershipRow;
  level: UserLevelRow | null;
};

type UsersResponse = {
  ok?: boolean;
  siteName?: string;
  users?: UserRow[];
  error?: string;
};

type ManageLevelRow = {
  id: string;
  lv: number;
  icon: string | null;
  icon_url: string;
  name: string | null;
  description: string | null;
  requirement_type: 'manual' | 'automatic';
  required_posts: number;
  required_comments: number;
  required_checkins: number;
  required_days: number;
  required_likes: number;
};

type LevelsResponse = {
  ok?: boolean;
  enabled?: boolean;
  levels?: ManageLevelRow[];
  error?: string;
};

type SearchMethod = 'nickname' | 'detail';
type DetailSearchType = 'post_count' | 'comment_count' | 'checkin_count' | 'date';
type CountPeriod = 'all' | 'recent_1month' | 'custom';
type CountCompare = 'gte' | 'lte';
type DateSearchType = 'approval_at' | 'last_checkin_at';
type ActionType = 'block' | 'kick' | 'ban' | null;

type AppliedSearch =
  | {
      method: 'nickname';
      keyword: string;
    }
  | {
      method: 'detail';
      detailType: 'post_count' | 'comment_count' | 'checkin_count';
      period: CountPeriod;
      compare: CountCompare;
      count: number;
      startDate: Date | null;
      endDate: Date | null;
    }
  | {
      method: 'detail';
      detailType: 'date';
      dateType: DateSearchType;
      startDate: Date | null;
      endDate: Date | null;
    }
  | null;

function getDisplayNickname(user: UserRow) {
  return user.membership.nickname || user.email || '';
}

function getNormalizedKeyword(value: string) {
  return normalizeText(value).toLowerCase();
}

function toDayStart(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function toDayEnd(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function toDateValue(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function getRecentOneMonthRange() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - 1);

  return {
    startDate: toDayStart(startDate),
    endDate: toDayEnd(endDate),
  };
}

function getCountValueByType(user: UserRow, detailType: 'post_count' | 'comment_count' | 'checkin_count') {
  if (detailType === 'post_count') {
    return Number(user.membership.post_count ?? 0);
  }

  if (detailType === 'comment_count') {
    return Number(user.membership.comment_count ?? 0);
  }

  return Number(user.membership.checkin_count ?? 0);
}

export default function Opt() {
  const params = useParams();
  const siteName = normalizeText(params.siteName).toLowerCase();

  const [users, setUsers] = useState<UserRow[]>([]);
  const [levels, setLevels] = useState<ManageLevelRow[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const [searchMethod, setSearchMethod] = useState<SearchMethod>('nickname');
  const [nicknameKeyword, setNicknameKeyword] = useState('');

  const [detailSearchType, setDetailSearchType] = useState<DetailSearchType>('post_count');
  const [countPeriod, setCountPeriod] = useState<CountPeriod>('all');
  const [countCompare, setCountCompare] = useState<CountCompare>('gte');
  const [countValue, setCountValue] = useState('0');
  const [countStartDate, setCountStartDate] = useState<Date | null>(null);
  const [countEndDate, setCountEndDate] = useState<Date | null>(null);

  const [dateSearchType, setDateSearchType] = useState<DateSearchType>('approval_at');
  const [dateStartDate, setDateStartDate] = useState<Date | null>(null);
  const [dateEndDate, setDateEndDate] = useState<Date | null>(null);

  const [appliedSearch, setAppliedSearch] = useState<AppliedSearch>(null);
  const [selectedLevelId, setSelectedLevelId] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isLevelChanging, setIsLevelChanging] = useState(false);
  const [isActionSubmitting, setIsActionSubmitting] = useState(false);
  const [isLevelChangeDialogOpen, setIsLevelChangeDialogOpen] = useState(false);

  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionReason, setActionReason] = useState('');

  const [errorMessage, setErrorMessage] = useState('');
  const [dialogErrorMessage, setDialogErrorMessage] = useState('');
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  async function loadUsers() {
    const response = await fetch(`/api/users/${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as UsersResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '멤버 목록을 불러오지 못했습니다.');
    }

    setUsers(Array.isArray(result.users) ? result.users : []);
  }

  async function loadLevels() {
    const response = await fetch(`/api/manage/members/levels?siteName=${siteName}`, {
      method: 'GET',
      credentials: 'include',
    });

    const result = (await response.json()) as LevelsResponse;

    if (!response.ok) {
      throw new Error(result.error ?? '등급 정보를 불러오지 못했습니다.');
    }

    const nextLevels = Array.isArray(result.levels) ? result.levels : [];
    setLevels(nextLevels);
  }

  async function loadAll() {
    setErrorMessage('');
    await Promise.all([loadUsers(), loadLevels()]);
  }

  useEffect(() => {
    async function init() {
      try {
        await loadAll();
      } catch (unknownError) {
        if (unknownError instanceof Error) {
          setErrorMessage(unknownError.message || '멤버 정보를 불러오지 못했습니다.');
        } else {
          setErrorMessage('멤버 정보를 불러오지 못했습니다.');
        }
      } finally {
        setIsLoading(false);
      }
    }

    void init();
  }, [siteName]);

  const selectableLevels = useMemo(() => {
    const sortedLevels = [...levels].sort((a, b) => a.lv - b.lv);
    const hasAnyName = sortedLevels.some((level) => Boolean(normalizeText(level.name)));

    if (!hasAnyName) {
      return sortedLevels.map((level) => ({
        id: level.id,
        label: String(level.lv),
      }));
    }

    return sortedLevels
      .filter((level) => Boolean(normalizeText(level.name)))
      .map((level) => ({
        id: level.id,
        label: normalizeText(level.name),
      }));
  }, [levels]);

  useEffect(() => {
    if (selectableLevels.length === 0) {
      setSelectedLevelId('');
      return;
    }

    setSelectedLevelId((previousValue) => {
      if (previousValue && selectableLevels.some((level) => level.id === previousValue)) {
        return previousValue;
      }

      return selectableLevels[0].id;
    });
  }, [selectableLevels]);

  const filteredUsers = useMemo(() => {
    if (!appliedSearch) {
      return users;
    }

    if (appliedSearch.method === 'nickname') {
      const keyword = getNormalizedKeyword(appliedSearch.keyword);

      if (!keyword) {
        return users;
      }

      return users.filter((user) => getNormalizedKeyword(getDisplayNickname(user)).includes(keyword));
    }

    if (appliedSearch.detailType === 'date') {
      const startTime = appliedSearch.startDate ? toDayStart(appliedSearch.startDate).getTime() : null;
      const endTime = appliedSearch.endDate ? toDayEnd(appliedSearch.endDate).getTime() : null;

      return users.filter((user) => {
        const targetValue =
          appliedSearch.dateType === 'approval_at' ? user.membership.approval_at : user.membership.last_checkin_at;

        const targetDate = toDateValue(targetValue);

        if (!targetDate) {
          return false;
        }

        const targetTime = targetDate.getTime();

        if (startTime !== null && targetTime < startTime) {
          return false;
        }

        if (endTime !== null && targetTime > endTime) {
          return false;
        }

        return true;
      });
    }

    let periodStartTime: number | null = null;
    let periodEndTime: number | null = null;

    if (appliedSearch.period === 'recent_1month') {
      const recentRange = getRecentOneMonthRange();
      periodStartTime = recentRange.startDate.getTime();
      periodEndTime = recentRange.endDate.getTime();
    }

    if (appliedSearch.period === 'custom') {
      periodStartTime = appliedSearch.startDate ? toDayStart(appliedSearch.startDate).getTime() : null;
      periodEndTime = appliedSearch.endDate ? toDayEnd(appliedSearch.endDate).getTime() : null;
    }

    return users.filter((user) => {
      if (appliedSearch.period !== 'all') {
        const targetDate =
          appliedSearch.detailType === 'post_count'
            ? toDateValue(user.membership.approval_at)
            : appliedSearch.detailType === 'comment_count'
              ? toDateValue(user.membership.approval_at)
              : toDateValue(user.membership.last_checkin_at);

        if (!targetDate) {
          return false;
        }

        const targetTime = targetDate.getTime();

        if (periodStartTime !== null && targetTime < periodStartTime) {
          return false;
        }

        if (periodEndTime !== null && targetTime > periodEndTime) {
          return false;
        }
      }

      const targetCount = getCountValueByType(user, appliedSearch.detailType);

      if (appliedSearch.compare === 'gte') {
        return targetCount >= appliedSearch.count;
      }

      return targetCount <= appliedSearch.count;
    });
  }, [appliedSearch, users]);

  const allFilteredSelected =
    filteredUsers.length > 0 && filteredUsers.every((user) => selectedUserIds.includes(user.membership.user_id));

  function handleSearchMethodChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value === 'detail' ? 'detail' : 'nickname';
    setSearchMethod(nextValue);
  }

  function handleNicknameKeywordChange(event: TextFieldChangeEvent) {
    setNicknameKeyword(event.currentTarget.value);
  }

  function handleDetailSearchTypeChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value;

    if (
      nextValue !== 'post_count' &&
      nextValue !== 'comment_count' &&
      nextValue !== 'checkin_count' &&
      nextValue !== 'date'
    ) {
      return;
    }

    setDetailSearchType(nextValue);
  }

  function handleCountPeriodChange(event: SelectChangeEvent<CountPeriod>) {
    setCountPeriod(event.target.value as CountPeriod);
  }

  function handleCountCompareChange(event: SelectChangeEvent<CountCompare>) {
    setCountCompare(event.target.value as CountCompare);
  }

  function handleCountValueChange(event: TextFieldChangeEvent) {
    setCountValue(event.currentTarget.value);
  }

  function handleDateSearchTypeChange(event: InputChangeEvent) {
    const nextValue = event.currentTarget.value === 'last_checkin_at' ? 'last_checkin_at' : 'approval_at';
    setDateSearchType(nextValue);
  }

  function handleLevelSelectChange(event: SelectChangeEvent<string>) {
    setSelectedLevelId(event.target.value);
  }

  function handleToggleAll(event: InputChangeEvent) {
    if (event.currentTarget.checked) {
      setSelectedUserIds((previousUserIds) => {
        const nextUserIds = new Set(previousUserIds);

        filteredUsers.forEach((user) => {
          nextUserIds.add(user.membership.user_id);
        });

        return [...nextUserIds];
      });
      return;
    }

    const filteredUserIdSet = new Set(filteredUsers.map((user) => user.membership.user_id));
    setSelectedUserIds((previousUserIds) => previousUserIds.filter((userId) => !filteredUserIdSet.has(userId)));
  }

  function handleToggleUser(userId: string, checked: boolean) {
    if (checked) {
      setSelectedUserIds((previousUserIds) => [...new Set([...previousUserIds, userId])]);
      return;
    }

    setSelectedUserIds((previousUserIds) => previousUserIds.filter((targetUserId) => targetUserId !== userId));
  }

  function handleSearchNickname() {
    setErrorMessage('');
    setAppliedSearch({
      method: 'nickname',
      keyword: nicknameKeyword,
    });
    setSelectedUserIds([]);
    setIsSearchOpen(false);
  }

  function handleSearchDetail() {
    if (detailSearchType === 'date') {
      if (!dateStartDate || !dateEndDate) {
        setErrorMessage('시작 날짜와 종료 날짜를 입력해주세요.');
        return;
      }

      if (toDayStart(dateStartDate).getTime() > toDayEnd(dateEndDate).getTime()) {
        setErrorMessage('종료 날짜는 시작 날짜보다 빠를 수 없습니다.');
        return;
      }

      setErrorMessage('');
      setAppliedSearch({
        method: 'detail',
        detailType: 'date',
        dateType: dateSearchType,
        startDate: dateStartDate,
        endDate: dateEndDate,
      });
      setSelectedUserIds([]);
      setIsSearchOpen(false);
      return;
    }

    if (countPeriod === 'custom') {
      if (!countStartDate || !countEndDate) {
        setErrorMessage('시작 날짜와 종료 날짜를 입력해주세요.');
        return;
      }

      if (toDayStart(countStartDate).getTime() > toDayEnd(countEndDate).getTime()) {
        setErrorMessage('종료 날짜는 시작 날짜보다 빠를 수 없습니다.');
        return;
      }
    }

    const parsedCount = Number(countValue);

    setErrorMessage('');
    setAppliedSearch({
      method: 'detail',
      detailType: detailSearchType,
      period: countPeriod,
      compare: countCompare,
      count: Number.isFinite(parsedCount) && parsedCount >= 0 ? Math.floor(parsedCount) : 0,
      startDate: countPeriod === 'custom' ? countStartDate : null,
      endDate: countPeriod === 'custom' ? countEndDate : null,
    });
    setSelectedUserIds([]);
    setIsSearchOpen(false);
  }

  async function handleChangeLevel() {
    if (selectedUserIds.length === 0) {
      setErrorMessage('멤버를 선택해주세요.');
      return;
    }

    if (!selectedLevelId) {
      setErrorMessage('등급을 선택해주세요.');
      return;
    }

    try {
      setErrorMessage('');
      setIsLevelChanging(true);

      for (const userId of selectedUserIds) {
        const response = await fetch(`/api/users/${siteName}/${userId}/lv`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            lvId: selectedLevelId,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? '등급 변경에 실패했습니다.');
        }
      }

      await loadUsers();
      setSelectedUserIds([]);
      setSnackbarMessage('등급이 변경되었습니다.');
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setErrorMessage(unknownError.message || '등급 변경에 실패했습니다.');
      } else {
        setErrorMessage('등급 변경에 실패했습니다.');
      }
    } finally {
      setIsLevelChanging(false);
    }
  }

  function handleOpenActionDialog(nextActionType: Exclude<ActionType, null>) {
    if (selectedUserIds.length === 0) {
      setErrorMessage('멤버를 선택해주세요.');
      return;
    }

    setDialogErrorMessage('');
    setActionReason('');
    setActionType(nextActionType);
  }

  function handleCloseActionDialog() {
    if (isActionSubmitting) {
      return;
    }

    setDialogErrorMessage('');
    setActionReason('');
    setActionType(null);
  }

  function getActionTitle() {
    if (actionType === 'block') {
      return '활동 정지';
    }

    if (actionType === 'kick') {
      return '강제 탈퇴';
    }

    if (actionType === 'ban') {
      return '가입 불가';
    }

    return '';
  }

  function getActionReasonLabel() {
    if (actionType === 'block') {
      return '활동정지 사유';
    }

    if (actionType === 'kick') {
      return '강제탈퇴 사유';
    }

    if (actionType === 'ban') {
      return '가입불가 사유';
    }

    return '';
  }

  async function handleSubmitAction() {
    if (!actionType) {
      return;
    }

    const trimmedReason = normalizeText(actionReason);

    if (!trimmedReason) {
      setDialogErrorMessage(`${getActionReasonLabel()}를 입력해주세요.`);
      return;
    }

    try {
      setDialogErrorMessage('');
      setErrorMessage('');
      setIsActionSubmitting(true);

      for (const userId of selectedUserIds) {
        const response = await fetch(`/api/users/${siteName}/${userId}/${actionType}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            reason: trimmedReason,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error ?? `${getActionTitle()} 처리에 실패했습니다.`);
        }
      }

      await loadUsers();
      setSelectedUserIds([]);
      setActionType(null);
      setActionReason('');
      setSnackbarMessage(`${getActionTitle()} 처리되었습니다.`);
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        setDialogErrorMessage(unknownError.message || `${getActionTitle()} 처리에 실패했습니다.`);
      } else {
        setDialogErrorMessage(`${getActionTitle()} 처리에 실패했습니다.`);
      }
    } finally {
      setIsActionSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Container pageTitle="활동 멤버 관리" pageBack={`/${siteName}/manage`} menu="members">
        <div className={`container ${styles.container}`}>
          <div className={`${styles.content} content`}>
            <div className={`paper ${styles.paper}`}>
              <div className="loading-container">
                <LoadingIndicator />
              </div>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  const searchContent = (
    <Stack spacing={2}>
      <Stack spacing={1}>
        <Typography variant="subtitle2">검색 방법</Typography>
        <RadioGroup row value={searchMethod} onChange={handleSearchMethodChange}>
          <FormControlLabel value="nickname" control={<Radio />} label="별명 검색" />
          <FormControlLabel value="detail" control={<Radio />} label="상세 검색" />
        </RadioGroup>
      </Stack>

      {searchMethod === 'nickname' ? (
        <Stack direction="column" spacing={3}>
          <Stack direction="column" spacing={1.5} sx={{ flex: '1 0 0%' }}>
            <Typography variant="subtitle2">별명 검색</Typography>
            <TextField
              placeholder="별명 검색"
              value={nicknameKeyword}
              onChange={handleNicknameKeywordChange}
              fullWidth
              size="small"
            />
          </Stack>
          <button type="button" className="button medium submit" onClick={handleSearchNickname}>
            검색
          </button>
        </Stack>
      ) : null}

      {searchMethod === 'detail' ? (
        <Stack spacing={1}>
          <Stack spacing={1}>
            <Typography variant="subtitle2">상세 검색</Typography>
            <RadioGroup row value={detailSearchType} onChange={handleDetailSearchTypeChange}>
              <FormControlLabel value="post_count" control={<Radio />} label="게시글 수" />
              <FormControlLabel value="comment_count" control={<Radio />} label="댓글 수" />
              <FormControlLabel value="checkin_count" control={<Radio />} label="방문 수" />
              <FormControlLabel value="date" control={<Radio />} label="가입/최종방문일" />
            </RadioGroup>
          </Stack>

          {detailSearchType === 'post_count' ||
          detailSearchType === 'comment_count' ||
          detailSearchType === 'checkin_count' ? (
            <Stack spacing={3} direction="column">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Stack direction="column" spacing={1.5} sx={{ width: '100%' }}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Select value={countPeriod} onChange={handleCountPeriodChange} size="small" fullWidth>
                      <MenuItem value="all">
                        {countPeriod === 'all' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        전체 기간
                      </MenuItem>
                      <MenuItem value="recent_1month">
                        {countPeriod === 'recent_1month' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        최근 1개월
                      </MenuItem>
                      <MenuItem value="custom">
                        {countPeriod === 'custom' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        기간 선택
                      </MenuItem>
                    </Select>
                    <Typography variant="body2">동안</Typography>
                  </Stack>

                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                      {detailSearchType === 'post_count'
                        ? '게시글 수'
                        : detailSearchType === 'comment_count'
                          ? '댓글 수'
                          : '방문 수'}
                    </Typography>
                    <TextField value={countValue} onChange={handleCountValueChange} size="small" fullWidth />
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                      {detailSearchType === 'checkin_count' ? '회' : '개'}
                    </Typography>
                    <Select value={countCompare} onChange={handleCountCompareChange} size="small">
                      <MenuItem value="gte">
                        {countCompare === 'gte' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        이상
                      </MenuItem>
                      <MenuItem value="lte">
                        {countCompare === 'lte' ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        이하
                      </MenuItem>
                    </Select>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                      인 멤버
                    </Typography>
                  </Stack>
                </Stack>

                {countPeriod === 'custom' ? (
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <DatePicker
                      value={countStartDate}
                      onChange={setCountStartDate}
                      slotProps={{
                        textField: {
                          size: 'small',
                        },
                      }}
                    />
                    <Typography variant="body2">부터</Typography>
                    <DatePicker
                      value={countEndDate}
                      onChange={setCountEndDate}
                      slotProps={{
                        textField: {
                          size: 'small',
                        },
                      }}
                    />
                    <Typography variant="body2">까지</Typography>
                  </Stack>
                ) : null}
              </Stack>
              <button type="button" className="button medium submit" onClick={handleSearchDetail}>
                검색
              </button>
            </Stack>
          ) : null}

          {detailSearchType === 'date' ? (
            <Stack spacing={3} direction="column" sx={{ marginTop: '0!important' }}>
              <Stack spacing={1.5}>
                <RadioGroup row value={dateSearchType} onChange={handleDateSearchTypeChange}>
                  <FormControlLabel value="approval_at" control={<Radio />} label="가입일" />
                  <FormControlLabel value="last_checkin_at" control={<Radio />} label="최종방문일" />
                </RadioGroup>

                <Stack direction="column" spacing={1.5}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <DatePicker
                      value={dateStartDate}
                      onChange={setDateStartDate}
                      slotProps={{
                        textField: {
                          size: 'small',
                        },
                      }}
                    />
                    <Typography variant="body2">부터</Typography>
                    <DatePicker
                      value={dateEndDate}
                      onChange={setDateEndDate}
                      slotProps={{
                        textField: {
                          size: 'small',
                        },
                      }}
                    />
                  </Stack>
                </Stack>
              </Stack>
              <button type="button" className="button medium submit" onClick={handleSearchDetail}>
                검색
              </button>
            </Stack>
          ) : null}
        </Stack>
      ) : null}
    </Stack>
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ko}>
      <Container pageTitle="활동 멤버 관리" pageBack={`/${siteName}/manage`} menu="members">
        <div className={`container ${styles.container}`}>
          <div className={`content ${styles.content} ${styles['content-manage']}`}>
            {errorMessage ? <div className={`paper paper-error ${styles.paper}`}>{errorMessage}</div> : null}

            {isMobile ? (
              <Drawer
                anchor="bottom"
                open={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                className="VhiDrawer-bottom"
              >
                <h2>멤버 검색</h2>
                <button className="close-button" onClick={() => setIsSearchOpen(false)} aria-label="검색창 닫기">
                  <CloseRoundedIcon />
                </button>
                {searchContent}
              </Drawer>
            ) : (
              <Dialog
                open={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                fullWidth
                maxWidth="sm"
                className="VhiDialog"
              >
                <DialogTitle>멤버 검색</DialogTitle>
                <button className="close-button" onClick={() => setIsSearchOpen(false)} aria-label="검색창 닫기">
                  <CloseRoundedIcon />
                </button>
                <DialogContent>{searchContent}</DialogContent>
              </Dialog>
            )}

            <Stack justifyContent="space-between" direction="row" alignItems="center" sx={{ p: 2 }}>
              <Typography variant="h6" component="h2">
                커뮤니티 멤버 수 {filteredUsers.length}명
              </Typography>
              <div>
                <button
                  type="button"
                  className="button medium action"
                  aria-label="검색"
                  onClick={() => setIsSearchOpen(true)}
                >
                  <SearchRoundedIcon sx={{ width: 20, height: 20 }} />
                </button>
              </div>
            </Stack>

            <div className={`paper ${styles.paper}`}>
              <Stack direction="column" spacing={1.5}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                    선택 멤버를
                  </Typography>
                  <Select
                    value={actionType ?? ''}
                    onChange={(event: SelectChangeEvent<string>) => {
                      const nextActionType = event.target.value;

                      if (nextActionType === 'block' || nextActionType === 'kick' || nextActionType === 'ban') {
                        handleOpenActionDialog(nextActionType);
                      }
                    }}
                    displayEmpty
                    size="small"
                    disabled={isActionSubmitting}
                    fullWidth
                  >
                    <MenuItem value="">
                      {actionType === null ? (
                        <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                      ) : (
                        <i style={{ width: 14, height: 14, marginRight: 8 }} />
                      )}
                      활동상태 선택
                    </MenuItem>
                    <MenuItem value="block">
                      {actionType === 'block' ? (
                        <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                      ) : (
                        <i style={{ width: 14, height: 14, marginRight: 8 }} />
                      )}
                      활동 정지
                    </MenuItem>
                    <MenuItem value="kick">
                      {actionType === 'kick' ? (
                        <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                      ) : (
                        <i style={{ width: 14, height: 14, marginRight: 8 }} />
                      )}
                      강제 탈퇴
                    </MenuItem>
                    <MenuItem value="ban">
                      {actionType === 'ban' ? (
                        <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                      ) : (
                        <i style={{ width: 14, height: 14, marginRight: 8 }} />
                      )}
                      가입 불가
                    </MenuItem>
                  </Select>
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                    하거나
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                    또는
                  </Typography>
                  <Select value={selectedLevelId} onChange={handleLevelSelectChange} size="small" fullWidth>
                    {selectableLevels.map((level) => (
                      <MenuItem key={level.id} value={level.id}>
                        {selectedLevelId === level.id ? (
                          <CheckRoundedIcon sx={{ width: 14, height: 14, marginRight: 1 }} />
                        ) : (
                          <i style={{ width: 14, height: 14, marginRight: 8 }} />
                        )}
                        {level.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                    (으)로
                  </Typography>
                  <button
                    type="button"
                    className="button medium action"
                    onClick={() => {
                      if (selectedUserIds.length === 0) {
                        setErrorMessage('멤버를 선택해주세요.');
                        return;
                      }

                      if (!selectedLevelId) {
                        setErrorMessage('등급을 선택해주세요.');
                        return;
                      }

                      setErrorMessage('');
                      setIsLevelChangeDialogOpen(true);
                    }}
                    disabled={isLevelChanging}
                  >
                    변경
                  </button>
                  {isMobile ? (
                    <Drawer
                      anchor="bottom"
                      open={isLevelChangeDialogOpen}
                      onClose={() => {
                        if (!isLevelChanging) {
                          setIsLevelChangeDialogOpen(false);
                        }
                      }}
                      className="VhiDrawer-bottom"
                    >
                      <h2>등급 변경</h2>
                      <button
                        type="button"
                        className="close-button"
                        onClick={() => setIsLevelChangeDialogOpen(false)}
                        aria-label="등급 변경창 닫기"
                        disabled={isLevelChanging}
                      >
                        <CloseRoundedIcon />
                      </button>

                      <Stack spacing={3}>
                        <Typography variant="body2">정말로 등급을 변경하시겠어요?</Typography>
                        <Stack direction="column" spacing={1.5}>
                          <button
                            type="button"
                            className="button medium cancel"
                            onClick={() => setIsLevelChangeDialogOpen(false)}
                            disabled={isLevelChanging}
                          >
                            취소
                          </button>
                          <button
                            type="button"
                            className="button medium submit"
                            onClick={() => void handleChangeLevel()}
                            disabled={isLevelChanging}
                          >
                            변경
                          </button>
                        </Stack>
                      </Stack>
                    </Drawer>
                  ) : (
                    <Dialog
                      open={isLevelChangeDialogOpen}
                      onClose={() => {
                        if (!isLevelChanging) {
                          setIsLevelChangeDialogOpen(false);
                        }
                      }}
                      fullWidth
                      maxWidth="xs"
                      className="VhiDialog"
                    >
                      <DialogTitle>등급 변경</DialogTitle>
                      <button
                        type="button"
                        className="close-button"
                        onClick={() => setIsLevelChangeDialogOpen(false)}
                        aria-label="등급 변경창 닫기"
                        disabled={isLevelChanging}
                      >
                        <CloseRoundedIcon />
                      </button>
                      <DialogContent>
                        <Typography variant="body2">정말로 등급을 변경하시겠어요?</Typography>
                      </DialogContent>
                      <DialogActions>
                        <button
                          type="button"
                          className="button medium close"
                          onClick={() => setIsLevelChangeDialogOpen(false)}
                          disabled={isLevelChanging}
                        >
                          취소
                        </button>
                        <button
                          type="button"
                          className="button medium submit"
                          onClick={() => void handleChangeLevel()}
                          disabled={isLevelChanging}
                        >
                          변경
                        </button>
                      </DialogActions>
                    </Dialog>
                  )}
                </Stack>
              </Stack>
            </div>

            <div className={`paper ${styles.paper}`}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox checked={allFilteredSelected} onChange={handleToggleAll} />
                    </TableCell>
                    <TableCell>별명</TableCell>
                    <TableCell>멤버 등급</TableCell>
                    <TableCell>가입일</TableCell>
                    <TableCell>최종방문일</TableCell>
                    <TableCell>방문수</TableCell>
                    <TableCell>게시글수</TableCell>
                    <TableCell>댓글수</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.membership.user_id}>
                      <TableCell padding="checkbox">
                        <Checkbox
                          checked={selectedUserIds.includes(user.membership.user_id)}
                          onChange={(event) => handleToggleUser(user.membership.user_id, event.currentTarget.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <Avatar src={user.avatar ?? '/default-avatar.png'} alt={getDisplayNickname(user)} />
                          <Typography>{getDisplayNickname(user)}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {user.membership.role !== '멤버' ? (
                          <Typography variant="body2">{user.membership.role}</Typography>
                        ) : user.level ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            {user.level.iconUrl ? (
                              <Box
                                component="img"
                                src={user.level.iconUrl}
                                alt={user.level.name}
                                sx={{ width: 20, height: 20, objectFit: 'contain', display: 'block' }}
                              />
                            ) : null}
                            <Typography variant="body2">{user.level.name}</Typography>
                          </Stack>
                        ) : null}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {user.membership.approval_at ? formatDate(user.membership.approval_at) : ''}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {user.membership.last_checkin_at ? formatDate(user.membership.last_checkin_at) : ''}
                      </TableCell>
                      <TableCell>{user.membership.checkin_count}</TableCell>
                      <TableCell>{user.membership.post_count}</TableCell>
                      <TableCell>{user.membership.comment_count}</TableCell>
                    </TableRow>
                  ))}

                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        검색 결과가 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </div>

            <Dialog open={Boolean(actionType)} onClose={handleCloseActionDialog} fullWidth maxWidth="sm">
              <DialogTitle>{getActionTitle()}</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <TextField
                    label={getActionReasonLabel()}
                    value={actionReason}
                    onChange={(event) => setActionReason(event.currentTarget.value)}
                    fullWidth
                    multiline
                    minRows={4}
                    size="small"
                  />

                  {dialogErrorMessage ? (
                    <Alert severity="error" variant="filled">
                      {dialogErrorMessage}
                    </Alert>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={handleCloseActionDialog}
                  disabled={isActionSubmitting}
                >
                  취소
                </Button>
                <Button type="button" variant="contained" onClick={handleSubmitAction} disabled={isActionSubmitting}>
                  확인
                </Button>
              </DialogActions>
            </Dialog>

            <Snackbar
              open={Boolean(snackbarMessage)}
              autoHideDuration={2500}
              onClose={() => setSnackbarMessage('')}
              message={snackbarMessage}
            />
          </div>
        </div>
      </Container>
    </LocalizationProvider>
  );
}
