import { NextResponse } from 'next/server';
import { getServerApiBase } from '@/lib/server-api';

export const runtime = 'nodejs';

// POST /api/leads — proxy server-side al API Fastify (evita CORS desde landings públicas)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const response = await fetch(`${getServerApiBase()}/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    return NextResponse.json(data, { status: response.status });
  } catch (err) {
    console.error('[api/leads] proxy error:', err);
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 500 });
  }
}
