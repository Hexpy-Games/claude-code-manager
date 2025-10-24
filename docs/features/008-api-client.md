# Feature 008: API Client

**Status**: In Progress
**Priority**: High (Phase 2 - Desktop UI foundation)
**Estimated Effort**: 1 day

## Overview

Create TypeScript API clients for communicating with the backend server. This includes a REST client for CRUD operations and a WebSocket client for real-time streaming of Claude responses.

## Dependencies

- Feature 007: Tauri Project Setup (completed)

## Goals

1. Create REST API client for all HTTP endpoints
2. Create WebSocket client for real-time streaming
3. Implement comprehensive error handling
4. Add request/response type safety
5. Support request retries and timeout handling
6. Write comprehensive tests (unit + integration)

## Technical Design

### Architecture

```
Desktop App
    ↓
API Client Layer (apps/desktop/src/services/api/)
    ├── RestClient (HTTP requests)
    └── WebSocketClient (Streaming)
    ↓
Backend Server (http://localhost:3000/api)
```

### Directory Structure

```
apps/desktop/src/services/
├── api/
│   ├── rest-client.ts           # REST API client
│   ├── rest-client.test.ts      # REST client tests
│   ├── websocket-client.ts      # WebSocket client
│   ├── websocket-client.test.ts # WebSocket tests
│   ├── types.ts                 # API types
│   └── errors.ts                # Error classes
└── config.ts                    # API configuration
```

### Technology Stack

- **HTTP Client**: `fetch` API (built-in)
- **WebSocket**: Browser WebSocket API
- **Type Safety**: TypeScript with shared types from `@claude-code-manager/shared`
- **Testing**: Vitest with MSW (Mock Service Worker) for HTTP mocking
- **Error Handling**: Custom error classes

## REST API Client Design

### Base Client Configuration

```typescript
// apps/desktop/src/services/config.ts
export interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export const defaultApiConfig: ApiConfig = {
  baseUrl: 'http://localhost:3000/api',
  timeout: 30000,        // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000,      // 1 second
};
```

### REST Client Interface

```typescript
// apps/desktop/src/services/api/rest-client.ts
export class RestClient {
  private config: ApiConfig;

  constructor(config?: Partial<ApiConfig>);

  // Session Management
  async createSession(data: CreateSessionRequest): Promise<Session>;
  async listSessions(): Promise<Session[]>;
  async getSession(id: string): Promise<Session>;
  async updateSession(id: string, data: UpdateSessionRequest): Promise<Session>;
  async deleteSession(id: string, deleteGitBranch?: boolean): Promise<void>;
  async switchSession(id: string): Promise<Session>;

  // Message Management
  async getMessages(sessionId: string): Promise<Message[]>;
  async sendMessage(sessionId: string, content: string): Promise<{
    userMessage: Message;
    assistantMessage: Message;
  }>;

  // Settings Management
  async getAllSettings(): Promise<Setting[]>;
  async getSetting(key: string): Promise<{ key: string; value: any }>;
  async setSetting(key: string, value: any): Promise<{ key: string; value: any }>;
  async deleteSetting(key: string): Promise<void>;

  // Git Operations
  async mergeBranch(sessionId: string, targetBranch?: string): Promise<void>;
  async checkConflicts(sessionId: string, targetBranch?: string): Promise<{ hasConflicts: boolean }>;
  async deleteBranch(sessionId: string): Promise<void>;

  // Health Check
  async healthCheck(): Promise<{ status: string }>;

  // Internal methods
  private async request<T>(options: RequestOptions): Promise<T>;
  private async retry<T>(fn: () => Promise<T>, attempts: number): Promise<T>;
  private handleError(error: unknown): never;
}
```

### Request/Response Types

```typescript
// apps/desktop/src/services/api/types.ts
export interface CreateSessionRequest {
  title: string;
  rootDirectory: string;
  baseBranch?: string;
  metadata?: Record<string, any>;
}

export interface UpdateSessionRequest {
  title?: string;
  metadata?: Record<string, any>;
}

export interface Session {
  id: string;
  title: string;
  rootDirectory: string;
  branchName: string;
  baseBranch: string;
  gitStatus: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number | null;
  metadata: Record<string, any> | null;
  isActive: boolean;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: any[] | null;
  timestamp: number;
}

export interface Setting {
  key: string;
  value: any;
  scope: string | null;
  updatedAt: number;
}

export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  issues?: any[];
}
```

### Error Handling

```typescript
// apps/desktop/src/services/api/errors.ts
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType: string,
    public issues?: any[]
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, issues?: any[]) {
    super(message, 400, 'ValidationError', issues);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string) {
    super(message, 404, 'NotFoundError');
    this.name = 'NotFoundError';
  }
}

export class NetworkError extends ApiError {
  constructor(message: string) {
    super(message, 503, 'NetworkError');
    this.name = 'NetworkError';
  }
}

export class TimeoutError extends ApiError {
  constructor(message: string) {
    super(message, 408, 'TimeoutError');
    this.name = 'TimeoutError';
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
```

## WebSocket Client Design

### WebSocket Client Interface

```typescript
// apps/desktop/src/services/api/websocket-client.ts
export interface StreamMessage {
  type: 'content_chunk' | 'tool_use' | 'tool_result' | 'done' | 'error' | 'connected' | 'pong';
  content?: string;
  index?: number;
  sessionId?: string;
  error?: string;
  message?: string;
  code?: string;
  stopReason?: string;
}

export interface WebSocketClientOptions {
  baseUrl: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  pingInterval?: number;
}

export type MessageHandler = (message: StreamMessage) => void;
export type ErrorHandler = (error: Error) => void;
export type CloseHandler = (code: number, reason: string) => void;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private options: Required<WebSocketClientOptions>;
  private reconnectCount = 0;
  private pingTimer: NodeJS.Timeout | null = null;

  constructor(options: WebSocketClientOptions);

  // Connection management
  async connect(sessionId: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Message sending
  sendMessage(content: string): void;
  ping(): void;

  // Event handlers
  onMessage(handler: MessageHandler): void;
  onError(handler: ErrorHandler): void;
  onClose(handler: CloseHandler): void;
  onOpen(handler: () => void): void;

  // Internal methods
  private handleMessage(event: MessageEvent): void;
  private handleError(event: Event): void;
  private handleClose(event: CloseEvent): void;
  private handleOpen(): void;
  private reconnect(): void;
  private startPing(): void;
  private stopPing(): void;
}
```

### WebSocket Message Flow

```
Client                          Server
  |                               |
  |------ connect() ------------->|
  |<----- {type: 'connected'} ----|
  |                               |
  |------ ping() ---------------->|
  |<----- {type: 'pong'} ---------|
  |                               |
  |------ sendMessage() --------->|
  |<----- {type: 'content_chunk'}-| (multiple)
  |<----- {type: 'content_chunk'}-|
  |<----- {type: 'done'} ---------|
  |                               |
  |------ disconnect() ---------->|
  |<----- close ------------------|
```

## Implementation Plan

### Step 1: Create Type Definitions

1. Create `apps/desktop/src/services/api/types.ts`
2. Define all request/response interfaces
3. Import shared types from `@claude-code-manager/shared` where applicable

### Step 2: Create Error Classes

1. Create `apps/desktop/src/services/api/errors.ts`
2. Implement custom error classes
3. Add error type guards

### Step 3: Implement REST Client

1. Create `apps/desktop/src/services/api/rest-client.ts`
2. Implement base request method with:
   - Timeout handling (AbortController)
   - Retry logic with exponential backoff
   - Error parsing and throwing
3. Implement all endpoint methods
4. Add JSDoc documentation

### Step 4: Implement WebSocket Client

1. Create `apps/desktop/src/services/api/websocket-client.ts`
2. Implement connection management
3. Implement reconnection logic
4. Implement ping/pong keep-alive
5. Add event handler system

### Step 5: Write Tests

Write comprehensive tests for both clients (details in Test Plan section)

## Test Plan

### Unit Tests for REST Client

**File**: `apps/desktop/src/services/api/rest-client.test.ts`

```typescript
describe('RestClient', () => {
  describe('Session Management', () => {
    it('should create session successfully');
    it('should list all sessions');
    it('should get session by id');
    it('should update session');
    it('should delete session');
    it('should delete session with git branch');
    it('should switch active session');
    it('should handle 404 errors');
    it('should handle validation errors');
  });

  describe('Message Management', () => {
    it('should get messages for session');
    it('should send message and receive response');
    it('should handle empty message error');
  });

  describe('Settings Management', () => {
    it('should get all settings');
    it('should get setting by key');
    it('should set setting');
    it('should delete setting');
    it('should handle setting not found');
  });

  describe('Git Operations', () => {
    it('should merge branch');
    it('should check for conflicts');
    it('should delete branch');
    it('should handle git errors');
  });

  describe('Error Handling', () => {
    it('should handle network errors');
    it('should handle timeout errors');
    it('should retry failed requests');
    it('should not retry on 4xx errors');
    it('should parse API error responses');
  });

  describe('Request Configuration', () => {
    it('should use custom base URL');
    it('should apply custom timeout');
    it('should apply custom retry settings');
  });
});
```

### Unit Tests for WebSocket Client

**File**: `apps/desktop/src/services/api/websocket-client.test.ts`

```typescript
describe('WebSocketClient', () => {
  describe('Connection Management', () => {
    it('should connect to WebSocket');
    it('should receive connected message');
    it('should disconnect cleanly');
    it('should reconnect on connection loss');
    it('should stop reconnecting after max attempts');
  });

  describe('Message Handling', () => {
    it('should send message');
    it('should receive content chunks');
    it('should handle tool use messages');
    it('should handle done message');
    it('should handle error messages');
  });

  describe('Ping/Pong', () => {
    it('should send ping messages');
    it('should receive pong responses');
    it('should maintain connection with ping');
  });

  describe('Event Handlers', () => {
    it('should call onMessage handler');
    it('should call onError handler');
    it('should call onClose handler');
    it('should call onOpen handler');
    it('should support multiple handlers');
  });

  describe('Error Handling', () => {
    it('should handle connection errors');
    it('should handle malformed messages');
    it('should handle server errors');
    it('should emit errors to handlers');
  });
});
```

### Mocking Strategy

Use MSW (Mock Service Worker) for REST API mocking:

```typescript
// apps/desktop/src/test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('/api/sessions', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      data: {
        session: {
          id: 'sess_test123',
          title: body.title,
          // ... other fields
        },
      },
    });
  }),
  // ... more handlers
];
```

For WebSocket mocking, use a mock WebSocket implementation:

```typescript
// apps/desktop/src/test/mocks/websocket.ts
export class MockWebSocket {
  // Mock WebSocket implementation for testing
}
```

## Acceptance Criteria

- [ ] REST client implemented with all endpoint methods
- [ ] WebSocket client implemented with streaming support
- [ ] Type-safe request/response interfaces
- [ ] Comprehensive error handling with custom error classes
- [ ] Request timeout handling (AbortController)
- [ ] Automatic retry logic for failed requests
- [ ] WebSocket reconnection logic
- [ ] Ping/pong keep-alive for WebSocket
- [ ] All unit tests passing (50+ tests)
- [ ] Test coverage ≥ 80%
- [ ] JSDoc documentation for all public methods
- [ ] No TypeScript errors
- [ ] No linting errors
- [ ] Integration with `@claude-code-manager/shared` types

## API Client Usage Examples

### REST Client Usage

```typescript
import { RestClient } from '@/services/api/rest-client';

const client = new RestClient({
  baseUrl: 'http://localhost:3000/api',
  timeout: 30000,
  retryAttempts: 3,
});

// Create session
const session = await client.createSession({
  title: 'My Session',
  rootDirectory: '/path/to/repo',
});

// Send message
const { userMessage, assistantMessage } = await client.sendMessage(
  session.id,
  'Hello Claude'
);

// Get all settings
const settings = await client.getAllSettings();
```

### WebSocket Client Usage

```typescript
import { WebSocketClient } from '@/services/api/websocket-client';

const wsClient = new WebSocketClient({
  baseUrl: 'ws://localhost:3000/api',
  reconnectAttempts: 5,
  pingInterval: 30000,
});

// Set up handlers
wsClient.onMessage((message) => {
  switch (message.type) {
    case 'content_chunk':
      console.log('Chunk:', message.content);
      break;
    case 'done':
      console.log('Complete');
      break;
    case 'error':
      console.error('Error:', message.message);
      break;
  }
});

wsClient.onError((error) => {
  console.error('WebSocket error:', error);
});

// Connect and send
await wsClient.connect(sessionId);
wsClient.sendMessage('Hello Claude');
```

## Future Enhancements

1. **Request Cancellation**: Add AbortController support for canceling requests
2. **Request Queuing**: Queue requests when offline and send when reconnected
3. **Caching**: Add response caching for GET requests
4. **Optimistic Updates**: Update UI before server response
5. **Request Deduplication**: Prevent duplicate simultaneous requests
6. **Rate Limiting**: Client-side rate limiting to prevent API abuse
7. **Metrics**: Track API call performance and success rates

## Notes

- The REST client uses the browser's `fetch` API (no external dependencies)
- WebSocket client uses the browser's native WebSocket API
- Error handling follows the backend's error response format
- All timestamps are Unix timestamps (milliseconds)
- Session IDs follow the pattern: `sess_[a-zA-Z0-9_-]{12}`
- WebSocket reconnection uses exponential backoff
- Ping/pong keep-alive prevents connection timeout

## References

- [Fetch API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [WebSocket API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [MSW Documentation](https://mswjs.io/)
- Backend API Routes: `packages/server/src/routes/`
- Backend Schemas: `packages/server/src/schemas/`
