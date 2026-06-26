// ──────────────────────────────────────────────────────────────
// PROJECT360 — Auth & API helper
//
// PROJECT360 usa un token propio (P360) que se obtiene intercambiando
// el JWT de SGI360. Este módulo centraliza:
//   - almacenamiento del token P360 (localStorage)
//   - login / verificación de sesión contra el backend
//   - p360Fetch: wrapper de fetch que agrega el token P360 y el prefijo /api
//
// Las rutas del backend están montadas bajo el prefijo `/project360`
// (resuelto por Nginx a través de `/api`). Ej: `/api/project360/auth/me`.
// ──────────────────────────────────────────────────────────────

const TOKEN_KEY = 'project360Token';
const SESSION_KEY = 'project360Session';

// El plan tiene muchos campos opcionales según el tier; lo dejamos laxo.
export type P360Plan = {
  id?: string;
  code?: string;
  name?: string;
  description?: string;
  monthlyPrice?: number;
  annualPrice?: number;
  features?: string[];
  [key: string]: any;
};

export interface P360Session {
  token?: string;
  user?: {
    userId?: string;
    role?: string;
    memberId?: string;
    [key: string]: any;
  } | null;
  workspace?: {
    id?: string;
    name?: string;
    status?: string;
    defaultCurrency?: string;
    timezone?: string;
    logoUrl?: string | null;
    [key: string]: any;
  } | null;
  plan?: P360Plan | null;
  [key: string]: any;
}

// ── Token storage ──

export function getProject360Token(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setProject360Token(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, token);
}

function storeSession(session: P360Session): void {
  if (typeof window === 'undefined') return;
  if (session.token) localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearProject360Session(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

// ── API helper ──

/**
 * Wrapper de fetch para el backend de PROJECT360.
 * - Prefija las rutas con `/api` (Nginx reescribe al backend).
 * - Agrega el token P360 en el header Authorization.
 * - Setea Content-Type JSON por defecto.
 * Devuelve la Response cruda (el caller maneja .ok / .json()).
 */
export async function p360Fetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getProject360Token();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const url = path.startsWith('/api') ? path : `/api${path}`;
  return fetch(url, { ...init, headers, credentials: 'include' });
}

// ── Auth flows ──

/**
 * Intercambia el JWT de SGI360 por un token PROJECT360 y devuelve la sesión.
 * El backend hace auto-provisioning del workspace en el primer acceso.
 */
export async function loginProject360(
  sgi360Token: string,
  tenantId: string
): Promise<P360Session> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${sgi360Token}`,
  };
  if (tenantId) headers['x-tenant-id'] = tenantId;

  const res = await fetch('/api/project360/auth/login', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || 'No se pudo iniciar sesión en PROJECT360');
  }

  const session = (await res.json()) as P360Session;
  storeSession(session);
  return session;
}

/**
 * Verifica el token P360 actual contra el backend y devuelve la sesión.
 * Si no hay token o es inválido, limpia la sesión y devuelve null.
 */
export async function verifyProject360Session(): Promise<P360Session | null> {
  const token = getProject360Token();
  if (!token) return null;

  try {
    const res = await p360Fetch('/project360/auth/me');
    if (!res.ok) {
      clearProject360Session();
      return null;
    }
    const session = (await res.json()) as P360Session;
    storeSession({ token, ...session });
    return { token, ...session };
  } catch {
    return null;
  }
}

/**
 * Cierra la sesión PROJECT360 (best-effort en backend) y limpia el storage local.
 */
export async function logoutProject360(): Promise<void> {
  try {
    await p360Fetch('/project360/auth/logout', { method: 'POST' });
  } catch {
    /* ignore */
  } finally {
    clearProject360Session();
  }
}
