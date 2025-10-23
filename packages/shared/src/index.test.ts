import { describe, it, expect } from 'vitest';

describe('Project Setup', () => {
  it('should run tests successfully', () => {
    expect(true).toBe(true);
  });

  it('should perform basic assertions', () => {
    const sum = 1 + 1;
    expect(sum).toBe(2);
  });

  it('should handle strings', () => {
    const message = 'Hello, Claude Code Manager';
    expect(message).toContain('Claude Code');
  });
});
