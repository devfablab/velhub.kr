import { Stack, Typography } from '@mui/material';

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

type BlogInfo = {
  created_at: RowValue;
  comment_provider: RowValue;
};

type Props = {
  sitesInfo: SitesInfo;
  blogInfo: BlogInfo;
};

export default function Blog({ sitesInfo, blogInfo }: Props) {
  return (
    <Stack spacing={1.5}>
      <Typography>{String(sitesInfo.rhizomes.created_at)}</Typography>
      <Typography>{sitesInfo.rhizomes.site_label ? String(sitesInfo.rhizomes.site_label) : ''}</Typography>
      <Typography>{sitesInfo.rhizomes.profile_picture ? String(sitesInfo.rhizomes.profile_picture) : ''}</Typography>
      <Typography>{sitesInfo.rhizomes.summary ? String(sitesInfo.rhizomes.summary) : ''}</Typography>
      <Typography>{String(sitesInfo.rhizomes.site_type)}</Typography>
      <Typography>{String(sitesInfo.rhizomes.visibility_type)}</Typography>
      <Typography>{String(sitesInfo.rhizomes.theme_type)}</Typography>
      <Typography>{String(sitesInfo.rhizomes.is_shutdown)}</Typography>
      <Typography>{String(sitesInfo.sites.updated_at)}</Typography>
      <Typography>{String(blogInfo.comment_provider)}</Typography>
    </Stack>
  );
}
