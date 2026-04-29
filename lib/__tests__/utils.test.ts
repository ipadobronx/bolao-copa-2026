import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (Tailwind class merger)', () => {
  it('merges classes', () => {
    expect(cn('px-2', 'py-1')).toBe('px-2 py-1');
  });

  it('resolves tailwind conflicts (later wins)', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('filters out falsy values', () => {
    expect(cn('px-2', false && 'py-1', null, undefined, 'text-sm')).toBe('px-2 text-sm');
  });
});
