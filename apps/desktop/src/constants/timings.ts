/**
 * Timing constants for the application
 * Centralized to avoid magic numbers scattered throughout the codebase
 */

/**
 * Debounce times for auto-save features
 */
export const DEBOUNCE_TIMES = {
  /** Time to wait before saving draft message to localStorage */
  DRAFT_SAVE_MS: 500,

  /** Time to wait before saving scroll position to localStorage */
  SCROLL_SAVE_MS: 500,

  /** Render throttle for streaming content updates (~60fps) */
  RENDER_THROTTLE_MS: 16,

  /** Minimum interval between renders for smooth updates */
  MIN_RENDER_INTERVAL_MS: 100,

  /** Time to wait before re-enabling auto-scroll after user scrolls */
  SCROLL_RESET_MS: 2000,

  /** Maximum time to wait for streaming response before forcing refresh */
  STREAMING_TIMEOUT_MS: 60000, // 1 minute

  /** Delay before checking if backend saved partial content after interrupt */
  INTERRUPT_REFETCH_DELAY_MS: 1000,

  /** Small delay to let refetch complete before clearing optimistic state */
  REFETCH_CLEAR_DELAY_MS: 500,

  /** Delay to prevent scroll saves during restoration */
  SCROLL_RESTORATION_DELAY_MS: 100,
} as const;

/**
 * Scroll behavior thresholds
 */
export const SCROLL_THRESHOLDS = {
  /** Distance from bottom (in pixels) to consider user "at bottom" */
  BOTTOM_THRESHOLD_PX: 100,

  /** Minimum scroll throttle time for smooth streaming updates */
  MIN_RENDER_INTERVAL_MS: 100,
} as const;

/**
 * Timeout values for various operations
 */
export const TIMEOUTS = {
  /** API request timeout (2 minutes for long operations) */
  API_TIMEOUT_MS: 120000,

  /** WebSocket connection timeout */
  WEBSOCKET_TIMEOUT_MS: 30000,
} as const;
