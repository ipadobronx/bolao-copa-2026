import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const bodySchema = z.object({
  nome: z.string().trim().min(2).max(80),
  codigo: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{3,30}$/, 'Use 3-30 caracteres: a-z, 0-9, _ ou -'),
  contato: z.string().trim().max(120).nullable().optional(),
  comissao_pct: z.number().min(0).max(100),
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
  // Cast: types Supabase auto-gerados ainda não conhecem `afiliados` (tabela criada em F21).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any)
    .from('afiliados')
    .insert({
      nome: parsed.data.nome,
      codigo: parsed.data.codigo,
      contato: parsed.data.contato ?? null,
      comissao_pct: parsed.data.comissao_pct,
      notes: parsed.data.notes ?? null,
    })
    .select('id, codigo')
    .single();

  if (error) {
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Código já existe' }, { status: 409 });
    }
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id as string, codigo: data.codigo as string });
}
