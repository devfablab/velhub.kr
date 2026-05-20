import { useParams } from 'next/navigation';
import { Fab, useMediaQuery, useTheme } from '@mui/material';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { normalizeText } from '@/lib/utils';

type Props = {
  isBlog?: boolean;
};

export default function FabNew({ isBlog }: Props) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  if (!isMobile) return null;
  const href = isBlog
    ? `/${siteName}/manage/contents/posts/new`
    : boardName
      ? `/${siteName}/${boardName}/new`
      : `/${siteName}/board/new`;

  return (
    <div className="fab">
      <Fab aria-label="새글 쓰기" href={href} size="medium">
        <EditRoundedIcon />
      </Fab>
    </div>
  );
}
