import { test, expect } from '@playwright/test';
import { loginAs, getSetupState, E2E_USER1_EMAIL, E2E_USER1_PASS } from './helpers';

test('janela fechada: jogo com data_hora no passado exibe "🔒 Fechado" e inputs readonly', async ({
  page,
}) => {
  const { bilheteId } = getSetupState();

  await loginAs(page, E2E_USER1_EMAIL, E2E_USER1_PASS);
  await page.goto(`/palpites/${bilheteId}`);

  // Grupos tab should be active by default
  await expect(page.locator('text=Grupos')).toBeVisible();

  // Game #1 was moved to the past in globalSetup — its MatchRow should show the locked chip
  await expect(page.getByText('🔒 Fechado').first()).toBeVisible({ timeout: 10_000 });

  // The locked game's inputs must have the readOnly attribute
  const readonlyInputs = page.locator('input[type="number"][readonly]');
  await expect(readonlyInputs.first()).toBeVisible();
});
