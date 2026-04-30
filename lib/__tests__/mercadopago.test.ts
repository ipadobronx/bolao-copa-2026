import { describe, expect, it } from 'vitest';
import { validarAssinaturaWebhook } from '@/lib/mercadopago';

const SECRET = 'test-secret';
const DATA_ID = '12345';
const REQUEST_ID = 'req-abc';
const TS = '1735689600';
const HMAC_VALIDO = 'bc19fc9b52d6c2f95e719c8646f25d03dd3562af2c8ecbb7a0b97fe5ad2c3e17';

describe('lib/mercadopago — validarAssinaturaWebhook', () => {
  it('aceita assinatura válida', () => {
    const ok = validarAssinaturaWebhook({
      x_signature: `ts=${TS},v1=${HMAC_VALIDO}`,
      x_request_id: REQUEST_ID,
      data_id: DATA_ID,
      secret: SECRET,
    });
    expect(ok).toBe(true);
  });

  it('rejeita assinatura adulterada (1 char trocado)', () => {
    const last = HMAC_VALIDO.slice(-1);
    const replacement = last === 'a' ? 'b' : 'a';
    const adulterado = HMAC_VALIDO.slice(0, -1) + replacement;
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${adulterado}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita timestamp diferente', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=9999999999,v1=${HMAC_VALIDO}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita data_id diferente', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${HMAC_VALIDO}`,
        x_request_id: REQUEST_ID,
        data_id: 'other-id',
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita request_id diferente', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${HMAC_VALIDO}`,
        x_request_id: 'other-req',
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita secret diferente', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${HMAC_VALIDO}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: 'other-secret',
      }),
    ).toBe(false);
  });

  it('rejeita header sem ts=', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `v1=${HMAC_VALIDO}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita header sem v1=', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita header vazio', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: '',
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('rejeita v1 não-hex sem throw (graceful)', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=not-hex-string`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(false);
  });

  it('aceita extra keys no header (parse robusto)', () => {
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${HMAC_VALIDO},extra=ignored`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: SECRET,
      }),
    ).toBe(true);
  });

  it('catch block: retorna false em vez de propagar exception (secret inválido)', () => {
    // crypto.createHmac lança TypeError quando secret não é string/Buffer
    expect(
      validarAssinaturaWebhook({
        x_signature: `ts=${TS},v1=${HMAC_VALIDO}`,
        x_request_id: REQUEST_ID,
        data_id: DATA_ID,
        secret: null as unknown as string,
      }),
    ).toBe(false);
  });
});
