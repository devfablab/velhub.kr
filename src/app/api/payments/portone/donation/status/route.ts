import { type NextRequest } from 'next/server';
import { hasValidBlogSubscription } from '@/lib/payments/blogDonation';
import { getPaymentCustomerName } from '@/lib/payments/customer';
import { PAYMENT_TARGET_TYPE } from '@/lib/payments/types';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';

type SiteRow = {
  id: string;
  site_key: string;
  site_type: string;
  is_shutdown: boolean;
};

export async function GET(request: NextRequest) {
  try {
    const siteName = normalizeText(request.nextUrl.searchParams.get('siteName')).toLowerCase();
    const targetType = normalizeText(request.nextUrl.searchParams.get('targetType')).toLowerCase();

    if (!siteName) {
      return Response.json({
        isEnabled: false,
      });
    }

    const supabaseAdmin = getSupabaseAdmin();

    const siteResult = await supabaseAdmin
      .from('rhizomes')
      .select('id, site_key, site_type, is_shutdown')
      .eq('site_key', siteName)
      .maybeSingle();

    if (siteResult.error) {
      console.error(siteResult.error);

      return Response.json({
        isEnabled: false,
      });
    }

    if (!siteResult.data) {
      return Response.json({
        isEnabled: false,
      });
    }

    const site = siteResult.data as SiteRow;

    if (site.is_shutdown) {
      return Response.json({
        isEnabled: false,
      });
    }

    const session = await verifySession({
      siteId: site.id,
    });

    if (session.rhizomeStigmaId) {
      const membershipResult = await supabaseAdmin
        .from('rhizome_stigmas')
        .select('role')
        .eq('id', session.rhizomeStigmaId)
        .maybeSingle();

      if (membershipResult.error) {
        console.error(membershipResult.error);

        return Response.json({
          isEnabled: false,
        });
      }

      if (membershipResult.data?.role === 'owner') {
        return Response.json({
          isEnabled: false,
        });
      }
    }

    if (
      targetType !== PAYMENT_TARGET_TYPE.SITE &&
      targetType !== PAYMENT_TARGET_TYPE.SERIES &&
      targetType !== PAYMENT_TARGET_TYPE.POST
    ) {
      return Response.json({
        isEnabled: false,
      });
    }

    if (site.site_type === 'community' && targetType === PAYMENT_TARGET_TYPE.SITE) {
      return Response.json({
        isEnabled: false,
      });
    }

    if (site.site_type === 'blog' && targetType === PAYMENT_TARGET_TYPE.SITE) {
      if (!session.stigmaId) {
        return Response.json({
          isEnabled: false,
        });
      }

      const hasBlogSubscription = await hasValidBlogSubscription({
        supabaseAdmin,
        subscriberId: session.stigmaId,
        siteId: site.id,
      });

      if (!hasBlogSubscription) {
        return Response.json({
          isEnabled: false,
        });
      }
    }

    async function getPaymentEmail() {
      try {
        if (!session.authUserId) {
          return null;
        }

        return getPaymentCustomerName(session.authUserId);
      } catch (unknownError) {
        console.error(unknownError);
        return null;
      }
    }

    const paymentEmail = await getPaymentEmail();

    return Response.json({
      isEnabled: true,
      paymentEmail,
    });
  } catch (unknownError) {
    console.error(unknownError);

    return Response.json({
      isEnabled: false,
    });
  }
}
