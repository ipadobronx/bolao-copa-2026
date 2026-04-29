import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';

type CookieToSet = Parameters<SetAllCookies>[0][number];

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() valida JWT no servidor (vs getSession que só lê cookie).
  // Erros de rede / Auth indisponível não devem 500 a request: deixa
  // passar com cookies não-renovados; redirecionamento de auth fica a
  // cargo da Feature 4.
  try {
    await supabase.auth.getUser();
  } catch {
    // transient — segue com cookies atuais
  }

  return response;
}
