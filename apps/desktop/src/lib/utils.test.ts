import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge class names', () => {
    expect(cn('class-1', 'class-2')).toBe('class-1 class-2');
  });

  it('should handle conditional classes', () => {
    expect(cn('base', false && 'conditional')).toBe('base');
    expect(cn('base', true && 'conditional')).toBe('base conditional');
  });

  it('should merge Tailwind classes without conflicts', () => {
    // Tailwind-merge should handle conflicting utilities
    expect(cn('px-2 py-1', 'p-3')).toBe('p-3');
  });

  it('should handle undefined and null values', () => {
    expect(cn('base', undefined, null, 'valid')).toBe('base valid');
  });

  it('should handle arrays of classes', () => {
    expect(cn(['class-1', 'class-2'])).toBe('class-1 class-2');
  });
});
