import { NextRequest, NextResponse } from 'next/server';

function getApiBases() {
  // Prioritize API_URL (server-side internal URL) over NEXT_PUBLIC_API_URL (browser URL)
  // because this code runs on the server and may not reach the public URL.
  // Also filter out relative URLs like "/api" which only work in the browser.
  const isAbsolute = (v?: string) => !!v && /^https?:\/\//.test(v);
  const candidates = [
    process.env.API_URL,
    process.env.NEXT_PUBLIC_API_URL,
    'http://localhost:3002',
  ];
  const bases = candidates
    .filter((v): v is string => isAbsolute(v))
    .map((v) => (v.endsWith('/') ? v.slice(0, -1) : v));
  return Array.from(new Set(bases));
}

async function fetchWithFallback(path: string, init: RequestInit) {
  const bases = getApiBases();
  let lastError: unknown = null;

  for (const base of bases) {
    try {
      return await fetch(`${base}${path}`, init);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('API unreachable');
}

export async function POST(request: NextRequest) {
  console.log('🔵 [Route Handler] POST /api/auth/login called');
  try {
    const body = await request.json();
    const { email, password } = body;
    console.log('📧 [Route Handler] Received credentials:', { email });

    // Forward to API server
    const response = await fetchWithFallback('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log('📡 [Route Handler] API Response:', data);

    if (!response.ok) {
      console.error('❌ [Route Handler] API returned error:', response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    // Transform API response to frontend expected format
    console.log('✅ [Route Handler] Transforming response...');
    const transformedData = {
      accessToken: data.accessToken,
      token: data.accessToken,
      requires2FA: data.requires2FA || false,
      sessionToken: data.sessionToken,
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      } : undefined,
      activeTenant: data.activeTenant,
      tenantRole: data.tenantRole,
      csrfToken: data.csrfToken,
    };

    console.log('✅ [Route Handler] Transformed data:', transformedData);
    
    // Create response and set cookies
    const res = NextResponse.json(transformedData);
    
    // Set access_token cookie for middleware
    if (data.accessToken) {
      res.cookies.set('access_token', data.accessToken, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: false, // development
      });
    }
    
    // Set csrf_token cookie
    if (data.csrfToken) {
      res.cookies.set('csrf_token', data.csrfToken, {
        path: '/',
        httpOnly: false, // needs to be readable by JavaScript
        sameSite: 'lax',
        secure: false, // development
      });
    }
    
    return res;
  } catch (error: any) {
    console.error('❌ [Route Handler] Error:', error);
    return NextResponse.json(
      { error: 'No se pudo conectar con la API (puertos 3001/3002)' },
      { status: 500 }
    );
  }
}
