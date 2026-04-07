import { NextRequest, NextResponse } from 'next/server';

function getApiBases() {
  const configured = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  const bases = [configured, 'http://localhost:3001', 'http://localhost:3002']
    .filter((v): v is string => Boolean(v))
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

export async function GET(request: NextRequest) {
  console.log('🔵 [Route Handler] GET /api/auth/me called');
  
  try {
    // Get token from cookie
    const accessToken = request.cookies.get('access_token')?.value;
    
    if (!accessToken) {
      console.log('❌ No access_token cookie found');
      return NextResponse.json({ error: 'No token found' }, { status: 401 });
    }

    // Forward to API server
    const response = await fetchWithFallback('/api/auth/me', {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
    });

    const data = await response.json();
    console.log('📡 [Route Handler] API Response:', data);

    if (!response.ok) {
      console.error('❌ [Route Handler] API returned error:', response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('✅ [Route Handler] User authenticated:', data.user?.email);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ [Route Handler] Error:', error);
    return NextResponse.json(
      { error: 'No se pudo conectar con la API (puertos 3001/3002)' },
      { status: 500 }
    );
  }
}
