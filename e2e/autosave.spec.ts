import { test, expect } from '@playwright/test';
import { loginAs, getSetupState, E2E_USER1_EMAIL, E2E_USER1_PASS } from './helpers';

test('auto-save: preenche palpite, espera 1s, chip mostra ✓ Salvo', async ({ page }) => {
  const { bilheteId } = getSetupState();

  await loginAs(page, E2E_USER1_EMAIL, E2E_USER1_PASS);
  await page.goto(`/palpites/${bilheteId}`);

  // Wait for the grupos tab to render
  await expect(page.locator('text=Grupos')).toBeVisible();

  // Find the first pair of non-readonly score inputs (open game)
  // MatchRow renders two number inputs side by side; locked ones have readOnly
  const openInputs = page.locator('input[type="number"]:not([readonly])');
  await expect(openInputs.first()).toBeVisible({ timeout: 10_000 });

  // Fill home goals
  await openInputs.nth(0).fill('2');
  // Fill away goals (the immediate sibling pair)
  await openInputs.nth(1).fill('1');

  // Debounce fires after 1s — wait 1.5s to be safe
  await page.waitForTimeout(1_500);

  // Server action makes 4 Supabase roundtrips to a remote host; allow up to 15s
  await expect(page.getByText('✓ Salvo').first()).toBeVisible({ timeout: 15_000 });
});
