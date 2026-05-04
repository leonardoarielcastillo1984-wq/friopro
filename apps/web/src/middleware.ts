import { NextRequest, NextResponse } from 'next/server';

// Public routes that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/login',
  '/login-simple',
  '/register',
  '/suite',
  '/api',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/landing',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is public
  const isPublicPath = PUBLIC_PATHS.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  );
  
  if (isPublicPath) {
    return NextResponse.next();
  }
  
  // Check for access token cookie (httpOnly, sent by browser)
  const accessToken = request.cookies.get('access_token')?.value;
  
  if (!accessToken) {
    // Redirect to suite page for module selection (which will lead to login)
    const url = request.nextUrl.clone();
    url.pathname = '/suite';
    return NextResponse.redirect(url);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all app routes except public ones
    '/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)',
  ],
};
