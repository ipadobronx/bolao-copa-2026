import { NextResponse, type NextRequest } from 'next/server';
import { updateSupabaseSession } from '@/lib/supabase/middleware';

const PROTECTED = /^\/(dashboard|admin|palpites|ranking)(\/|$)/;

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSupabaseSession(request);
  const path = request.nextUrl.pathname;

  if (PROTECTED.test(path) && !user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('next', path + request.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (path === '/login' && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
