import { test, expect } from '@playwright/test';
import { getSetupState } from './helpers';

test('outro usuário não consegue acessar bilhete alheio: redireciona para /login', async ({
  browser,
}) => {
  const { bilheteId } = getSetupState();

  // Fresh browser context = no cookies = unauthenticated
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  await page.goto(`/palpites/${bilheteId}`);

  // Should redirect to /login (with ?next= param)
  await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

  await ctx.close();
});
