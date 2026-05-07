import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { AfiliadosClient, type AfiliadoStats } from './AfiliadosClient';

export const dynamic = 'force-dynamic';

export default async function AfiliadosPage() {
  const admin = createSupabaseAdminClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any).rpc('admin_afiliados_stats');
  const rows = ((data ?? []) as AfiliadoStats[]).map((r) => ({
    afiliado_id: r.afiliado_id,
    codigo: r.codigo,
    nome: r.nome,
    comissao_pct: Number(r.comissao_pct),
    total_vendas: Number(r.total_vendas),
    bilhetes_vendidos: Number(r.bilhetes_vendidos),
    comissao_devida: Number(r.comissao_devida),
    comissao_paga: Number(r.comissao_paga),
    saldo: Number(r.saldo),
  }));

  return (
    <section>
      <div className="mb-8">
        <h1 className="font-display text-text-primary text-4xl tracking-wide">
          Afi<span className="text-accent">liados</span>
        </h1>
        <p className="text-text-muted mt-1 text-sm">
          Copa 2026 · Vendas comissionadas via link rastreado
        </p>
      </div>
      <AfiliadosClient initialRows={rows} />
    </section>
  );
}
