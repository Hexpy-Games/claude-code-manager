/**
 * API Type Definitions
 *
 * This file contains all the TypeScript interfaces and types used for
 * communicating with the backend API.
 */

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request payload for creating a new session
 */
export interface CreateSessionRequest {
  /** Title of the session */
  title: string;
  /** Root directory path for the session */
  rootDirectory: string;
  /** Base git branch (defaults to 'main' or 'master') */
  baseBranch?: string;
  /** Additional metadata for the session */
  metadata?: Record<string, unknown>;
}

/**
 * Request payload for updating an existing session
 */
export interface UpdateSessionRequest {
  /** Updated title for the session */
  title?: string;
  /** Updated metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Session entity representing a conversation session
 */
export interface Session {
  /** Unique session identifier (format: sess_[a-zA-Z0-9_-]{12}) */
  id: string;
  /** Session title */
  title: string;
  /** Root directory path (original repository) */
  rootDirectory: string;
  /** Workspace path (cloned repository for this session) */
  workspacePath: string;
  /** Git branch name for this session */
  branchName: string;
  /** Base git branch */
  baseBranch: string;
  /** Current git status (null if no changes) */
  gitStatus: string | null;
  /** Session creation timestamp (Unix milliseconds) */
  createdAt: number;
  /** Last update timestamp (Unix milliseconds) */
  updatedAt: number;
  /** Last message timestamp (Unix milliseconds, null if no messages) */
  lastMessageAt: number | null;
  /** Additional metadata */
  metadata: Record<string, unknown> | null;
  /** Whether this is the currently active session */
  isActive: boolean;
}

/**
 * Message entity representing a single message in a conversation
 */
export interface Message {
  /** Unique message identifier */
  id: string;
  /** Session ID this message belongs to */
  sessionId: string;
  /** Message role (user or assistant) */
  role: 'user' | 'assistant';
  /** Message content */
  content: string;
  /** Tool calls made (null if none) */
  // biome-ignore lint/suspicious/noExplicitAny: Tool calls have dynamic structure
  toolCalls: any[] | null;
  /** Message timestamp (Unix milliseconds) */
  timestamp: number;
}

/**
 * Setting entity representing a configuration setting
 */
export interface Setting {
  /** Setting key */
  key: string;
  /** Setting value (can be any JSON-serializable type) */
  // biome-ignore lint/suspicious/noExplicitAny: Settings can have any value type
  value: any;
  /** Setting scope (null for global scope) */
  scope: string | null;
  /** Last update timestamp (Unix milliseconds) */
  updatedAt: number;
}

/**
 * API error response structure
 */
export interface ApiErrorResponse {
  /** Error type/code */
  error: string;
  /** Human-readable error message */
  message: string;
  /** HTTP status code */
  statusCode: number;
  /** Validation issues (for 400 errors) */
  // biome-ignore lint/suspicious/noExplicitAny: Issues have dynamic structure
  issues?: any[];
}

// ============================================================================
// WebSocket Types
// ============================================================================

/**
 * WebSocket message types for streaming responses
 */
export type StreamMessageType =
  | 'content_chunk' // Partial response content
  | 'tool_use' // Tool usage notification
  | 'tool_result' // Tool execution result
  | 'done' // Stream completed
  | 'error' // Error occurred
  | 'connected' // Connection established
  | 'pong'; // Ping response

/**
 * WebSocket stream message
 */
export interface StreamMessage {
  /** Message type */
  type: StreamMessageType;
  /** Content chunk (for content_chunk type) */
  content?: string;
  /** Chunk index (for content_chunk type) */
  index?: number;
  /** Session ID */
  sessionId?: string;
  /** Error type (for error type) */
  error?: string;
  /** Error message (for error type) */
  message?: string;
  /** Error code (for error type) */
  code?: string;
  /** Stop reason (for done type) */
  stopReason?: string;
}

// ============================================================================
// API Response Wrappers
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
}

/**
 * Response for sending a message
 */
export interface SendMessageResponse {
  userMessage: Message;
  assistantMessage: Message;
}

/**
 * Response for getting a single setting
 */
export interface GetSettingResponse {
  key: string;
  // biome-ignore lint/suspicious/noExplicitAny: Settings can have any value type
  value: any;
}

/**
 * Response for setting a setting
 */
export interface SetSettingResponse {
  key: string;
  // biome-ignore lint/suspicious/noExplicitAny: Settings can have any value type
  value: any;
}

/**
 * Response for checking git conflicts
 */
export interface CheckConflictsResponse {
  hasConflicts: boolean;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: string;
}
