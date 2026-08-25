import { type NextRequest } from 'next/server';
import { hasValidBlogSubscription, hasValidSeriesSubscription } from '@/lib/payments/blogDonation';
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
    const boardName = normalizeText(request.nextUrl.searchParams.get('boardName')).toLowerCase();
    const seriesName = normalizeText(request.nextUrl.searchParams.get('seriesName')).toLowerCase();

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

    if (targetType === PAYMENT_TARGET_TYPE.SERIES) {
      if (!session.stigmaId || !boardName || !seriesName) {
        return Response.json({
          isEnabled: false,
        });
      }

      const boardResult = await supabaseAdmin
        .from('boards')
        .select('id')
        .eq('site_id', site.id)
        .eq('board_key', boardName)
        .maybeSingle();

      if (boardResult.error || !boardResult.data) {
        return Response.json({
          isEnabled: false,
        });
      }

      const seriesResult = await supabaseAdmin
        .from('board_series')
        .select('id')
        .eq('site_id', site.id)
        .eq('board_id', boardResult.data.id)
        .eq('series_key', seriesName)
        .maybeSingle();

      if (seriesResult.error || !seriesResult.data) {
        return Response.json({
          isEnabled: false,
        });
      }

      const hasSeriesSubscription = await hasValidSeriesSubscription({
        supabaseAdmin,
        subscriberId: session.stigmaId,
        seriesId: seriesResult.data.id,
      });

      if (!hasSeriesSubscription) {
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
