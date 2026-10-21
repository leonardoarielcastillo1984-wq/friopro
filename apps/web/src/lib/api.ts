export type ApiError = {
  error: string;
};

// ── Producto / prefijos de entorno ──────────────────────────────
// La app puede empaquetarse como producto standalone (p.ej. Flota360
// en logismart.ar/flota360 con API en /flota360-api). Se resuelve en
// build-time con NEXT_PUBLIC_* — en el deploy de SGI360 todo cae a
// los defaults actuales (sin cambio de comportamiento).
const ENV_API_BASE = process.env.NEXT_PUBLIC_API_URL;
// Solo se acepta una base RELATIVA (path nginx). URLs absolutas se
// ignoran para no romper SSR/proxies (misma regla que antes).
const API_BASE = ENV_API_BASE && ENV_API_BASE.startsWith('/') ? ENV_API_BASE.replace(/\/+$/, '') : '/api';
const STORAGE_PREFIX = process.env.NEXT_PUBLIC_STORAGE_PREFIX || '';
export const PRODUCT = process.env.NEXT_PUBLIC_PRODUCT || 'sgi360';
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
export const LOGIN_PAGE = `${BASE_PATH}/login`;
export const LOGOUT_REDIRECT = PRODUCT === 'flota360' ? `${BASE_PATH}/login` : '/sgi360-landing';

// Prefija las claves de localStorage para que dos productos en el
// mismo dominio no compartan sesión (localStorage es por origen).
export function lsKey(key: string) {
  return STORAGE_PREFIX ? `${STORAGE_PREFIX}:${key}` : key;
}

// Devuelve la URL completa para un path de API — usar en fetch() crudos
// en vez de hardcodear '/api/...'.
export function apiPath(path: string) {
  if (!path.startsWith('/')) path = `/${path}`;
  if (path === '/api' || path.startsWith('/api/')) return `${API_BASE}${path.slice(4)}`;
  return `${API_BASE}${path}`;
}

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
      window.localStorage.setItem(lsKey('csrfToken'), token);
    } else {
      window.localStorage.removeItem(lsKey('csrfToken'));
    }
  }
}

export function getCsrfToken() {
  if (typeof window !== 'undefined') {
    // First try localStorage (for persistence)
    const stored = window.localStorage.getItem(lsKey('csrfToken'));
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
      window.localStorage.setItem(lsKey('csrfToken'), cookieToken);
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
    const stored = window.localStorage.getItem(lsKey('tenantId'));
    if (stored) return stored;
    
    // Try to get from activeTenant object in localStorage
    try {
      const activeTenant = JSON.parse(localStorage.getItem(lsKey('activeTenant')) || 'null');
      if (activeTenant?.id) {
        tenantId = activeTenant.id as string;
        localStorage.setItem(lsKey('tenantId'), tenantId);
        return tenantId;
      }
    } catch (e) {
      // Ignore parsing errors
    }
    
    // Fallback: try to get from user object in localStorage (legacy)
    try {
      const user = JSON.parse(localStorage.getItem(lsKey('user')) || '{}');
      if (user?.activeTenant?.id) {
        tenantId = user.activeTenant.id as string;
        localStorage.setItem(lsKey('tenantId'), tenantId);
        return tenantId;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }
  return tenantId;
}

function apiBase() {
  // Default '/api' — resuelto por Nginx en testing y producción.
  // Builds de producto (p.ej. Flota360) reciben NEXT_PUBLIC_API_URL=/flota360-api.
  return API_BASE;
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${apiBase()}${normalizePath('/auth/refresh')}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json().catch(() => null);
      // El Bearer viejo vencido tiene prioridad sobre la cookie: hay que
      // pisarlo con el access token nuevo o cada request sigue pegando 401.
      if (data?.accessToken && typeof window !== 'undefined') {
        window.localStorage.setItem(lsKey('accessToken'), data.accessToken);
      }
      if (data?.csrfToken) {
        csrfToken = data.csrfToken;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(lsKey('csrfToken'), data.csrfToken);
        }
      }
      // Update tenant ID from refresh response if available
      if (data?.activeTenant?.id) {
        tenantId = data.activeTenant.id;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(lsKey('tenantId'), data.activeTenant.id);
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
    const token = window.localStorage.getItem(lsKey('accessToken'));
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

// Construye un mensaje de error legible a partir de la respuesta de la API.
// Cuando el backend devuelve `details` (errores de validación Zod), agrega
// el campo y el motivo puntual en vez de mostrar solo "Validation failed".
function buildErrorMessage(data: any, status: number): string {
  const baseMsg = (data && typeof data === 'object' && 'error' in data && typeof data.error === 'string')
    ? (data as any).error
    : `HTTP ${status}`;

  const details = data && typeof data === 'object' ? (data as any).details : null;
  if (Array.isArray(details) && details.length) {
    const fieldMsgs = details.map((d: any) => {
      const field = Array.isArray(d?.path) && d.path.length ? d.path.join('.') : null;
      return field ? `${field}: ${d?.message ?? 'inválido'}` : (d?.message ?? 'inválido');
    });
    return `${baseMsg} (${fieldMsgs.join('; ')})`;
  }
  return baseMsg;
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
  // /auth/me es un CHEQUEO de sesión: un 401 acá es esperado para visitantes anónimos
  // (el AuthProvider corre en TODA página, incl. landings públicas y el root '/').
  // Nunca debe forzar el redirect a session_expired.
  const isAuthCheck = path.startsWith('/auth/me');
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
  const isOnLoginPage = typeof window !== 'undefined' &&
    (pathname === '/' ||
     pathname === '/login' || pathname.startsWith('/login') ||
     pathname.includes('-landing') ||
     pathname.startsWith('/reset-password') || pathname.startsWith('/forgot-password') ||
     pathname.startsWith('/canal/') || pathname.startsWith('/responder/') ||
     pathname.startsWith('/inspeccionar/') || pathname.startsWith('/feedback-qr/') ||
     pathname.startsWith('/feedback/'));
  if (res.status === 401 && !isPublicAuth && !isOnLoginPage) {
    const refreshed = await getRefreshPromise();
    if (refreshed) {
      res = await rawFetch<T>(path, init);
    } else {
      // Refresh falló (token expirado o sesión inválida) → redirigir a la landing de SGI360.
      // Excepción: /auth/me nunca redirige (el AuthProvider maneja el user null en páginas públicas).
      if (typeof window !== 'undefined' && !isOnLoginPage && !isAuthCheck) {
        window.localStorage.removeItem(lsKey('accessToken'));
        window.localStorage.removeItem(lsKey('csrfToken'));
        window.localStorage.removeItem(lsKey('tenantId'));
        window.localStorage.removeItem(lsKey('user'));
        window.localStorage.removeItem(lsKey('userPermissions'));
        window.location.href = `${LOGOUT_REDIRECT}?reason=session_expired`;
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

    const msg = buildErrorMessage(data, res.status);

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
          throw new Error(buildErrorMessage(retryData, retryRes.status));
        }

        return retryData as T;
      }
    }
    throw new Error(msg);
  }

  return data as T;
}
