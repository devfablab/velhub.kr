import { notFound } from 'next/navigation';
import ArrowBackIosRoundedIcon from '@mui/icons-material/ArrowBackIosRounded';
import ArrowForwardIosRoundedIcon from '@mui/icons-material/ArrowForwardIosRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { getPostList } from '@/lib/board/getPostList';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getCategoryPageMetadata } from '@/lib/seoSite';
import verifySession from '@/lib/session/verifySession';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import FabNew from '@/components/buttons/FabNew';
import OptimizedImage from '@/components/OptimizedImage';
import SiteProfile from '@/components/service/blog/SiteProfile';
import { ServiceNoDataIcon } from '@/components/Svgs';
import Container from '../../menu';
import styles from '@/app/board.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
    categoryName: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};

type CategoryRow = {
  id: string;
  category_key: string;
  category_label: string;
  summary: string | null;
  thumbnail_image: string | null;
  sort_order: number;
  board_id: string;
  site_id: string;
  boards:
    | {
        board_key: string;
        board_label: string;
      }[]
    | null;
};

const PAGE_SIZE = 9;
const PAGER_SIZE = 10;

function getPageNumbers(currentPage: number, totalPage: number) {
  const currentGroup = Math.floor((currentPage - 1) / PAGER_SIZE);
  const startPage = currentGroup * PAGER_SIZE + 1;
  const endPage = Math.min(startPage + PAGER_SIZE - 1, totalPage);

  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
}

function getPageNumber(value: string | undefined) {
  const pageNumber = Number(value);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return 1;
  }

  return pageNumber;
}

export async function generateMetadata(context: RouteContext) {
  const { siteName, categoryName } = await context.params;

  return getCategoryPageMetadata({
    siteName,
    categoryName,
    pagePath: `/c/${categoryName}`,
  });
}

export default async function Page(context: RouteContext) {
  const { siteName, categoryName } = await context.params;
  const searchParams = await context.searchParams;

  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const normalizedCategoryName = normalizeText(categoryName).toLowerCase();
  const currentPage = getPageNumber(searchParams.page);

  if (!normalizedSiteName || !normalizedCategoryName) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_key, site_label, site_type, visibility_type, is_shutdown')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizome.error || !rhizome.data) {
    notFound();
  }

  if (rhizome.data.site_type !== 'blog' || rhizome.data.is_shutdown !== false) {
    notFound();
  }

  const category = await supabaseAdmin
    .from('board_categories')
    .select(
      `
        id,
        category_key,
        category_label,
        summary,
        thumbnail_image,
        sort_order,
        board_id,
        site_id,
        boards (
          board_key,
          board_label
        )
      `,
    )
    .eq('site_id', rhizome.data.id)
    .eq('category_key', normalizedCategoryName)
    .maybeSingle();

  if (category.error || !category.data) {
    notFound();
  }

  const categoryData = category.data as CategoryRow;

  const postList = await getPostList({
    siteId: rhizome.data.id,
    siteKey: normalizedSiteName,
    siteType: rhizome.data.site_type,
    boardId: categoryData.board_id,
    page: currentPage,
    size: PAGE_SIZE,
    filter: 'all',
    sessionCase: 'guest',
    stigmaId: null,
    sort: 'latest',
    includePin: false,
    categoryId: categoryData.id,
  });
  const session = await verifySession({ siteId: rhizome.data.id });
  const canWritePost = session.case === 'member' || session.case === 'staff';
  const pageNumbers = getPageNumbers(currentPage, postList.totalPage);
  const getPageHref = (pageNumber: number) => `/${normalizedSiteName}/c/${normalizedCategoryName}?page=${pageNumber}`;

  return (
    <Container pageBack={`/${siteName}/c`} pageTitle={categoryData.category_label}>
      <div className="container">
        <div className={`content ${styles['blog-list']} ${styles.content}`}>
          <SiteProfile />
          <div className={styles.headline}>
            <h2>{categoryData.category_label}</h2>
            {categoryData.summary ? <p>{categoryData.summary}</p> : null}
          </div>
          <div className="paper">
            {postList.contents.length > 0 ? (
              <div className={styles['blog-items']}>
                {postList.contents.map((content) => (
                  <Anchor
                    href={`/${normalizedSiteName}/${content.board_key}/${content.slug}?categoryName=${categoryData.category_key}`}
                    key={content.id}
                  >
                    <div className={styles.thumbnail}>
                      <span>{content.published_status === 'draft' ? <em>(임시글)</em> : null}</span>
                      {content.thumbnail_image_url ? (
                        <OptimizedImage
                          src={content.thumbnail_image_url}
                          width={content.thumbnail_width ?? 1200}
                          height={content.thumbnail_height ?? 630}
                          sizes="(max-width: 575px) 100vw, 270px"
                        />
                      ) : (
                        <div className={styles.dummy}>
                          <MenuBookRoundedIcon />
                        </div>
                      )}
                    </div>
                    <div className={styles.info}>
                      <div className={styles.subject}>
                        <strong>{content.subject}</strong>
                      </div>
                    </div>
                  </Anchor>
                ))}
              </div>
            ) : (
              <div className="paper page-info">
                <ServiceNoDataIcon />
                <p>등록된 글이 없습니다.</p>
              </div>
            )}
          </div>

          {postList.totalPage > 1 ? (
            <nav className={styles.pagination} aria-label="페이지네이션">
              {pageNumbers[0] > 1 ? (
                <Anchor href={getPageHref(pageNumbers[0] - 1)} className={styles.pager} aria-label="이전 페이지 묶음">
                  <ArrowBackIosRoundedIcon />
                </Anchor>
              ) : null}

              {pageNumbers.map((pageNumber) => (
                <Anchor
                  key={pageNumber}
                  href={getPageHref(pageNumber)}
                  className={pageNumber === currentPage ? styles.current : undefined}
                  aria-current={pageNumber === currentPage ? 'page' : undefined}
                >
                  {pageNumber}
                </Anchor>
              ))}

              {pageNumbers[pageNumbers.length - 1] < postList.totalPage ? (
                <Anchor
                  href={getPageHref(pageNumbers[pageNumbers.length - 1] + 1)}
                  className={styles.pager}
                  aria-label="다음 페이지 묶음"
                >
                  <ArrowForwardIosRoundedIcon />
                </Anchor>
              ) : null}
            </nav>
          ) : null}

          {canWritePost ? <FabNew isCommunity={false} withDesktopButton /> : null}
        </div>
      </div>
    </Container>
  );
}
