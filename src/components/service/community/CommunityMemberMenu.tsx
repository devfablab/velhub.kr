'use client';

import { useState, type KeyboardEvent, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import {
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Dialog from '@mui/material/Dialog';
import { formatDate, formatDateTimeDetail } from '@/lib/utils';
import asideStyles from '@/app/aside.module.sass';
import boardStyles from '@/app/board.module.sass';

type MemberInfo = {
  activityName: string;
  nickname: string;
  joinedAt: string;
  approvedAt: string | null;
  lastLoginAt: string | null;
  visitCount: number;
  postCount: number;
  commentCount: number;
};

type Props = {
  siteName: string;
  name: string;
  boardName?: string | null;
  boardLabel?: string | null;
};

function isSameDate(first: string, second: string | null) {
  return Boolean(second) && formatDate(first) === formatDate(second);
}

export default function CommunityMemberMenu({ siteName, name, boardName, boardLabel }: Props) {
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'));
  const [anchorElement, setAnchorElement] = useState<HTMLElement | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [member, setMember] = useState<MemberInfo | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const hasBoard = Boolean(boardName && boardLabel);

  function preventParentNavigation(event: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) {
    event.preventDefault();
    event.stopPropagation();
  }

  function openMenu(event: MouseEvent<HTMLSpanElement>) {
    preventParentNavigation(event);
    setAnchorElement(event.currentTarget);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    preventParentNavigation(event);
    setAnchorElement(event.currentTarget);
  }

  async function openMemberInfo() {
    setAnchorElement(null);
    setIsDialogOpen(true);
    setErrorMessage('');
    setMember(null);

    try {
      const response = await fetch(`/api/users/${siteName}?memberName=${encodeURIComponent(name)}`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const result = (await response.json()) as { member?: MemberInfo; error?: string };

      if (!response.ok || !result.member) {
        throw new Error(result.error ?? '멤버 정보를 불러오지 못했습니다.');
      }

      setMember(result.member);
    } catch (unknownError) {
      setErrorMessage(unknownError instanceof Error ? unknownError.message : '멤버 정보를 불러오지 못했습니다.');
    }
  }

  function openBoardPosts() {
    setAnchorElement(null);
    router.push(`/${siteName}/${boardName}?author=${encodeURIComponent(name)}`);
  }

  function openAllPosts() {
    setAnchorElement(null);
    router.push(`/${siteName}/board?author=${encodeURIComponent(name)}`);
  }

  const detailContent = errorMessage ? (
    <p className="alert popup-error">{errorMessage}</p>
  ) : !member ? (
    <p>멤버 정보를 불러오는 중입니다.</p>
  ) : (
    <dl className={boardStyles['member-info-detail']}>
      <div>
        <dt>활동명</dt>
        <dd>{member.activityName}</dd>
      </div>
      {member.nickname ? (
        <div>
          <dt>별명</dt>
          <dd>{member.nickname}</dd>
        </div>
      ) : null}
      <div>
        <dt>가입일</dt>
        <dd>{formatDate(member.joinedAt)}</dd>
      </div>
      {member.approvedAt && !isSameDate(member.joinedAt, member.approvedAt) ? (
        <div>
          <dt>가입승인일</dt>
          <dd>{formatDate(member.approvedAt)}</dd>
        </div>
      ) : null}
      <div>
        <dt>마지막 로그인</dt>
        <dd>{member.lastLoginAt ? formatDateTimeDetail(member.lastLoginAt) : '기록 없음'}</dd>
      </div>
      <div>
        <dt>방문수</dt>
        <dd>{member.visitCount.toLocaleString()}회</dd>
      </div>
      <div>
        <dt>게시글수</dt>
        <dd>{member.postCount.toLocaleString()}개</dd>
      </div>
      <div>
        <dt>댓글수</dt>
        <dd>{member.commentCount.toLocaleString()}개</dd>
      </div>
    </dl>
  );

  return (
    <>
      <span
        className={boardStyles['member-menu-trigger']}
        role="button"
        tabIndex={0}
        onClick={openMenu}
        onKeyDown={handleKeyDown}
      >
        {name}
      </span>
      <Menu anchorEl={anchorElement} open={Boolean(anchorElement)} onClose={() => setAnchorElement(null)}>
        <MenuItem dense onClick={() => void openMemberInfo()}>
          <ListItemIcon>
            <AccountCircleOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>멤버 정보</ListItemText>
        </MenuItem>
        <MenuItem dense onClick={openAllPosts}>
          <ListItemIcon>
            <ViewListOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>전체 글 보기</ListItemText>
        </MenuItem>
        {hasBoard ? (
          <MenuItem dense onClick={openBoardPosts}>
            <ListItemIcon>
              <ArticleOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{`${boardLabel}에서 쓴 글 보기`}</ListItemText>
          </MenuItem>
        ) : null}
      </Menu>

      {isMobile ? (
        <Drawer anchor="bottom" open={isDialogOpen} onClose={() => setIsDialogOpen(false)} className="VhiDrawer-bottom">
          <h2>멤버 정보</h2>
          <button type="button" className="close-button" onClick={() => setIsDialogOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <div
            className={`VhiDrawer-bottom-content ${asideStyles['info-content']} ${boardStyles['member-info-dialog']}`}
          >
            {detailContent}
          </div>
          <div className="drawer-dialog-actions">
            <button type="button" className="button medium close" onClick={() => setIsDialogOpen(false)}>
              닫기
            </button>
          </div>
        </Drawer>
      ) : (
        <Dialog
          open={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          fullWidth
          maxWidth="xs"
          className={`VhiDialog ${asideStyles['info-dialog']}`}
        >
          <DialogTitle>멤버 정보</DialogTitle>
          <button type="button" className="close-button" onClick={() => setIsDialogOpen(false)} aria-label="닫기">
            <CloseRoundedIcon />
          </button>
          <DialogContent className={`${asideStyles['info-content']} ${boardStyles['member-info-dialog']}`}>
            {detailContent}
          </DialogContent>
          <DialogActions>
            <button type="button" className="button medium submit" onClick={() => setIsDialogOpen(false)}>
              닫기
            </button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
}
