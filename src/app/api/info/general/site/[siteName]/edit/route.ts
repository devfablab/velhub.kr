import { getCommunityManagerAccess } from '@/lib/community/community-manager/utils';
import verifySession from '@/lib/session/verifySession';
import { getSupabaseAdmin } from '@/lib/supabase';
import { normalizeText } from '@/lib/utils';
import { PAYMENT_STATUS, SUBSCRIPTION_STATUS, SUBSCRIPTION_TYPE, PAYMENT_TARGET_TYPE } from '@/lib/payments/types';
import { cancelPortOnePayment } from '@/lib/payments/portone';

type RouteContext = {
  params: Promise<{
    siteName: string;
  }>;
};

type UpdateField =
  | 'site_key'
  | 'site_label'
  | 'profile_picture'
  | 'profile_logo'
  | 'summary'
  | 'og_image'
  | 'promotion_image'
  | 'visibility_type'
  | 'theme_type'
  | 'is_shutdown'
  | 'custom_domain'
  | 'blog_type';

type RequestBody = {
  field: UpdateField;
  value: string | boolean | null;
};

type ThemeType = 'default' | 'coral' | 'teal' | 'royalblue' | 'slateblue' | 'seagreen' | 'orchid' | 'tomato';

const THEME_TYPES: ThemeType[] = ['default', 'coral', 'teal', 'royalblue', 'slateblue', 'seagreen', 'orchid', 'tomato'];

function normalizeSiteKey(rawValue: string) {
  return rawValue
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '');
}

function hasInvalidCharacters(value: string) {
  return /[^a-z0-9-]/.test(value);
}

function isThemeType(value: unknown): value is ThemeType {
  return typeof value === 'string' && THEME_TYPES.includes(value as ThemeType);
}

function formatLogMessage(
  field: UpdateField,
  previousValue: string | boolean | null,
  nextValue: string | boolean | null,
) {
  if (field === 'site_key') {
    return `사이트 주소 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'site_label') {
    return `사이트명 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'profile_picture') {
    return `아바타 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'profile_logo') {
    return `사이트 로고 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'summary') {
    return `요약 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'og_image') {
    return `오픈그래프 이미지 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'promotion_image') {
    return `프로모션 이미지 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'visibility_type') {
    return `공개 여부 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'theme_type') {
    return `테마 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'custom_domain') {
    return `커스텀 도메인 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  if (field === 'blog_type') {
    return `블로그 타입 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
  }

  return `중단 여부 ${String(previousValue ?? '')} → ${String(nextValue ?? '')}`;
}

async function checkAccess(siteName: string) {
  const supabaseAdmin = getSupabaseAdmin();

  const rhizome = await supabaseAdmin
    .from('rhizomes')
    .select(
      'id, created_at, owner_id, site_key, site_label, profile_picture, profile_logo, summary, og_image, promotion_image, site_type, visibility_type, theme_type, is_shutdown, custom_domain',
    )
    .eq('site_key', siteName)
    .maybeSingle();

  if (rhizome.error || !rhizome.data) {
    return {
      ok: false,
      status: 404,
      error: '사이트를 찾을 수 없습니다.',
    } as const;
  }

  if (rhizome.data.site_type === 'community') {
    try {
      const access = await getCommunityManagerAccess(siteName);

      if (!access.actor.permissions.site_edit) {
        return {
          ok: false,
          status: 403,
          error: '접근 권한이 없습니다.',
        } as const;
      }

      return {
        ok: true,
        status: 200,
        rhizome: rhizome.data,
        updatedByStigmaId: access.actor.stigmaId,
        supabaseAdmin,
      } as const;
    } catch (unknownError) {
      if (unknownError instanceof Error) {
        return {
          ok: false,
          status: 403,
          error: unknownError.message || '접근 권한이 없습니다.',
        } as const;
      }

      return {
        ok: false,
        status: 403,
        error: '접근 권한이 없습니다.',
      } as const;
    }
  }

  const session = await verifySession({
    siteId: rhizome.data.id,
  });

  if (session.case === 'admin' && session.stigmaId) {
    return {
      ok: true,
      status: 200,
      rhizome: rhizome.data,
      updatedByStigmaId: session.stigmaId,
      supabaseAdmin,
    } as const;
  }

  if (session.case !== 'staff' || !session.stigmaId || !session.rhizomeStigmaId) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  const membership = await supabaseAdmin
    .from('rhizome_stigmas')
    .select('role, user_id')
    .eq('id', session.rhizomeStigmaId)
    .eq('site_id', rhizome.data.id)
    .maybeSingle();

  if (membership.error || normalizeText(membership.data?.role) !== 'owner' || !membership.data?.user_id) {
    return {
      ok: false,
      status: 403,
      error: '접근 권한이 없습니다.',
    } as const;
  }

  return {
    ok: true,
    status: 200,
    rhizome: rhizome.data,
    updatedByStigmaId: membership.data.user_id as string,
    supabaseAdmin,
  } as const;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { siteName } = await context.params;
    const normalizedSiteName = normalizeText(siteName).toLowerCase();

    if (!normalizedSiteName) {
      return Response.json({ error: 'siteName이 유효하지 않습니다.' }, { status: 400 });
    }

    const requestBody = (await request.json()) as RequestBody;

    const updatableFields: UpdateField[] = [
      'site_key',
      'site_label',
      'profile_picture',
      'profile_logo',
      'summary',
      'og_image',
      'promotion_image',
      'visibility_type',
      'theme_type',
      'is_shutdown',
      'custom_domain',
      'blog_type',
    ];

    if (!updatableFields.includes(requestBody.field)) {
      return Response.json({ error: '수정할 수 없는 항목입니다.' }, { status: 400 });
    }

    const access = await checkAccess(normalizedSiteName);

    if (!access.ok) {
      return Response.json({ error: access.error }, { status: access.status });
    }

    const previousValue: string | boolean | null = (access.rhizome as Record<string, any>)[requestBody.field];
    let nextValue: string | boolean | null = null;

    if (requestBody.field === 'site_key') {
      const rawValue = typeof requestBody.value === 'string' ? requestBody.value : '';
      const normalizedValue = normalizeSiteKey(rawValue);

      if (!normalizedValue) {
        return Response.json({ error: '사이트 주소를 입력해주세요.' }, { status: 400 });
      }

      if (hasInvalidCharacters(normalizedValue)) {
        return Response.json({ error: "영소문자, 하이픈('-'), 숫자만 사용 가능합니다." }, { status: 400 });
      }

      if (/^\d/.test(normalizedValue)) {
        return Response.json({ error: '사이트 주소는 숫자로 시작할 수 없습니다.' }, { status: 400 });
      }

      if (normalizedValue.length < 5 || normalizedValue.length > 15) {
        return Response.json({ error: '사이트 주소는 5자 이상 15자 이하여야 합니다.' }, { status: 400 });
      }

      const denylist = await access.supabaseAdmin
        .from('denylist')
        .select('word')
        .eq('word', normalizedValue)
        .maybeSingle();

      if (denylist.error) {
        return Response.json({ error: '사이트 주소 확인에 실패했습니다.' }, { status: 500 });
      }

      if (denylist.data) {
        return Response.json({ error: '사용할 수 없는 사이트 주소입니다.' }, { status: 400 });
      }

      const duplicateSiteKey = await access.supabaseAdmin
        .from('rhizomes')
        .select('id')
        .eq('site_key', normalizedValue)
        .neq('id', access.rhizome.id)
        .maybeSingle();

      if (duplicateSiteKey.error) {
        return Response.json({ error: '사이트 주소 확인에 실패했습니다.' }, { status: 500 });
      }

      if (duplicateSiteKey.data) {
        return Response.json({ error: '사용할 수 없는 사이트 주소입니다.' }, { status: 400 });
      }

      nextValue = normalizedValue;
    } else if (requestBody.field === 'site_label') {
      const normalizedValue = typeof requestBody.value === 'string' ? requestBody.value.trim() : '';

      if (normalizedValue && (normalizedValue.length < 4 || normalizedValue.length > 10)) {
        return Response.json({ error: '사이트명은 4자 이상 10자 이하여야 합니다.' }, { status: 400 });
      }

      nextValue = normalizedValue || null;
    } else if (requestBody.field === 'summary') {
      const normalizedValue = typeof requestBody.value === 'string' ? requestBody.value.trim() : '';

      if (normalizedValue.length > 52) {
        return Response.json({ error: '사이트 설명은 52자 이하여야 합니다.' }, { status: 400 });
      }

      nextValue = normalizedValue || null;
    } else if (requestBody.field === 'visibility_type') {
      if (requestBody.value !== 'public' && requestBody.value !== 'private') {
        return Response.json({ error: '공개 여부 값이 올바르지 않습니다.' }, { status: 400 });
      }

      nextValue = requestBody.value;
    } else if (requestBody.field === 'theme_type') {
      if (!isThemeType(requestBody.value)) {
        return Response.json({ error: '테마 값이 올바르지 않습니다.' }, { status: 400 });
      }

      nextValue = requestBody.value;
    } else if (requestBody.field === 'is_shutdown') {
      if (typeof requestBody.value !== 'boolean') {
        return Response.json({ error: '중단 여부 값이 올바르지 않습니다.' }, { status: 400 });
      }

      nextValue = requestBody.value;
    } else if (requestBody.field === 'custom_domain') {
      nextValue = typeof requestBody.value === 'string' ? requestBody.value.trim() || null : null;
    } else if (requestBody.field === 'blog_type') {
      if (requestBody.value !== 'personal' && requestBody.value !== 'team') {
        return Response.json({ error: '블로그 타입 값이 올바르지 않습니다.' }, { status: 400 });
      }
      nextValue = requestBody.value;
    } else {
      nextValue = typeof requestBody.value === 'string' ? requestBody.value.trim() || null : null;
    }

    if (requestBody.field === 'blog_type') {
      const blogData = await access.supabaseAdmin
        .from('blogs')
        .select('blog_type')
        .eq('site_id', access.rhizome.id)
        .maybeSingle();
      
      const currentBlogType = blogData.data?.blog_type ?? 'personal';
      if (currentBlogType === nextValue) {
        return Response.json({
          ok: true,
          field: requestBody.field,
          value: nextValue,
          siteName: normalizedSiteName,
        });
      }

      if (nextValue === 'personal') {
        const otherMembers = await access.supabaseAdmin
          .from('rhizome_stigmas')
          .select('id')
          .eq('site_id', access.rhizome.id)
          .neq('user_id', access.rhizome.owner_id as string)
          .limit(1);

        if (otherMembers.error) {
          return Response.json({ error: '팀원 확인에 실패했습니다.' }, { status: 500 });
        }

        if (otherMembers.data?.length) {
          return Response.json({ error: '매니저나 팀원이 존재하는 경우 1인 블로그로 변경할 수 없습니다.' }, { status: 400 });
        }
      }

      if (nextValue === 'team') {
        const activeSubs = await access.supabaseAdmin
          .from('subscriptions')
          .select('id, last_payment_id')
          .eq('target_type', PAYMENT_TARGET_TYPE.SITE)
          .eq('target_id', access.rhizome.id)
          .eq('subscription_type', SUBSCRIPTION_TYPE.MEMBERSHIP_BLOG)
          .in('status', [SUBSCRIPTION_STATUS.TRIALING, SUBSCRIPTION_STATUS.ACTIVE, SUBSCRIPTION_STATUS.PAST_DUE]);
        
        if (activeSubs.data && activeSubs.data.length > 0) {
          const paymentIds = activeSubs.data.map(sub => sub.last_payment_id).filter(Boolean);
          if (paymentIds.length > 0) {
            const payments = await access.supabaseAdmin
              .from('payments')
              .select('id, payment_key, amount')
              .in('id', paymentIds);
              
            const nowIsoString = new Date().toISOString();
            
            for (const payment of payments.data ?? []) {
              if (!payment.payment_key) continue;
              
              try {
                await cancelPortOnePayment({
                  paymentId: payment.payment_key,
                  cancelReason: '팀 블로그 전환으로 인한 환불',
                });
                
                await access.supabaseAdmin.from('payments').update({
                  refunded_amount: payment.amount,
                  status: PAYMENT_STATUS.REFUNDED,
                  refunded_at: nowIsoString,
                }).eq('id', payment.id);
              } catch (e) {
                console.error('PortOne Cancel Failed:', e);
              }
            }
          }
          
          await access.supabaseAdmin.from('subscriptions').update({
            status: SUBSCRIPTION_STATUS.CANCELED,
            canceled_at: new Date().toISOString(),
            expired_at: new Date().toISOString(),
          }).in('id', activeSubs.data.map(sub => sub.id));
        }
      }

      const updateBlog = await access.supabaseAdmin
        .from('blogs')
        .update({ blog_type: nextValue })
        .eq('site_id', access.rhizome.id);

      if (updateBlog.error) {
        return Response.json({ error: '블로그 타입 수정에 실패했습니다.' }, { status: 500 });
      }
    } else {
      const updateRhizome = await access.supabaseAdmin
        .from('rhizomes')
        .update({
          [requestBody.field]: nextValue,
        })
        .eq('id', access.rhizome.id);

      if (updateRhizome.error) {
        return Response.json({ error: '사이트 정보 수정에 실패했습니다.' }, { status: 500 });
      }
    }

    const nowIsoString = new Date().toISOString();
    const logMessage = formatLogMessage(requestBody.field, previousValue, nextValue);

    const updateSites = await access.supabaseAdmin
      .from('sites')
      .update({
        updated_at: nowIsoString,
        updated_by: access.updatedByStigmaId,
        log: logMessage,
      })
      .eq('site_id', access.rhizome.id);

    if (updateSites.error) {
      return Response.json({ error: '수정 이력 저장에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({
      ok: true,
      field: requestBody.field,
      value: nextValue,
      siteName: requestBody.field === 'site_key' && typeof nextValue === 'string' ? nextValue : normalizedSiteName,
    });
  } catch (unknownError) {
    if (unknownError instanceof Error) {
      return Response.json({ error: unknownError.message || '사이트 정보 수정에 실패했습니다.' }, { status: 500 });
    }

    return Response.json({ error: '사이트 정보 수정에 실패했습니다.' }, { status: 500 });
  }
}
