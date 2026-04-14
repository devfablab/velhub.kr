import Breadcrumbs from '@mui/material/Breadcrumbs';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

type CurrentValue = 'fonts' | 'menu' | 'links' | 'team';

type Props = {
  siteName: string;
  current: CurrentValue;
};

export default function BlogDesignBreadcrumb({ siteName, current }: Props) {
  return (
    <Breadcrumbs>
      {current === 'fonts' ? (
        <Typography>기본 서체 설정</Typography>
      ) : (
        <Link href={`/${siteName}/design/blog/fonts`} underline="hover">
          기본 서체 설정
        </Link>
      )}

      {current === 'menu' ? (
        <Typography>메뉴 설정</Typography>
      ) : (
        <Link href={`/${siteName}/design/blog/menu`} underline="hover">
          메뉴 설정
        </Link>
      )}

      {current === 'links' ? (
        <Typography>링크 설정</Typography>
      ) : (
        <Link href={`/${siteName}/design/blog/links`} underline="hover">
          링크 설정
        </Link>
      )}
    </Breadcrumbs>
  );
}
