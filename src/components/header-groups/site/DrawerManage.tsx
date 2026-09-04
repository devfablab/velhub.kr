import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ContactsOutlinedIcon from '@mui/icons-material/ContactsOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import InterestsRoundedIcon from '@mui/icons-material/InterestsRounded';
import ListOutlinedIcon from '@mui/icons-material/ListOutlined';
import ManageAccountsOutlinedIcon from '@mui/icons-material/ManageAccountsOutlined';
import QueryStatsOutlinedIcon from '@mui/icons-material/QueryStatsOutlined';
import RememberMeOutlinedIcon from '@mui/icons-material/RememberMeOutlined';
import ReportOutlinedIcon from '@mui/icons-material/ReportOutlined';
import SellOutlinedIcon from '@mui/icons-material/SellOutlined';
import MenuItem from '@mui/material/MenuItem';
import Anchor from '@/components/Anchor';

type SiteType = 'blog' | 'community';

type Props = {
  siteName: string;
  siteType: SiteType | null;
  siteRole: string | null;
  globalRole: string | null;
  onClose: () => void;
};

function canAccessAllManageMenus(siteType: SiteType | null, siteRole: string | null, globalRole: string | null) {
  if (globalRole === 'admin') {
    return true;
  }

  if (siteType === 'blog') {
    return siteRole === 'owner' || siteRole === 'manager';
  }

  if (siteType === 'community') {
    return siteRole === 'owner' || siteRole === 'community-manager';
  }

  return false;
}

export default function DrawerManage({ siteName, siteType, siteRole, globalRole, onClose }: Props) {
  const showAllManageMenus = canAccessAllManageMenus(siteType, siteRole, globalRole);

  return (
    <>
      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/manage`}>
          <DashboardOutlinedIcon fontSize="small" />
          <span>관리 홈</span>
        </Anchor>
      </MenuItem>

      {showAllManageMenus ? (
        <MenuItem onClick={onClose}>
          <Anchor href={`/${siteName}/manage/settings`}>
            {siteType === 'blog' ? <ArticleOutlinedIcon fontSize="small" /> : <InterestsRoundedIcon fontSize="small" />}
            <span>{siteType === 'blog' ? '블로그 정보' : '커뮤니티 정보'}</span>
          </Anchor>
        </MenuItem>
      ) : null}

      {showAllManageMenus && siteType === 'community' ? (
        <MenuItem onClick={onClose}>
          <Anchor href={`/${siteName}/manage/join`}>
            <ContactsOutlinedIcon fontSize="small" />
            <span>가입 관리</span>
          </Anchor>
        </MenuItem>
      ) : null}

      {showAllManageMenus ? (
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
      ) : null}

      <MenuItem onClick={onClose}>
        <Anchor href={`/${siteName}/manage/contents/posts`}>
          <ListOutlinedIcon fontSize="small" />
          <span>콘텐츠 관리</span>
        </Anchor>
      </MenuItem>

      {showAllManageMenus ? (
        <>
          <MenuItem onClick={onClose}>
            <Anchor href={`/${siteName}/manage/reports`}>
              <ReportOutlinedIcon fontSize="small" />
              <span>신고 관리</span>
            </Anchor>
          </MenuItem>

          <MenuItem onClick={onClose}>
            <Anchor
              href={
                siteType === 'blog'
                  ? `/${siteName}/manage/design/blog/fonts`
                  : `/${siteName}/manage/design/community/home`
              }
            >
              <DesignServicesOutlinedIcon fontSize="small" />
              <span>디자인</span>
            </Anchor>
          </MenuItem>

          <MenuItem onClick={onClose}>
            <Anchor href={`/${siteName}/manage/payments`}>
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
      ) : null}
    </>
  );
}
