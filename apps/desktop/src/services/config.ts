/**
 * API Configuration
 *
 * Configuration settings for API clients.
 */

/**
 * API client configuration interface
 */
export interface ApiConfig {
  /** Base URL for API requests */
  baseUrl: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts for failed requests */
  retryAttempts: number;
  /** Delay between retry attempts in milliseconds */
  retryDelay: number;
}

/**
 * Default API configuration
 */
export const defaultApiConfig: ApiConfig = {
  baseUrl: 'http://localhost:3000/api',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
};
