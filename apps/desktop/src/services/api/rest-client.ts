/**
 * REST API Client
 *
 * Client for making HTTP requests to the backend API with automatic retry,
 * timeout handling, and comprehensive error management.
 */

import type { ApiConfig } from '../config';
import { defaultApiConfig } from '../config';
import { ApiError, NetworkError, NotFoundError, TimeoutError, ValidationError } from './errors';
import type {
  ApiErrorResponse,
  CheckConflictsResponse,
  CreateSessionRequest,
  GetSettingResponse,
  HealthCheckResponse,
  Message,
  SendMessageResponse,
  Session,
  SetSettingResponse,
  Setting,
  UpdateSessionRequest,
} from './types';

/**
 * Request options for internal request method
 */
interface RequestOptions {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** API endpoint (without base URL) */
  endpoint: string;
  /** Request body */
  body?: unknown;
  /** Query parameters */
  params?: Record<string, string | boolean | number>;
}

/**
 * REST API Client
 *
 * Provides methods for interacting with all backend API endpoints.
 * Features automatic retries, timeout handling, and error parsing.
 *
 * @example
 * ```typescript
 * const client = new RestClient({
 *   baseUrl: 'http://localhost:3000/api',
 *   timeout: 30000,
 * });
 *
 * const session = await client.createSession({
 *   title: 'My Session',
 *   rootDirectory: '/path/to/repo',
 * });
 * ```
 */
export class RestClient {
  private config: ApiConfig;

  /**
   * Creates a new REST API client
   *
   * @param config - Optional configuration overrides
   */
  constructor(config?: Partial<ApiConfig>) {
    this.config = { ...defaultApiConfig, ...config };
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  /**
   * Creates a new session
   *
   * @param data - Session creation data
   * @returns Created session
   * @throws {ValidationError} If validation fails
   * @throws {NetworkError} If network request fails
   */
  async createSession(data: CreateSessionRequest): Promise<Session> {
    const response = await this.request<{ session: Session }>({
      method: 'POST',
      endpoint: '/sessions',
      body: data,
    });
    return response.session;
  }

  /**
   * Lists all sessions
   *
   * @returns Array of sessions
   * @throws {NetworkError} If network request fails
   */
  async listSessions(): Promise<Session[]> {
    const response = await this.request<{ sessions: Session[] }>({
      method: 'GET',
      endpoint: '/sessions',
    });
    return response.sessions;
  }

  /**
   * Gets a session by ID
   *
   * @param id - Session ID
   * @returns Session details
   * @throws {NotFoundError} If session doesn't exist
   * @throws {NetworkError} If network request fails
   */
  async getSession(id: string): Promise<Session> {
    const response = await this.request<{ session: Session }>({
      method: 'GET',
      endpoint: `/sessions/${id}`,
    });
    return response.session;
  }

  /**
   * Updates a session
   *
   * @param id - Session ID
   * @param data - Update data
   * @returns Updated session
   * @throws {NotFoundError} If session doesn't exist
   * @throws {ValidationError} If validation fails
   * @throws {NetworkError} If network request fails
   */
  async updateSession(id: string, data: UpdateSessionRequest): Promise<Session> {
    const response = await this.request<{ session: Session }>({
      method: 'PATCH',
      endpoint: `/sessions/${id}`,
      body: data,
    });
    return response.session;
  }

  /**
   * Deletes a session
   *
   * @param id - Session ID
   * @param deleteGitBranch - Whether to delete the associated git branch
   * @throws {NotFoundError} If session doesn't exist
   * @throws {NetworkError} If network request fails
   */
  async deleteSession(id: string, deleteGitBranch = false): Promise<void> {
    await this.request<{ message: string }>({
      method: 'DELETE',
      endpoint: `/sessions/${id}`,
      params: deleteGitBranch ? { deleteGitBranch: true } : undefined,
    });
  }

  /**
   * Switches to a different active session
   *
   * @param id - Session ID to switch to
   * @returns Activated session
   * @throws {NotFoundError} If session doesn't exist
   * @throws {NetworkError} If network request fails
   */
  async switchSession(id: string): Promise<Session> {
    const response = await this.request<{ session: Session }>({
      method: 'POST',
      endpoint: `/sessions/${id}/switch`,
    });
    return response.session;
  }

  // ============================================================================
  // Message Management
  // ============================================================================

  /**
   * Gets all messages for a session
   *
   * @param sessionId - Session ID
   * @returns Array of messages
   * @throws {NotFoundError} If session doesn't exist
   * @throws {NetworkError} If network request fails
   */
  async getMessages(sessionId: string): Promise<Message[]> {
    const response = await this.request<{ messages: Message[] }>({
      method: 'GET',
      endpoint: `/sessions/${sessionId}/messages`,
    });
    return response.messages;
  }

  /**
   * Sends a message to a session
   *
   * @param sessionId - Session ID
   * @param content - Message content
   * @returns User and assistant messages
   * @throws {ValidationError} If content is empty
   * @throws {NotFoundError} If session doesn't exist
   * @throws {NetworkError} If network request fails
   */
  async sendMessage(sessionId: string, content: string): Promise<SendMessageResponse> {
    const response = await this.request<SendMessageResponse>({
      method: 'POST',
      endpoint: `/sessions/${sessionId}/messages`,
      body: { content },
    });
    return response;
  }

  // ============================================================================
  // Settings Management
  // ============================================================================

  /**
   * Gets all settings
   *
   * @returns Array of settings
   * @throws {NetworkError} If network request fails
   */
  async getAllSettings(): Promise<Setting[]> {
    const response = await this.request<{ settings: Setting[] }>({
      method: 'GET',
      endpoint: '/settings',
    });
    return response.settings;
  }

  /**
   * Gets a single setting by key
   *
   * @param key - Setting key
   * @returns Setting key and value
   * @throws {NotFoundError} If setting doesn't exist
   * @throws {NetworkError} If network request fails
   */
  async getSetting(key: string): Promise<GetSettingResponse> {
    const response = await this.request<GetSettingResponse>({
      method: 'GET',
      endpoint: `/settings/${key}`,
    });
    return response;
  }

  /**
   * Sets a setting value
   *
   * @param key - Setting key
   * @param value - Setting value
   * @returns Setting key and value
   * @throws {ValidationError} If validation fails
   * @throws {NetworkError} If network request fails
   */
  async setSetting(key: string, value: unknown): Promise<SetSettingResponse> {
    const response = await this.request<SetSettingResponse>({
      method: 'PUT',
      endpoint: `/settings/${key}`,
      body: { value },
    });
    return response;
  }

  /**
   * Deletes a setting
   *
   * @param key - Setting key
   * @throws {NotFoundError} If setting doesn't exist
   * @throws {NetworkError} If network request fails
   */
  async deleteSetting(key: string): Promise<void> {
    await this.request<{ message: string }>({
      method: 'DELETE',
      endpoint: `/settings/${key}`,
    });
  }

  // ============================================================================
  // Git Operations
  // ============================================================================

  /**
   * Merges session branch into target branch
   *
   * @param sessionId - Session ID
   * @param targetBranch - Target branch name (defaults to base branch)
   * @throws {NotFoundError} If session doesn't exist
   * @throws {ApiError} If merge conflicts occur
   * @throws {NetworkError} If network request fails
   */
  async mergeBranch(sessionId: string, targetBranch?: string): Promise<void> {
    await this.request<{ message: string }>({
      method: 'POST',
      endpoint: `/sessions/${sessionId}/git/merge`,
      body: targetBranch ? { targetBranch } : undefined,
    });
  }

  /**
   * Checks for merge conflicts
   *
   * @param sessionId - Session ID
   * @param targetBranch - Target branch name (defaults to base branch)
   * @returns Conflict status
   * @throws {NotFoundError} If session doesn't exist
   * @throws {NetworkError} If network request fails
   */
  async checkConflicts(sessionId: string, targetBranch?: string): Promise<CheckConflictsResponse> {
    const response = await this.request<CheckConflictsResponse>({
      method: 'GET',
      endpoint: `/sessions/${sessionId}/git/conflicts`,
      params: targetBranch ? { targetBranch } : undefined,
    });
    return response;
  }

  /**
   * Deletes session's git branch
   *
   * @param sessionId - Session ID
   * @throws {NotFoundError} If session doesn't exist
   * @throws {NetworkError} If network request fails
   */
  async deleteBranch(sessionId: string): Promise<void> {
    await this.request<{ message: string }>({
      method: 'DELETE',
      endpoint: `/sessions/${sessionId}/git/branch`,
    });
  }

  // ============================================================================
  // Health Check
  // ============================================================================

  /**
   * Performs API health check
   *
   * @returns Health status
   * @throws {NetworkError} If network request fails
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const response = await this.request<HealthCheckResponse>({
      method: 'GET',
      endpoint: '/health',
    });
    return response;
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Makes an HTTP request with retry and timeout handling
   *
   * @param options - Request options
   * @returns Response data
   * @throws {ApiError} On error
   */
  async request<T>(options: RequestOptions): Promise<T> {
    return this.retry(async () => {
      const { method, endpoint, body, params } = options;

      // Build URL with query parameters
      let urlString = `${this.config.baseUrl}${endpoint}`;
      if (params) {
        const searchParams = new URLSearchParams();
        for (const [key, value] of Object.entries(params)) {
          searchParams.append(key, String(value));
        }
        urlString += `?${searchParams.toString()}`;
      }

      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const response = await fetch(urlString, {
          method,
          headers: body
            ? {
                'Content-Type': 'application/json',
              }
            : {},
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Handle non-OK responses
        if (!response.ok) {
          const errorData = (await response.json()) as ApiErrorResponse;
          this.handleError(errorData);
        }

        // Parse and return response
        const data = await response.json();
        return data.data as T;
      } catch (error) {
        clearTimeout(timeoutId);

        // Handle abort/timeout
        if (error instanceof Error && error.name === 'AbortError') {
          throw new TimeoutError('Request timeout exceeded');
        }

        // Handle network errors
        if (error instanceof TypeError) {
          throw new NetworkError('Network request failed');
        }

        // Re-throw API errors
        throw error;
      }
    }, this.config.retryAttempts);
  }

  /**
   * Retries a function with exponential backoff
   *
   * @param fn - Function to retry
   * @param attempts - Number of retry attempts
   * @returns Function result
   * @throws {ApiError} On final failure
   */
  private async retry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
    let lastError: Error | undefined;

    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors (client errors)
        if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }

        // Don't retry on last attempt
        if (i === attempts - 1) {
          break;
        }

        // Exponential backoff
        const delay = this.config.retryDelay * 2 ** i;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Handles API error responses
   *
   * @param error - Error response data
   * @throws {ApiError} Typed error
   */
  private handleError(error: ApiErrorResponse): never {
    const { statusCode, message, error: errorType, issues } = error;

    switch (statusCode) {
      case 400:
        throw new ValidationError(message, issues);
      case 404:
        throw new NotFoundError(message);
      case 408:
        throw new TimeoutError(message);
      case 503:
        throw new NetworkError(message);
      default:
        throw new ApiError(message, statusCode, errorType, issues);
    }
  }
}
