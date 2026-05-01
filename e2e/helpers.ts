import { readFileSync } from 'fs';
import { join } from 'path';
import type { Page } from '@playwright/test';

export function getSetupState(): {
  bilheteId: string;
  user1Id: string;
  lockedGameId: number;
  lockedGameOriginalDataHora: string;
} {
  return JSON.parse(readFileSync(join(process.cwd(), 'e2e/setup/.state.json'), 'utf-8'));
}

export async function loginAs(page: Page, email: string, password: string) {
  const res = await page.request.post('/api/e2e-login', {
    data: { email, password },
  });
  if (!res.ok()) {
    const body = await res.text();
    throw new Error(`e2e-login failed (${res.status()}): ${body}`);
  }
}

export const E2E_USER1_EMAIL = 'e2e_f7_user1@bolao.test';
export const E2E_USER1_PASS = 'E2eF7User1!';
export const E2E_USER2_EMAIL = 'e2e_f7_user2@bolao.test';
export const E2E_USER2_PASS = 'E2eF7User2!';
