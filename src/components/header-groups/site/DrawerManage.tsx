import MenuItem from '@mui/material/MenuItem';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import RememberMeOutlinedIcon from '@mui/icons-material/RememberMeOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import ListOutlinedIcon from '@mui/icons-material/ListOutlined';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import InterestsRoundedIcon from '@mui/icons-material/InterestsRounded';
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import Anchor from '@/components/Anchor';

type SiteType = 'blog' | 'community';

type Props = {
  siteName: string;
  siteType: SiteType | null;
  onClose: () => void;
};

export default function DrawerManage({ siteName, siteType, onClose }: Props) {
  return (
    <>
      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/manage`}>
          <DashboardOutlinedIcon fontSize="small" />
          <span>관리 홈</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/manage/settings`}>
          {siteType === 'blog' ? <ArticleOutlinedIcon fontSize="small" /> : <InterestsRoundedIcon fontSize="small" />}
          <span>{siteType === 'blog' ? '블로그 정보' : '커뮤니티 정보'}</span>
        </Anchor>
      </MenuItem>

      {siteType === 'community' ? (
        <MenuItem onClick={onClose}>
          <Anchor href={`/${siteName}/manage/join`}>
            <ContactsOutlinedIcon fontSize="small" />
            <span>가입 관리</span>
          </Anchor>
        </MenuItem>
      ) : null}

      <MenuItem onClick={onClose}>
        <Anchor href={siteType === 'blog' ? `/${siteName}/manage/team` : `/${siteName}/manage/members`}>
          {siteType === 'blog' ? (
            <RememberMeOutlinedIcon fontSize="small" />
          ) : (
            <ManageAccountsOutlinedIcon fontSize="small" />
          )}
          <span>{siteType === 'blog' ? '팀원 관리' : '멤버 관리'}</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/manage/contents/posts`}>
          <ListOutlinedIcon fontSize="small" />
          <span>콘텐츠 관리</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/manage/reports`}>
          <ReportOutlinedIcon fontSize="small" />
          <span>신고 관리</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor
          href={
            siteType === 'blog' ? `/${siteName}/manage/design/blog/fonts` : `/${siteName}/manage/design/community/home`
          }
        >
          <DesignServicesOutlinedIcon fontSize="small" />
          <span>디자인</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/manage/payments/billing`}>
          <SellOutlinedIcon fontSize="small" />
          <span>결제</span>
        </Anchor>
      </MenuItem>

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/manage/stats`}>
          <QueryStatsOutlinedIcon fontSize="small" />
          <span>통계</span>
        </Anchor>
      </MenuItem>
    </>
  );
}
