/**
 * Unit tests for storage utility
 * Tests localStorage wrapper with error handling, sanitization, and cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getStorageItem,
  setStorageItem,
  removeStorageItem,
  sanitizeDraft,
  sanitizeScrollPosition,
  parseScrollPosition,
} from './storage';

describe('storage utility', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getStorageItem', () => {
    it('should return value from localStorage', () => {
      localStorage.setItem('test-key', 'test-value');
      expect(getStorageItem('test-key')).toBe('test-value');
    });

    it('should return null for non-existent key', () => {
      expect(getStorageItem('non-existent')).toBeNull();
    });

    it('should handle errors gracefully and return null', () => {
      const originalGetItem = Storage.prototype.getItem;
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('Test error');
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(getStorageItem('test-key')).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to read from localStorage')
      );

      Storage.prototype.getItem = originalGetItem;
      consoleWarnSpy.mockRestore();
    });
  });

  describe('setStorageItem', () => {
    it('should set value in localStorage and return true', () => {
      const result = setStorageItem('test-key', 'test-value');
      expect(result).toBe(true);
      expect(localStorage.getItem('test-key')).toBe('test-value');
    });

    it('should return false when setItem throws an error', () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('Generic error');
      });

      const result = setStorageItem('test-key', 'test-value');
      expect(result).toBe(false);

      Storage.prototype.setItem = originalSetItem;
    });

    it('should handle multiple key-value pairs', () => {
      expect(setStorageItem('key1', 'value1')).toBe(true);
      expect(setStorageItem('key2', 'value2')).toBe(true);
      expect(setStorageItem('key3', 'value3')).toBe(true);

      expect(localStorage.getItem('key1')).toBe('value1');
      expect(localStorage.getItem('key2')).toBe('value2');
      expect(localStorage.getItem('key3')).toBe('value3');
    });
  });

  describe('removeStorageItem', () => {
    it('should remove item from localStorage', () => {
      localStorage.setItem('test-key', 'test-value');
      expect(localStorage.getItem('test-key')).toBe('test-value');

      removeStorageItem('test-key');
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    it('should handle errors gracefully', () => {
      const originalRemoveItem = Storage.prototype.removeItem;
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('Remove failed');
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Should not throw
      expect(() => removeStorageItem('test-key')).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to remove from localStorage')
      );

      Storage.prototype.removeItem = originalRemoveItem;
      consoleWarnSpy.mockRestore();
    });

    it('should not throw for non-existent key', () => {
      expect(() => removeStorageItem('non-existent')).not.toThrow();
    });
  });

  describe('sanitizeDraft', () => {
    it('should trim whitespace from draft', () => {
      expect(sanitizeDraft('  hello world  ')).toBe('hello world');
      expect(sanitizeDraft('\n\ntest\n\n')).toBe('test');
    });

    it('should preserve internal whitespace', () => {
      expect(sanitizeDraft('hello   world')).toBe('hello   world');
    });

    it('should truncate drafts exceeding 100,000 characters', () => {
      const longDraft = 'x'.repeat(150000);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = sanitizeDraft(longDraft);

      expect(result.length).toBe(100000);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Draft truncated from 150000 to 100000 chars')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle empty strings', () => {
      expect(sanitizeDraft('')).toBe('');
      expect(sanitizeDraft('   ')).toBe('');
    });

    it('should handle newlines and special characters', () => {
      const draft = '  Line 1\n  Line 2\n  Line 3  ';
      expect(sanitizeDraft(draft)).toBe('Line 1\n  Line 2\n  Line 3');
    });

    it('should not modify drafts under limit', () => {
      const normalDraft = 'x'.repeat(50000);
      expect(sanitizeDraft(normalDraft).length).toBe(50000);
    });

    it('should handle Unicode characters', () => {
      const unicode = '  Hello 世界 🌍  ';
      expect(sanitizeDraft(unicode)).toBe('Hello 世界 🌍');
    });
  });

  describe('sanitizeScrollPosition', () => {
    it('should convert valid scroll position to string', () => {
      expect(sanitizeScrollPosition(100)).toBe('100');
      expect(sanitizeScrollPosition(0)).toBe('0');
      expect(sanitizeScrollPosition(999999)).toBe('999999');
    });

    it('should floor decimal values', () => {
      expect(sanitizeScrollPosition(100.7)).toBe('100');
      expect(sanitizeScrollPosition(50.3)).toBe('50');
    });

    it('should convert negative values to 0', () => {
      expect(sanitizeScrollPosition(-100)).toBe('0');
      expect(sanitizeScrollPosition(-1)).toBe('0');
    });

    it('should cap values exceeding 1,000,000', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(sanitizeScrollPosition(2000000)).toBe('1000000');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Scroll position 2000000 exceeds maximum')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should handle edge case at boundary', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(sanitizeScrollPosition(1000000)).toBe('1000000');
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      expect(sanitizeScrollPosition(1000001)).toBe('1000000');
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should handle zero', () => {
      expect(sanitizeScrollPosition(0)).toBe('0');
    });
  });

  describe('parseScrollPosition', () => {
    it('should parse valid numeric strings', () => {
      expect(parseScrollPosition('100')).toBe(100);
      expect(parseScrollPosition('0')).toBe(0);
      expect(parseScrollPosition('999999')).toBe(999999);
    });

    it('should return null for null input', () => {
      expect(parseScrollPosition(null)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseScrollPosition('')).toBeNull();
    });

    it('should return null for NaN', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(parseScrollPosition('not-a-number')).toBeNull();
      expect(parseScrollPosition('abc123')).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });

    it('should return null for negative values', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(parseScrollPosition('-100')).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid scroll position: -100')
      );

      consoleWarnSpy.mockRestore();
    });

    it('should parse decimal strings', () => {
      expect(parseScrollPosition('100.5')).toBe(100.5);
    });

    it('should handle whitespace in strings', () => {
      expect(parseScrollPosition('  100  ')).toBe(100);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete draft workflow', () => {
      const sessionId = 'session_123';
      const draftKey = `draft_${sessionId}`;
      const userInput = '  This is a draft message  ';

      // Sanitize and save
      const sanitized = sanitizeDraft(userInput);
      expect(setStorageItem(draftKey, sanitized)).toBe(true);

      // Retrieve
      const retrieved = getStorageItem(draftKey);
      expect(retrieved).toBe('This is a draft message');

      // Clear
      removeStorageItem(draftKey);
      expect(getStorageItem(draftKey)).toBeNull();
    });

    it('should handle complete scroll position workflow', () => {
      const sessionId = 'session_456';
      const scrollKey = `scroll_${sessionId}`;
      const scrollTop = 12345.67;

      // Sanitize and save
      const sanitized = sanitizeScrollPosition(scrollTop);
      expect(setStorageItem(scrollKey, sanitized)).toBe(true);

      // Retrieve and parse
      const retrieved = getStorageItem(scrollKey);
      const parsed = parseScrollPosition(retrieved);
      expect(parsed).toBe(12345); // Floored

      // Clear
      removeStorageItem(scrollKey);
      expect(getStorageItem(scrollKey)).toBeNull();
    });

    it('should handle multiple sessions concurrently', () => {
      const sessions = ['sess_1', 'sess_2', 'sess_3'];

      // Save drafts for all sessions
      sessions.forEach((sessionId, index) => {
        const draftKey = `draft_${sessionId}`;
        const draft = `Draft for session ${index + 1}`;
        expect(setStorageItem(draftKey, sanitizeDraft(draft))).toBe(true);
      });

      // Verify all drafts are independent
      expect(getStorageItem('draft_sess_1')).toBe('Draft for session 1');
      expect(getStorageItem('draft_sess_2')).toBe('Draft for session 2');
      expect(getStorageItem('draft_sess_3')).toBe('Draft for session 3');

      // Remove one session
      removeStorageItem('draft_sess_2');
      expect(getStorageItem('draft_sess_1')).toBe('Draft for session 1');
      expect(getStorageItem('draft_sess_2')).toBeNull();
      expect(getStorageItem('draft_sess_3')).toBe('Draft for session 3');
    });
  });

  describe('XSS prevention', () => {
    it('should preserve script tags as text (React will escape them)', () => {
      const xssAttempt = '<script>alert("XSS")</script>';
      const sanitized = sanitizeDraft(xssAttempt);

      // sanitizeDraft preserves the text (doesn't strip HTML)
      // Actual XSS prevention happens in React's JSX rendering
      expect(sanitized).toBe(xssAttempt);
    });

    it('should preserve HTML as text', () => {
      const htmlInjection = '<img src=x onerror=alert(1)>';
      const sanitized = sanitizeDraft(htmlInjection);

      // We store it as-is, React escapes it when rendering
      expect(sanitized).toBe(htmlInjection);
    });

    it('should truncate malicious payloads exceeding length limit', () => {
      const longXSS = '<script>' + 'x'.repeat(200000) + '</script>';
      const sanitized = sanitizeDraft(longXSS);

      // Even malicious content gets truncated
      expect(sanitized.length).toBe(100000);
      expect(sanitized).toContain('<script>');
    });
  });

  describe('Error recovery', () => {
    it('should gracefully degrade when localStorage is completely disabled', () => {
      const originalSetItem = Storage.prototype.setItem;
      const originalGetItem = Storage.prototype.getItem;
      const originalRemoveItem = Storage.prototype.removeItem;

      Storage.prototype.setItem = vi.fn(() => {
        throw new Error('SecurityError: localStorage disabled');
      });
      Storage.prototype.getItem = vi.fn(() => {
        throw new Error('SecurityError: localStorage disabled');
      });
      Storage.prototype.removeItem = vi.fn(() => {
        throw new Error('SecurityError: localStorage disabled');
      });

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Application should continue working even if storage fails
      expect(setStorageItem('key', 'value')).toBe(false);
      expect(getStorageItem('key')).toBeNull();
      expect(() => removeStorageItem('key')).not.toThrow();

      Storage.prototype.setItem = originalSetItem;
      Storage.prototype.getItem = originalGetItem;
      Storage.prototype.removeItem = originalRemoveItem;
      consoleWarnSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('should handle very long keys', () => {
      const longKey = 'key_' + 'x'.repeat(1000);
      expect(setStorageItem(longKey, 'value')).toBe(true);
      expect(getStorageItem(longKey)).toBe('value');
    });

    it('should handle empty values', () => {
      expect(setStorageItem('empty-key', '')).toBe(true);
      expect(getStorageItem('empty-key')).toBe('');
    });

    it('should handle values with special characters', () => {
      const specialValue = '{"key": "value", "nested": {"array": [1,2,3]}}';
      expect(setStorageItem('json-key', specialValue)).toBe(true);
      expect(getStorageItem('json-key')).toBe(specialValue);
    });

    it('should handle scroll position edge values', () => {
      expect(sanitizeScrollPosition(0)).toBe('0');
      expect(sanitizeScrollPosition(Number.MAX_SAFE_INTEGER)).toBe('1000000'); // Capped
      expect(sanitizeScrollPosition(Number.NEGATIVE_INFINITY)).toBe('0');
    });

    it('should handle draft edge values', () => {
      expect(sanitizeDraft('')).toBe('');
      expect(sanitizeDraft('a')).toBe('a');
      expect(sanitizeDraft('a'.repeat(100000))).toBe('a'.repeat(100000)); // At limit
    });
  });
});
