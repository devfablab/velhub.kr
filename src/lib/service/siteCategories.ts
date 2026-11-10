import { getSupabaseAdmin } from '@/lib/clients/supabase';
import { normalizeText } from '@/lib/utils';

export type SiteCategory = {
  id: number;
  label: string;
};

export type SiteCategoryGroup = {
  id: number;
  label: string;
  categories: SiteCategory[];
};

export async function getSiteCategoryGroups(): Promise<SiteCategoryGroup[]> {
  const supabaseAdmin = getSupabaseAdmin();
  const [groupsResult, categoriesResult] = await Promise.all([
    supabaseAdmin.from('site_category_groups').select('id, label, sort_order').order('sort_order', { ascending: true }),
    supabaseAdmin
      .from('site_categories')
      .select('id, group_id, label, sort_order')
      .order('sort_order', { ascending: true }),
  ]);

  if (groupsResult.error || categoriesResult.error) {
    throw new Error('카테고리 목록을 불러오지 못했습니다.');
  }

  const categoriesByGroup = new Map<number, SiteCategory[]>();

  for (const category of categoriesResult.data ?? []) {
    const categories = categoriesByGroup.get(category.group_id) ?? [];
    categories.push({ id: category.id, label: category.label });
    categoriesByGroup.set(category.group_id, categories);
  }

  return (groupsResult.data ?? []).map((group) => ({
    id: group.id,
    label: group.label,
    categories: categoriesByGroup.get(group.id) ?? [],
  }));
}

export function formatSiteCategory(groups: SiteCategoryGroup[], categoryId: number | null | undefined) {
  if (!categoryId) {
    return '';
  }

  for (const group of groups) {
    const category = group.categories.find((item) => item.id === categoryId);

    if (category) {
      return `${group.label} > ${category.label}`;
    }
  }

  return '';
}

export async function isSiteOwner(siteId: string, stigmaId: string | null | undefined) {
  if (!stigmaId) {
    return false;
  }

  const membership = await getSupabaseAdmin()
    .from('rhizome_stigmas')
    .select('role')
    .eq('site_id', siteId)
    .eq('user_id', stigmaId)
    .maybeSingle();

  return !membership.error && normalizeText(membership.data?.role) === 'owner';
}
