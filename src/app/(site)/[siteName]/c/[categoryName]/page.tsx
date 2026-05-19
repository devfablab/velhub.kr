import { notFound } from 'next/navigation';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { getPostList } from '@/lib/board/getPostList';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
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

function getPageNumber(value: string | undefined) {
  const pageNumber = Number(value);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return 1;
  }

  return pageNumber;
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

  if (
    rhizome.data.site_type !== 'blog' ||
    rhizome.data.visibility_type !== 'public' ||
    rhizome.data.is_shutdown !== false
  ) {
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
    boardId: categoryData.board_id,
    page: currentPage,
    size: 10,
    filter: 'all',
    sessionCase: 'guest',
    authUserId: null,
    sort: 'latest',
    includePin: false,
    categoryId: categoryData.id,
  });

  return (
    <main>
      <div className="container">
        <div className={`content ${styles['blog-list']} ${styles.content}`}>
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
                        <img src={content.thumbnail_image_url} alt="" />
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
              <p>등록된 글이 없습니다.</p>
            )}

            {postList.totalPage > 1 ? (
              <nav>
                {currentPage > 1 ? (
                  <Anchor href={`/${normalizedSiteName}/c/${normalizedCategoryName}?page=${currentPage - 1}`}>
                    이전
                  </Anchor>
                ) : null}

                <span>
                  {currentPage} / {postList.totalPage}
                </span>

                {currentPage < postList.totalPage ? (
                  <Anchor href={`/${normalizedSiteName}/c/${normalizedCategoryName}?page=${currentPage + 1}`}>
                    다음
                  </Anchor>
                ) : null}
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
