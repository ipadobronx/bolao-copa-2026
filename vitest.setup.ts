import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// 'server-only' is a no-op marker package that errors at build time when imported
// from a Client Component. In Vitest (jsdom env) we mock it so libs that import
// 'server-only' (lib/env-server, lib/mercadopago, lib/mercadopago.io) load cleanly.
vi.mock('server-only', () => ({}));
