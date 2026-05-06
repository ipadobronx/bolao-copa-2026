import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

// jsdom doesn't implement ResizeObserver — stub it so components that use it
// (e.g. GlobeCashback) don't throw in unit tests.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
