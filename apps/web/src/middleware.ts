import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Disabled - let AppLayout handle auth redirect client-side
  // This matches testing behavior
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
