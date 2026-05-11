import { Stack, Typography } from '@mui/material';
import SiteInfo from '@/components/service/community/SiteInfo';
import UserInfo from '@/components/service/community/UserInfo';
import TableList from '@/components/service/community/TableList';
import PostCountTableList from '@/components/service/community/PostCountTableList';

type RowValue = string | number | boolean | null;

type SitesInfo = {
  rhizomes: {
    created_at: RowValue;
    site_label: RowValue;
    profile_picture: RowValue;
    summary: RowValue;
    site_type: RowValue;
    plan_type: RowValue;
    visibility_type: RowValue;
    theme_type: RowValue;
    is_shutdown: RowValue;
  };
  sites: {
    updated_at: RowValue;
    updated_by: RowValue;
  };
};

type CommunityInfo = {
  created_at: RowValue;
  join_type: RowValue;
  policy_post: RowValue;
  policy_comment: RowValue;
};

type Props = {
  sitesInfo: SitesInfo;
  communityInfo: CommunityInfo;
};

export default function Community({ sitesInfo, communityInfo }: Props) {
  return (
    <main>
      <div className="container">
        <aside>
          <SiteInfo />
          <TableList />
        </aside>
        <div className="content">
          <Stack spacing={1.5}>
            <Typography>{String(sitesInfo.rhizomes.created_at)}</Typography>
            <Typography>{sitesInfo.rhizomes.site_label ? String(sitesInfo.rhizomes.site_label) : ''}</Typography>
            <Typography>
              {sitesInfo.rhizomes.profile_picture ? String(sitesInfo.rhizomes.profile_picture) : ''}
            </Typography>
            <Typography>{sitesInfo.rhizomes.summary ? String(sitesInfo.rhizomes.summary) : ''}</Typography>
            <Typography>{String(sitesInfo.rhizomes.site_type)}</Typography>
            <Typography>{String(sitesInfo.rhizomes.visibility_type)}</Typography>
            <Typography>{String(sitesInfo.rhizomes.theme_type)}</Typography>
            <Typography>{String(sitesInfo.rhizomes.is_shutdown)}</Typography>
            <Typography>{String(sitesInfo.sites.updated_at)}</Typography>
            <Typography>{String(communityInfo.join_type)}</Typography>
            <Typography>{String(communityInfo.policy_post)}</Typography>
            <Typography>{String(communityInfo.policy_comment)}</Typography>
          </Stack>
        </div>
        <aside>
          <UserInfo />
          <PostCountTableList />
        </aside>
      </div>
    </main>
  );
}
