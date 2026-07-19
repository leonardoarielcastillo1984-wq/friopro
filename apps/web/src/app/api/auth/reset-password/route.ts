import { NextRequest, NextResponse } from 'next/server';
import { getServerApiBase } from '@/lib/server-api';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const response = await fetch(`${getServerApiBase()}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: 'No se pudo conectar con la API' }, { status: 500 });
  }
}
