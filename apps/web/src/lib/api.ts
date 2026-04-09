export type ApiError = {
  error: string;
};

let csrfToken: string | null = null;
let tenantId: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function normalizePath(path: string) {
  if (path === '/auth') return '/api/auth';
  if (path.startsWith('/auth/')) return `/api${path}`;
  return path;
}

export function setCsrfToken(token: string | null) {
  csrfToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.localStorage.setItem('csrfToken', token);
    } else {
      window.localStorage.removeItem('csrfToken');
    }
  }
}

export function getCsrfToken() {
  if (typeof window !== 'undefined') {
    // First try localStorage (for persistence)
    const stored = window.localStorage.getItem('csrfToken');
    if (stored) {
      csrfToken = stored; // Sync in-memory variable
      return stored;
    }
    
    // Then try cookie (for fresh login)
    const cookieToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrf_token='))
      ?.split('=')[1];
    if (cookieToken) {
      // Save to localStorage for persistence
      window.localStorage.setItem('csrfToken', cookieToken);
      csrfToken = cookieToken;
      return cookieToken;
    }
    
    // Return in-memory variable as fallback
    if (csrfToken) return csrfToken;
  }
  return csrfToken;
}

export function setTenantId(id: string | null) {
  tenantId = id;
}

export function getTenantId() {
  if (typeof window !== 'undefined') {
    // First try in-memory variable
    if (tenantId) return tenantId;
    
    // Then try localStorage (for persistence)
    const stored = window.localStorage.getItem('tenantId');
    if (stored) return stored;
    
    // Try to get from user object in localStorage
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user?.activeTenant?.id) {
        tenantId = user.activeTenant.id as string;
        localStorage.setItem('tenantId', tenantId);
        return tenantId;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  return tenantId;
}

function apiBase() {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (base) return base;
  // Fallback para desarrollo local - USA IPv4 directo para evitar problemas de IPv6
  return 'http://127.0.0.1:3002';
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}${normalizePath('/auth/refresh')}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data?.csrfToken) {
        csrfToken = data.csrfToken;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('csrfToken', data.csrfToken);
        }
      }
      // Update tenant ID from refresh response if available
      if (data?.activeTenant?.id) {
        tenantId = data.activeTenant.id;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem('tenantId', data.activeTenant.id);
        }
      }
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export { tryRefreshToken };

function getRefreshPromise(): Promise<boolean> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = tryRefreshToken().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }
  return refreshPromise!;
}

async function rawFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<Response> {
  const normalizedPath = normalizePath(path);
  const headers: Record<string, string> = {
    ...(init.headers as any),
  };

  // Bearer auth for cross-origin API calls (localhost:3000 -> localhost:3001)
  if (typeof window !== 'undefined') {
    const token = window.localStorage.getItem('accessToken');
    if (token && !headers.authorization && !headers.Authorization) {
      headers['authorization'] = `Bearer ${token}`;
    }
  }

  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
  }

  // CSRF for state-changing requests (cookie-based auth)
  const method = (init.method ?? 'GET').toUpperCase();
  const isStateChanging = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
  let currentCsrf = getCsrfToken();
  
  // Temporarily skip CSRF for clause-mappings to debug
  const skipCsrf = normalizedPath.includes('clause-mappings');
  
  if (isStateChanging && !skipCsrf && !currentCsrf) {
    // If the session is valid but CSRF is missing (e.g. after restart), refresh CSRF once.
    await tryRefreshToken();
    currentCsrf = getCsrfToken();
  }
  if (isStateChanging && !skipCsrf && currentCsrf) {
    headers['x-csrf-token'] = currentCsrf;
  }

  // Tenant ID for tenant-scoped requests
  const currentTenantId = getTenantId();
  if (currentTenantId) {
    headers['x-tenant-id'] = currentTenantId;
  }

  // Debug logging for clause linking requests
  if (normalizedPath.includes('clause-mappings')) {
    console.log('🔗 [API] Clause mapping request:');
    console.log('  Path:', normalizedPath);
    console.log('  Method:', method);
    console.log('  Headers:', headers);
    console.log('  CSRF Token:', currentCsrf ? 'present' : 'missing');
    console.log('  Auth Token:', headers.authorization ? 'present' : 'missing');
  }

  const primaryBase = apiBase();
  const fallbackBase = 'http://127.0.0.1:3002';

  const doFetch = (base: string) =>
    fetch(`${base}${normalizedPath}`, {
      ...init,
      headers,
      credentials: 'include',
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });

  try {
    const res = await doFetch(primaryBase);
    return res;
  } catch (err) {
    // If primary fetch fails, retry with fallback
    if (primaryBase !== fallbackBase) {
      return await doFetch(fallbackBase);
    }
    // Debug logging for clause mapping errors
    if (normalizedPath.includes('clause-mappings')) {
      console.log('❌ [API] Clause mapping error:');
      console.log('  Path:', normalizedPath);
      console.log('  Method:', method);
      console.log('  Error:', err);
      console.log('  Error name:', (err as any)?.name || 'unknown');
      console.log('  Error message:', (err as any)?.message || 'no message');
    }
    throw err;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();

  let res: Response;
  try {
    res = await rawFetch<T>(path, init);
  } catch (error) {
    if (method === 'GET') {
      return {} as T;
    }
    throw error;
  }

  // Auto-refresh on 401 (expired access token)
  if (res.status === 401 && !path.startsWith('/auth/refresh') && !path.startsWith('/auth/login')) {
    const refreshed = await getRefreshPromise();
    if (refreshed) {
      res = await rawFetch<T>(path, init);
    }
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON response (e.g. HTML error page from proxy)
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return null as T;
  }

  if (!res.ok) {
    if (method === 'GET') {
      return {} as T;
    }

    const msg = (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string')
      ? (data as any).error
      : `HTTP ${res.status}`;

    // If CSRF token expired or server restarted, refresh CSRF and retry once.
    const isStateChanging = method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE';
    if (isStateChanging && msg.toLowerCase().includes('csrf')) {
      const refreshed = await tryRefreshToken();
      if (refreshed) {
        const retryRes = await rawFetch<T>(path, init);
        const retryText = await retryRes.text();
        let retryData: any = null;
        try {
          retryData = retryText ? JSON.parse(retryText) : null;
        } catch {
          if (!retryRes.ok) throw new Error(`HTTP ${retryRes.status}`);
          return null as T;
        }

        if (!retryRes.ok) {
          const retryMsg = (retryData && typeof retryData === 'object' && 'error' in retryData && typeof retryData.error === 'string')
            ? (retryData as any).error
            : `HTTP ${retryRes.status}`;
          throw new Error(retryMsg);
        }

        return retryData as T;
      }
    }
    throw new Error(msg);
  }

  return data as T;
}
