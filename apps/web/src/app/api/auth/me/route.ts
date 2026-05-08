import { NextRequest, NextResponse } from 'next/server';
import { getServerApiBase } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

async function fetchWithFallback(path: string, init: RequestInit) {
  return fetch(`${getServerApiBase()}${path}`, init);
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
      { error: 'No se pudo conectar con la API' },
      { status: 500 }
    );
  }
}
