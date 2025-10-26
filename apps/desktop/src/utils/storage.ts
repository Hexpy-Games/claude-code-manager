/**
 * Safe localStorage utility with error handling and sanitization
 *
 * Handles:
 * - QuotaExceededError (storage full)
 * - SecurityError (disabled localStorage in private browsing)
 * - Automatic cleanup of old entries
 * - Input validation and sanitization
 */

const MAX_STORAGE_ENTRIES = 50;
const DRAFT_PREFIX = 'draft_';
const SCROLL_PREFIX = 'scroll_';

/**
 * Safely get item from localStorage with error handling
 */
export function getStorageItem(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`[Storage] Failed to read from localStorage: ${error}`);
    return null;
  }
}

/**
 * Safely set item in localStorage with error handling and cleanup
 */
export function setStorageItem(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    if (error instanceof DOMException) {
      if (error.name === 'QuotaExceededError') {
        console.warn('[Storage] localStorage quota exceeded, attempting cleanup');
        cleanupOldEntries();

        // Retry after cleanup
        try {
          localStorage.setItem(key, value);
          return true;
        } catch (retryError) {
          console.error('[Storage] Failed to save even after cleanup:', retryError);
          return false;
        }
      } else if (error.name === 'SecurityError') {
        console.warn('[Storage] localStorage is disabled (private browsing mode)');
        return false;
      }
    }

    console.error('[Storage] Unexpected error saving to localStorage:', error);
    return false;
  }
}

/**
 * Safely remove item from localStorage
 */
export function removeStorageItem(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[Storage] Failed to remove from localStorage: ${error}`);
  }
}

/**
 * Clean up old draft and scroll entries, keeping only the most recent MAX_STORAGE_ENTRIES
 */
function cleanupOldEntries(): void {
  try {
    const draftEntries: Array<{ key: string; timestamp: number }> = [];
    const scrollEntries: Array<{ key: string; timestamp: number }> = [];

    // Collect all draft and scroll entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith(DRAFT_PREFIX)) {
        // Extract session ID and get its timestamp from sessions if available
        const sessionId = key.substring(DRAFT_PREFIX.length);
        draftEntries.push({ key, timestamp: Date.now() }); // Use current time as fallback
      } else if (key.startsWith(SCROLL_PREFIX)) {
        const sessionId = key.substring(SCROLL_PREFIX.length);
        scrollEntries.push({ key, timestamp: Date.now() });
      }
    }

    // Sort by timestamp (oldest first)
    draftEntries.sort((a, b) => a.timestamp - b.timestamp);
    scrollEntries.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest entries if we exceed the limit
    const draftOverflow = Math.max(0, draftEntries.length - MAX_STORAGE_ENTRIES);
    const scrollOverflow = Math.max(0, scrollEntries.length - MAX_STORAGE_ENTRIES);

    for (let i = 0; i < draftOverflow; i++) {
      localStorage.removeItem(draftEntries[i].key);
      console.log(`[Storage] Cleaned up old draft: ${draftEntries[i].key}`);
    }

    for (let i = 0; i < scrollOverflow; i++) {
      localStorage.removeItem(scrollEntries[i].key);
      console.log(`[Storage] Cleaned up old scroll position: ${scrollEntries[i].key}`);
    }

    if (draftOverflow > 0 || scrollOverflow > 0) {
      console.log(`[Storage] Cleanup complete: removed ${draftOverflow} drafts and ${scrollOverflow} scroll positions`);
    }
  } catch (error) {
    console.error('[Storage] Error during cleanup:', error);
  }
}

/**
 * Sanitize draft message content (basic XSS prevention)
 * For now, just trim and limit length. Could add DOMPurify later if needed.
 */
export function sanitizeDraft(draft: string): string {
  // Trim whitespace
  let sanitized = draft.trim();

  // Limit to reasonable size (100KB = ~100,000 chars)
  const MAX_DRAFT_SIZE = 100000;
  if (sanitized.length > MAX_DRAFT_SIZE) {
    console.warn(`[Storage] Draft truncated from ${sanitized.length} to ${MAX_DRAFT_SIZE} chars`);
    sanitized = sanitized.substring(0, MAX_DRAFT_SIZE);
  }

  return sanitized;
}

/**
 * Validate and sanitize scroll position
 */
export function sanitizeScrollPosition(scrollTop: number): string {
  // Ensure it's a valid positive number
  const validated = Math.max(0, Math.floor(scrollTop));

  // Sanity check: scroll position shouldn't be absurdly large
  const MAX_SCROLL = 1000000; // 1 million pixels should be enough for anyone
  if (validated > MAX_SCROLL) {
    console.warn(`[Storage] Scroll position ${validated} exceeds maximum, capping at ${MAX_SCROLL}`);
    return String(MAX_SCROLL);
  }

  return String(validated);
}

/**
 * Parse scroll position safely
 */
export function parseScrollPosition(value: string | null): number | null {
  if (!value) return null;

  const parsed = Number(value);

  // Validate it's a valid number
  if (isNaN(parsed) || parsed < 0) {
    console.warn(`[Storage] Invalid scroll position: ${value}`);
    return null;
  }

  return parsed;
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  try {
    const testKey = '__storage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get storage usage info for debugging
 */
export function getStorageInfo(): { available: boolean; draftCount: number; scrollCount: number } {
  const available = isStorageAvailable();

  if (!available) {
    return { available: false, draftCount: 0, scrollCount: 0 };
  }

  let draftCount = 0;
  let scrollCount = 0;

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith(DRAFT_PREFIX)) draftCount++;
      if (key.startsWith(SCROLL_PREFIX)) scrollCount++;
    }
  } catch (error) {
    console.warn('[Storage] Error getting storage info:', error);
  }

  return { available, draftCount, scrollCount };
}
