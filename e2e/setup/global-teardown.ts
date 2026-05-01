import { readFileSync } from 'fs';
import { join } from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvLocal() {
  try {
    const content = readFileSync(join(process.cwd(), '.env.local'), 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const value = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // env already loaded
  }
}

export default async function globalTeardown() {
  loadEnvLocal();

  const statePath = join(process.cwd(), 'e2e/setup/.state.json');
  let state: { lockedGameId: number; lockedGameOriginalDataHora: string };
  try {
    state = JSON.parse(readFileSync(statePath, 'utf-8'));
  } catch {
    console.warn('[E2E Teardown] State file not found, skipping game restore');
    return;
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  await admin
    .from('jogos')
    .update({ data_hora: state.lockedGameOriginalDataHora })
    .eq('id', state.lockedGameId);

  console.log('[E2E Teardown] Restored game', state.lockedGameId, 'to', state.lockedGameOriginalDataHora);
}
