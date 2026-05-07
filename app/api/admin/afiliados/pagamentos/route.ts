import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  afiliado_id: z.string().uuid(),
  valor: z.number().positive().max(1_000_000),
  metodo: z.string().trim().min(1).max(40).default('pix'),
  referencia: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
});

async function requireAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Não autenticado', status: 401 as const };
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();
  if (!profile?.is_admin) return { error: 'Acesso negado', status: 403 as const };
  return { error: null, status: null };
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  // Cast: types Supabase auto-gerados ainda não conhecem `afiliado_pagamentos`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('afiliado_pagamentos')
    .insert({
      afiliado_id: parsed.data.afiliado_id,
      valor: parsed.data.valor,
      metodo: parsed.data.metodo,
      referencia: parsed.data.referencia ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select('id, pago_em, valor')
    .single();

  if (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  return NextResponse.json(data);
}
