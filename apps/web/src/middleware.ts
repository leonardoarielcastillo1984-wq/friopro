import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Completely disabled for debugging
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
