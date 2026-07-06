import { notFound } from 'next/navigation';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import Anchor from '@/components/Anchor';
import SiteProfile from '@/components/service/blog/SiteProfile';
import Container from '../menu';
import styles from '@/app/board.module.sass';

type RouteContext = {
  params: Promise<{
    siteName: string;
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

function getCategoryImageUrl(path: string | null) {
  const normalizedPath = normalizeText(path);

  if (!normalizedPath) {
    return '';
  }

  const supabaseAdmin = getSupabaseAdmin();
  const publicUrl = supabaseAdmin.storage.from('category').getPublicUrl(normalizedPath);

  return publicUrl.data.publicUrl ?? '';
}

export default async function Page(context: RouteContext) {
  const { siteName } = await context.params;
  const normalizedSiteName = normalizeText(siteName).toLowerCase();

  if (!normalizedSiteName) {
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

  const categories = await supabaseAdmin
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
    .order('sort_order', { ascending: true });

  if (categories.error) {
    notFound();
  }

  const rows = (categories.data ?? []) as CategoryRow[];

  return (
    <Container pageTitle="카테고리" pageBack={`/${siteName}`}>
      <div className="container">
        <div className={`content ${styles['blog-list']} ${styles.content}`}>
          <SiteProfile />
          <div className="paper">
            {rows.length > 0 ? (
              <div className={`${styles['category-items']} ${styles['blog-items']}`}>
                {rows.map((category) => {
                  const imageUrl = getCategoryImageUrl(category.thumbnail_image);

                  return (
                    <Anchor href={`/${normalizedSiteName}/c/${category.category_key}`} key={category.id}>
                      <div className={styles.thumbnail}>
                        {imageUrl ? (
                          <img src={imageUrl} alt="" />
                        ) : (
                          <div className={styles.dummy}>
                            <MenuBookRoundedIcon />
                          </div>
                        )}
                      </div>
                      <div className={styles.info}>
                        <strong>{category.category_label}</strong>
                        {category.summary ? <p>{category.summary}</p> : null}
                      </div>
                    </Anchor>
                  );
                })}
              </div>
            ) : (
              <p>카테고리가 없습니다. 😭</p>
            )}
          </div>
        </div>
      </div>
    </Container>
  );
}
