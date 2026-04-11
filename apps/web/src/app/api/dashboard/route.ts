import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🔵 [Route Handler] GET /api/dashboard called');
  try {
    // Get access token from cookies
    const accessToken = request.cookies.get('access_token')?.value;
    
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get tenantId from user context in cookie or header
    let tenantId = request.headers.get('x-tenant-id');
    
    // Try to get from user cookie if not in header
    if (!tenantId) {
      try {
        const userCookie = request.cookies.get('user')?.value;
        if (userCookie) {
          const user = JSON.parse(decodeURIComponent(userCookie));
          tenantId = user?.activeTenant?.id;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    
    // Fallback to hardcoded only if still not found
    if (!tenantId) {
      tenantId = 'f20f0bfe-c1d8-40f6-8d36-97734881ffde';
    }

    // Forward to API server with tenant context
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3002'}/dashboard`, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'x-tenant-id': tenantId,
      },
    });

    const data = await response.json();
    console.log('📡 [Route Handler] API Response:', data);

    if (!response.ok) {
      console.error('❌ [Route Handler] API returned error:', response.status, data);
      return NextResponse.json(data, { status: response.status });
    }

    console.log('✅ [Route Handler] Dashboard data sent');
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('❌ [Route Handler] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Dashboard fetch failed' },
      { status: 500 }
    );
  }
}
