import { createServerClient, type SetAllCookies } from '@supabase/ssr';
import type { User } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import type { Database } from '@/lib/supabase/types';

type CookieToSet = Parameters<SetAllCookies>[0][number];

export async function updateSupabaseSession(
  request: NextRequest,
): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet: CookieToSet[]) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() valida o JWT no servidor (vs getSession que só lê cookie).
  // Erros de rede / Auth indisponível não devem 500 a request: deixa
  // passar com user=null e cookies não-renovados; o middleware decide se
  // redireciona pra /login (rotas protegidas) ou segue (rotas públicas).
  let user: User | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // transient — segue com user=null
  }

  return { response, user };
}
