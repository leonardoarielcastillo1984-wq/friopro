import { NextRequest, NextResponse } from 'next/server';

function getApiBase() {
  const raw = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || 'http://localhost:3002';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionToken } = body;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Missing sessionToken' },
        { status: 400 }
      );
    }

    // Forward to API server
    const response = await fetch(`${getApiBase()}/api/auth/2fa-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Transform response
    const transformedData = {
      token: data.accessToken || data.token,
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      } : undefined,
      activeTenant: data.activeTenant,
      tenantRole: data.tenantRole,
    };

    return NextResponse.json(transformedData);
  } catch (error: any) {
    console.error('2FA complete error:', error);
    return NextResponse.json(
      { error: error.message || '2FA completion failed' },
      { status: 500 }
    );
  }
}
