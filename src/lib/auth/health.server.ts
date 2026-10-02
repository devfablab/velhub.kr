export type SupabaseAuthHealthStatus = 'operational' | 'outage' | 'unknown';

export type SupabaseAuthHealth = {
  status: SupabaseAuthHealthStatus;
  providerStatus: string | null;
  checkedAt: string;
};

type StatusPageComponent = {
  name?: unknown;
  status?: unknown;
};

type StatusPageSummary = {
  components?: unknown;
};

const STATUS_SUMMARY_URL = 'https://status.supabase.com/api/v2/summary.json';
const STATUS_CACHE_MS = 30_000;

let cachedHealth: SupabaseAuthHealth | null = null;
let cachedAt = 0;
let pendingHealthRequest: Promise<SupabaseAuthHealth> | null = null;

function createHealth(status: SupabaseAuthHealthStatus, providerStatus: string | null): SupabaseAuthHealth {
  return {
    status,
    providerStatus,
    checkedAt: new Date().toISOString(),
  };
}

async function loadSupabaseAuthHealth() {
  try {
    const response = await fetch(STATUS_SUMMARY_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      return createHealth('unknown', null);
    }

    const summary = (await response.json()) as StatusPageSummary;
    const authComponent = Array.isArray(summary.components)
      ? summary.components.find(
          (component): component is StatusPageComponent =>
            Boolean(component) &&
            typeof component === 'object' &&
            (component as StatusPageComponent).name === 'Auth',
        )
      : null;
    const providerStatus = typeof authComponent?.status === 'string' ? authComponent.status : null;

    if (!providerStatus) {
      return createHealth('unknown', null);
    }

    return createHealth(providerStatus === 'operational' ? 'operational' : 'outage', providerStatus);
  } catch {
    return createHealth('unknown', null);
  }
}

export async function getSupabaseAuthHealth() {
  if (cachedHealth && Date.now() - cachedAt < STATUS_CACHE_MS) {
    return cachedHealth;
  }

  if (!pendingHealthRequest) {
    pendingHealthRequest = loadSupabaseAuthHealth().finally(() => {
      pendingHealthRequest = null;
    });
  }

  cachedHealth = await pendingHealthRequest;
  cachedAt = Date.now();

  return cachedHealth;
}

export function isSupabaseAuthOutage(health: SupabaseAuthHealth) {
  return health.status === 'outage';
}
