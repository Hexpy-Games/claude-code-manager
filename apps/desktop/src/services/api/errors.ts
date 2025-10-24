/**
 * API Error Classes
 *
 * Custom error classes for handling different types of API errors.
 */

/**
 * Base API error class
 *
 * All API-related errors extend from this class.
 */
export class ApiError extends Error {
  /**
   * Creates a new API error
   *
   * @param message - Human-readable error message
   * @param statusCode - HTTP status code
   * @param errorType - Error type/code
   * @param issues - Optional validation issues (for 400 errors)
   */
  constructor(
    message: string,
    public statusCode: number,
    public errorType: string,
    // biome-ignore lint/suspicious/noExplicitAny: Issues have dynamic structure
    public issues?: any[]
  ) {
    super(message);
    this.name = 'ApiError';
    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

/**
 * Validation error (400 Bad Request)
 *
 * Thrown when request data fails validation.
 */
export class ValidationError extends ApiError {
  /**
   * Creates a new validation error
   *
   * @param message - Human-readable error message
   * @param issues - Optional validation issues detailing what failed
   */
  // biome-ignore lint/suspicious/noExplicitAny: Issues have dynamic structure
  constructor(message: string, issues?: any[]) {
    super(message, 400, 'ValidationError', issues);
    this.name = 'ValidationError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }
}

/**
 * Not found error (404 Not Found)
 *
 * Thrown when a requested resource doesn't exist.
 */
export class NotFoundError extends ApiError {
  /**
   * Creates a new not found error
   *
   * @param message - Human-readable error message
   */
  constructor(message: string) {
    super(message, 404, 'NotFoundError');
    this.name = 'NotFoundError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotFoundError);
    }
  }
}

/**
 * Network error (503 Service Unavailable)
 *
 * Thrown when network connectivity issues occur.
 */
export class NetworkError extends ApiError {
  /**
   * Creates a new network error
   *
   * @param message - Human-readable error message
   */
  constructor(message: string) {
    super(message, 503, 'NetworkError');
    this.name = 'NetworkError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NetworkError);
    }
  }
}

/**
 * Timeout error (408 Request Timeout)
 *
 * Thrown when a request exceeds the configured timeout.
 */
export class TimeoutError extends ApiError {
  /**
   * Creates a new timeout error
   *
   * @param message - Human-readable error message
   */
  constructor(message: string) {
    super(message, 408, 'TimeoutError');
    this.name = 'TimeoutError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, TimeoutError);
    }
  }
}

/**
 * Type guard to check if an error is an API error
 *
 * @param error - Error to check
 * @returns True if error is an ApiError instance
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
