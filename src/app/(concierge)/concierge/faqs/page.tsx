import { getSupabaseAdmin } from '@/lib/supabase';
import Container from '../menu';
import Faqs, { type FaqCategory } from './opt';
import styles from '@/app/concierge.module.sass';

export const dynamic = 'force-dynamic';

type FaqCategoryRow = {
  id: string;
  name: string;
  sort_order: number | string;
};

type FaqRow = {
  id: string;
  category_id: string;
  question: string;
  answer: string;
  sort_order: number | string;
};

export default async function Page() {
  const supabaseAdmin = getSupabaseAdmin();
  const [categoryResult, faqResult] = await Promise.all([
    supabaseAdmin
      .from('faq_categories')
      .select('id, name, sort_order')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    supabaseAdmin
      .from('faqs')
      .select('id, category_id, question, answer, sort_order')
      .eq('is_published', true)
      .order('sort_order', { ascending: true })
      .order('question', { ascending: true }),
  ]);

  if (categoryResult.error || faqResult.error) {
    throw new Error('자주하는 질문을 불러오지 못했습니다.');
  }

  const faqRows = (faqResult.data ?? []) as FaqRow[];
  const categories = ((categoryResult.data ?? []) as FaqCategoryRow[])
    .map<FaqCategory>((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: Number(category.sort_order),
      faqs: faqRows
        .filter((faq) => faq.category_id === category.id)
        .map((faq) => ({
          id: faq.id,
          question: faq.question,
          answer: faq.answer,
          sortOrder: Number(faq.sort_order),
        })),
    }))
    .filter((category) => category.faqs.length > 0);

  return (
    <Container>
      <div className={`container ${styles.container}`}>
        <div className={`content ${styles.content}`}>
          <h1>자주하는 질문</h1>
          <Faqs categories={categories} />
        </div>
      </div>
    </Container>
  );
}
