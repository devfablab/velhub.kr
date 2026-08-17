import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const db = createClient(supabaseUrl, supabaseKey);

async function patch() {
  const { data: inquiry, error } = await db
    .from('inquiries')
    .select('id, created_at, inquiry_orders(payment_id), inquiry_payment_details(*)')
    .eq('id', 'db6a70cd-0b93-44d2-97f8-516dbf821dc0')
    .single();

  if (error || !inquiry) {
    console.error('Fetch error:', error);
    return;
  }
  if (inquiry.inquiry_payment_details) {
    // inquiry_payment_details is a one-to-one mapping, so it's likely an object or null
    // If it's an array, it's non-empty. If object, it exists.
    const details = Array.isArray(inquiry.inquiry_payment_details) 
      ? inquiry.inquiry_payment_details 
      : Object.keys(inquiry.inquiry_payment_details).length ? [inquiry.inquiry_payment_details] : [];
    
    if (details.length > 0) {
      console.log('Already patched');
      return;
    }
  }

  const paymentId = Array.isArray(inquiry.inquiry_orders) 
    ? inquiry.inquiry_orders[0]?.payment_id 
    : (inquiry.inquiry_orders as any)?.payment_id;

  if (!paymentId) {
    console.log('No payment ID found');
    return;
  }

  const { data: payment } = await db.from('payments').select('*').eq('id', paymentId).single();

  const paymentSnapshot = Object.fromEntries(Object.entries(payment).filter(([key]) => key !== 'buyer_user_id'));

  const { error: insertError } = await db.from('inquiry_payment_details').insert({
    inquiry_id: inquiry.id,
    occurred_at: inquiry.created_at,
    attempted_product: '블로그 정기구독',
    actual_behavior: '미성년자 결제 청약취소 요청',
    payment_snapshot: paymentSnapshot,
  });
  
  if (insertError) {
    console.error('Insert error:', insertError);
  } else {
    console.log('Patched specific inquiry successfully!');
  }
}
patch();
