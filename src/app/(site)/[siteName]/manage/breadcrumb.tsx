import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

type Props = {
  siteName: string;
  current: 'general' | 'advanced';
};

export default function SiteManageBreadcrumb({ siteName, current }: Props) {
  return (
    <Breadcrumbs>
      {current === 'general' ? (
        <Typography>기본설정</Typography>
      ) : (
        <Link href={`/${siteName}/manage/general`} underline="hover" color="inherit">
          기본설정
        </Link>
      )}

      {current === 'advanced' ? (
        <Typography>추가설정</Typography>
      ) : (
        <Link href={`/${siteName}/manage/advanced`} underline="hover" color="inherit">
          추가설정
        </Link>
      )}
    </Breadcrumbs>
  );
}
