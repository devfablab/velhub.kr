import { notFound } from 'next/navigation';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { getPostList } from '@/lib/board/getPostList';
import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { getSitePageMetadata } from '@/lib/seoSite';
import { getHashtagKey, normalizeHashtagLabel } from '@/lib/service/blog/blogHashtags';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import OptimizedImage from '@/components/OptimizedImage';
import SiteProfile from '@/components/service/blog/SiteProfile';
import { ServiceNoDataIcon } from '@/components/Svgs';
import Container from '../../menu';
import styles from '@/app/board.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
    hashtag: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};

function getPageNumber(value: string | undefined) {
  const pageNumber = Number(value);

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    return 1;
  }

  return pageNumber;
}

function getHashtagParam(value: string) {
  try {
    return normalizeHashtagLabel(decodeURIComponent(value));
  } catch {
    return normalizeHashtagLabel(value);
  }
}

export async function generateMetadata(context: RouteContext) {
  const { siteName, hashtag } = await context.params;

  return getSitePageMetadata({
    siteName,
    pageTitle: `#${getHashtagParam(hashtag)}`,
    pagePath: `/t/${hashtag}`,
  });
}

export default async function Page(context: RouteContext) {
  const { siteName, hashtag } = await context.params;
  const searchParams = await context.searchParams;

  const normalizedSiteName = normalizeText(siteName).toLowerCase();
  const hashtagLabel = getHashtagParam(hashtag);
  const currentPage = getPageNumber(searchParams.page);

  if (!normalizedSiteName || !hashtagLabel) {
    notFound();
  }

  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select('id, site_type, is_shutdown')
    .eq('site_key', normalizedSiteName)
    .maybeSingle();

  if (rhizome.error || !rhizome.data || rhizome.data.site_type !== 'blog' || rhizome.data.is_shutdown !== false) {
    notFound();
  }

  const hashtagRow = await supabaseAdmin
    .from('blog_hashtags')
    .select('id, label')
    .eq('site_id', rhizome.data.id)
    .eq('label_key', getHashtagKey(hashtagLabel))
    .maybeSingle();

  if (hashtagRow.error || !hashtagRow.data) {
    notFound();
  }

  const hashtagPath = `/${normalizedSiteName}/t/${encodeURIComponent(hashtagRow.data.label)}`;
  const postList = await getPostList({
    siteId: rhizome.data.id,
    siteKey: normalizedSiteName,
    siteType: rhizome.data.site_type,
    page: currentPage,
    size: 10,
    filter: 'all',
    sessionCase: 'guest',
    stigmaId: null,
    sort: 'latest',
    includePin: false,
    hashtagId: hashtagRow.data.id,
  });

  return (
    <Container pageBack={`/${siteName}`} pageTitle={`#${hashtagRow.data.label}`}>
      <div className="container">
        <div className={`content ${styles['blog-list']} ${styles.content}`}>
          <SiteProfile />
          <div className={styles.headline}>
            <h2>{`#${hashtagRow.data.label}`}</h2>
          </div>
          <div className="paper">
            {postList.contents.length > 0 ? (
              <div className={styles['blog-items']}>
                {postList.contents.map((content) => (
                  <Anchor href={`/${normalizedSiteName}/${content.board_key}/${content.slug}`} key={content.id}>
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

            {postList.totalPage > 1 ? (
              <nav>
                {currentPage > 1 ? <Anchor href={`${hashtagPath}?page=${currentPage - 1}`}>이전</Anchor> : null}

                <span>
                  {currentPage} / {postList.totalPage}
                </span>

                {currentPage < postList.totalPage ? (
                  <Anchor href={`${hashtagPath}?page=${currentPage + 1}`}>다음</Anchor>
                ) : null}
              </nav>
            ) : null}
          </div>
        </div>
      </div>
    </Container>
  );
}
