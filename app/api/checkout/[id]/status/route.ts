import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const parsed = paramsSchema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  // RLS garante que só vê os próprios bilhetes
  const { data, error } = await supabase
    .from('bilhetes_view')
    .select('id, effective_status, expira_em, mp_payment_id')
    .eq('id', parsed.data.id)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({
    status: data.effective_status,
    expira_em: data.expira_em,
  });
}
