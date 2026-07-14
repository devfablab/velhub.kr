import { type NextRequest } from 'next/server';
import { PAYMENT_TARGET_TYPE, SUBSCRIPTION_TYPE } from '@/lib/payments/types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import verifySession from '@/lib/session/verifySession';
import { getPaymentCustomerName } from '@/lib/payments/customer';

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

    console.log('siteName: ', siteName);

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

    if (site.site_type === 'community' && targetType !== PAYMENT_TARGET_TYPE.SITE) {
      return Response.json({
        isEnabled: false,
      });
    }

    if (site.site_type === 'blog' && targetType === PAYMENT_TARGET_TYPE.BOARD) {
      return Response.json({
        isEnabled: false,
      });
    }

    if (site.site_type === 'community') {
      const seriesCountResult = await supabaseAdmin
        .from('board_series')
        .select('id', { count: 'exact', head: true })
        .eq('site_id', site.id);

      if (seriesCountResult.error) {
        console.error(seriesCountResult.error);

        return Response.json({
          isEnabled: false,
        });
      }

      if ((seriesCountResult.count ?? 0) < 2) {
        return Response.json({
          isEnabled: false,
        });
      }
    }

    if (site.site_type === 'blog') {
      const membershipSettingResult = await supabaseAdmin
        .from('subscription_settings')
        .select('id')
        .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
        .eq('target_id', site.id)
        .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG)
        .maybeSingle();

      if (membershipSettingResult.error) {
        console.error(membershipSettingResult.error);

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
