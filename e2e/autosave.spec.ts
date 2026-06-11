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

  // Regressão: o palpite tem que SOBREVIVER ao reload. O bug original mostrava
  // "✓ Salvo" mas voltava a zero ao recarregar (write fantasma).
  await page.reload();
  await expect(page.locator('text=Grupos')).toBeVisible();

  const reloadedInputs = page.locator('input[type="number"]:not([readonly])');
  await expect(reloadedInputs.first()).toBeVisible({ timeout: 10_000 });
  await expect(reloadedInputs.nth(0)).toHaveValue('2');
  await expect(reloadedInputs.nth(1)).toHaveValue('1');
});

test('auto-save: palpite não se perde ao navegar ANTES do debounce (flush)', async ({ page }) => {
  // Regressão do bug relatado: usuário digita o placar e troca de tela/atualiza
  // dentro de 1s; o cleanup antigo só cancelava o timer (nunca gravava), então o
  // palpite "sumia" no reload. O fix dá flush no blur/unmount.
  const { bilheteId } = getSetupState();

  await loginAs(page, E2E_USER1_EMAIL, E2E_USER1_PASS);
  await page.goto(`/palpites/${bilheteId}`);
  await expect(page.locator('text=Grupos')).toBeVisible();

  const openInputs = page.locator('input[type="number"]:not([readonly])');
  await expect(openInputs.first()).toBeVisible({ timeout: 10_000 });

  // 2º jogo aberto (índices 2/3), valores distintos do teste acima pra não colidir
  await openInputs.nth(2).fill('3');
  await openInputs.nth(3).fill('0');

  // navega via link do app (soft-nav) IMEDIATAMENTE, sem esperar o debounce de 1s.
  // o flush (blur + unmount) precisa garantir a gravação.
  await page.locator('a[href="/minhas-tabelas"]').first().click();
  await expect(page).toHaveURL(/\/minhas-tabelas/);
  await page.waitForTimeout(2_000); // deixa o save assíncrono concluir

  // volta e confere que o palpite persistiu
  await page.goto(`/palpites/${bilheteId}`);
  await expect(page.locator('text=Grupos')).toBeVisible();
  const reloaded = page.locator('input[type="number"]:not([readonly])');
  await expect(reloaded.first()).toBeVisible({ timeout: 10_000 });
  await expect(reloaded.nth(2)).toHaveValue('3');
  await expect(reloaded.nth(3)).toHaveValue('0');
});
