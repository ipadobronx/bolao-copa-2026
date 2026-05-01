import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  const envPath = join(process.cwd(), '.env.local');
  const content = readFileSync(envPath, 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

export const E2E_USER1_EMAIL = 'e2e_f7_user1@bolao.test';
export const E2E_USER1_PASS = 'E2eF7User1!';
export const E2E_USER2_EMAIL = 'e2e_f7_user2@bolao.test';
export const E2E_USER2_PASS = 'E2eF7User2!';

export default async function globalSetup() {
  loadEnvLocal();

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // Create or retrieve user1
  let user1Id: string;
  const { data: created1, error: err1 } = await admin.auth.admin.createUser({
    email: E2E_USER1_EMAIL,
    password: E2E_USER1_PASS,
    email_confirm: true,
    user_metadata: { nome: 'E2E User 1' },
  });
  if (err1) {
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find((u) => u.email === E2E_USER1_EMAIL);
    if (!existing) throw new Error(`Could not create or find user1: ${err1.message}`);
    user1Id = existing.id;
  } else {
    user1Id = created1.user.id;
  }

  // Create or retrieve user2 (only needs to exist for auth)
  const { error: err2 } = await admin.auth.admin.createUser({
    email: E2E_USER2_EMAIL,
    password: E2E_USER2_PASS,
    email_confirm: true,
    user_metadata: { nome: 'E2E User 2' },
  });
  if (err2 && !err2.message.includes('already')) {
    console.warn('user2 create warning:', err2.message);
  }

  // Ensure profile exists for user1
  await admin.from('profiles').upsert({ id: user1Id, nome: 'E2E User 1', email: E2E_USER1_EMAIL });

  // Find or create confirmed bilhete for user1
  const { data: existing } = await admin
    .from('bilhetes')
    .select('id')
    .eq('user_id', user1Id)
    .eq('status_pagamento', 'confirmado')
    .limit(1)
    .single();

  let bilheteId: string;
  if (existing) {
    bilheteId = existing.id;
  } else {
    const { data: novo, error: bilheteErr } = await admin
      .from('bilhetes')
      .insert({
        user_id: user1Id,
        status_pagamento: 'confirmado',
        valor_pago: 20.0,
        pago_em: new Date().toISOString(),
      })
      .select('id')
      .single();
    if (bilheteErr || !novo) throw new Error(`Could not create bilhete: ${bilheteErr?.message}`);
    bilheteId = novo.id;
  }

  // Lock game #1 by moving its data_hora to the past
  const { data: game1 } = await admin
    .from('jogos')
    .select('id, data_hora')
    .order('numero_jogo', { ascending: true })
    .limit(1)
    .single();

  if (!game1) throw new Error('No games found in DB');

  const pastDataHora = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await admin.from('jogos').update({ data_hora: pastDataHora }).eq('id', game1.id);

  // Write state for tests
  const state = {
    bilheteId,
    user1Id,
    lockedGameId: game1.id,
    lockedGameOriginalDataHora: game1.data_hora,
  };
  writeFileSync(join(process.cwd(), 'e2e/setup/.state.json'), JSON.stringify(state, null, 2));

  console.log('\n[E2E Setup] bilheteId:', bilheteId);
  console.log('[E2E Setup] lockedGameId:', game1.id);
}
