import { useParams } from 'next/navigation';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { Fab, useMediaQuery, useTheme } from '@mui/material';
import { normalizeText } from '@/lib/utils';

type Props = {
  isCommunity: boolean;
};

export default function FabNew({ isCommunity }: Props) {
  const params = useParams();
  const siteName = normalizeText(params.siteName);
  const boardName = normalizeText(params.boardName);
  const theme = useTheme();
  const isNotMobile = useMediaQuery(theme.breakpoints.up('lg'));
  const isMobile = !isNotMobile;

  if (!isMobile) return null;
  const href = !isCommunity
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
