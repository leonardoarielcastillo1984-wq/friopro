import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Convertir FormData a objeto
    const data = {
      companyName: formData.get('companyName'),
      socialReason: formData.get('socialReason'),
      rut: formData.get('rut'),
      email: formData.get('email'),
      phone: formData.get('phone'),
      website: formData.get('website'),
      address: formData.get('address'),
      primaryColor: formData.get('primaryColor'),
      logo: formData.get('logo'), // File object
    };

    // Preparar datos para el API de Fastify
    const requestBody = new FormData();
    requestBody.append('companyName', data.companyName as string);
    requestBody.append('socialReason', data.socialReason as string);
    requestBody.append('rut', data.rut as string);
    requestBody.append('email', data.email as string);
    requestBody.append('phone', data.phone as string);
    requestBody.append('website', data.website as string);
    requestBody.append('address', data.address as string);
    requestBody.append('primaryColor', data.primaryColor as string);

    if (data.logo) {
      requestBody.append('logo', data.logo as File);
    }

    // Enviar al API de Fastify
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/register-company`, {
      method: 'POST',
      body: requestBody,
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error registering company:', error);
    return NextResponse.json(
      { error: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}
