export type ApiError = {
  error: string;
};

let csrfToken: string | null = null;
let tenantId: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

function normalizePath(path: string) {
  // apiBase() always returns '/api' — never prepend /api again to avoid /api/api/...
  if (path === '/auth') return '/auth';
  if (path.startsWith('/auth/')) return path;
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
    
    // Try to get from activeTenant object in localStorage
    try {
      const activeTenant = JSON.parse(localStorage.getItem('activeTenant') || 'null');
      if (activeTenant?.id) {
        tenantId = activeTenant.id as string;
        localStorage.setItem('tenantId', tenantId);
        return tenantId;
      }
    } catch (e) {
      // Ignore parsing errors
    }
    
    // Fallback: try to get from user object in localStorage (legacy)
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
  // Always use relative /api proxy — resolved by Nginx on both testing and production.
  // NEVER use process.env.NEXT_PUBLIC_API_URL here: it is embedded at build-time and
  // may contain a stale absolute URL (e.g. localhost:3002) that breaks client-side fetches.
  return '/api';
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

  // Attach Bearer token from localStorage
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
  
  // Rutas públicas de auth no requieren CSRF ni refresh de token
  const isPublicAuthRoute = normalizedPath.includes('/auth/forgot-password') ||
    normalizedPath.includes('/auth/reset-password') ||
    normalizedPath.includes('/auth/register') ||
    normalizedPath.includes('/auth/login');

  if (isStateChanging && !skipCsrf && !currentCsrf && !isPublicAuthRoute) {
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

  const base = apiBase();

  try {
    return await fetch(`${base}${normalizedPath}`, {
      ...init,
      headers,
      credentials: 'include',
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    });
  } catch (err) {
    if (normalizedPath.includes('clause-mappings')) {
      console.log('❌ [API] Clause mapping error:', normalizedPath, err);
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

  // Auto-refresh on 401 (expired access token) — excluir rutas públicas de auth
  const isPublicAuth = path.startsWith('/auth/refresh') || path.startsWith('/auth/login') ||
    path.startsWith('/auth/forgot-password') || path.startsWith('/auth/reset-password');
  const isOnLoginPage = typeof window !== 'undefined' &&
    (window.location.pathname === '/login' || window.location.pathname.startsWith('/login') ||
     window.location.pathname.startsWith('/canal/') || window.location.pathname.startsWith('/responder/') ||
     window.location.pathname.startsWith('/inspeccionar/') || window.location.pathname.startsWith('/feedback-qr/') ||
     window.location.pathname.startsWith('/feedback/'));
  if (res.status === 401 && !isPublicAuth && !isOnLoginPage) {
    const refreshed = await getRefreshPromise();
    if (refreshed) {
      res = await rawFetch<T>(path, init);
    } else {
      // Refresh falló (token expirado o sesión inválida) → redirigir al login
      if (typeof window !== 'undefined' && !isOnLoginPage) {
        window.localStorage.removeItem('accessToken');
        window.localStorage.removeItem('csrfToken');
        window.localStorage.removeItem('tenantId');
        window.localStorage.removeItem('user');
        window.localStorage.removeItem('userPermissions');
        window.location.href = '/login?reason=session_expired';
      }
      return {} as T;
    }
  }

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON response (e.g. HTML error page from proxy)
    if (!res.ok) {
      if (method === 'GET') return {} as T;
      throw new Error(`HTTP ${res.status}`);
    }
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
