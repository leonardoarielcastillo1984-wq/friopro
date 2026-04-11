import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionToken, code } = body;

    if (!sessionToken || !code) {
      return NextResponse.json(
        { error: 'Missing sessionToken or code' },
        { status: 400 }
      );
    }

    // Forward to API server
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/2fa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionToken, token: code }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    // Transform response
    const transformedData = {
      token: data.accessToken || data.token,
      sessionToken: data.sessionToken,
      user: data.user ? {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
      } : undefined,
    };

    return NextResponse.json(transformedData);
  } catch (error: any) {
    console.error('2FA verification error:', error);
    return NextResponse.json(
      { error: error.message || '2FA verification failed' },
      { status: 500 }
    );
  }
}
