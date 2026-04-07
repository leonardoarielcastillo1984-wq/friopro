import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auditorId = params.id;
    const formData = await request.formData();
    
    // Forward to API
    const apiRes = await fetch(`http://localhost:3001/audit/auditors/${auditorId}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        'Cookie': request.headers.get('cookie') || '',
      },
    });

    const data = await apiRes.json();
    return NextResponse.json(data, { status: apiRes.status });
  } catch (error: any) {
    console.error('Proxy upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
