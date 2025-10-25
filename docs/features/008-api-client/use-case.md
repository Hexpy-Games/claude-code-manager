# Feature: API Client (REST + WebSocket)

> **Feature ID**: 008
> **Status**: Complete ✅
> **Owner**: Development Team
> **Created**: 2025-10-24
> **Updated**: 2025-10-25

## Overview

Create TypeScript API clients for communicating with the backend server from the desktop application. This includes a REST client for CRUD operations (sessions, messages, settings) and a WebSocket client for real-time streaming of Claude responses.

## User Story

**As a** desktop application frontend
**I want** type-safe API clients for REST and WebSocket communication
**So that** I can interact with the backend server with proper error handling, retries, and real-time streaming support

### Example
**As a** React component in the desktop app
**I want** to call `restClient.createSession({ title, rootDirectory })`
**So that** I get a type-safe Session object back or a clear error if something fails

## Acceptance Criteria

- [ ] **AC1**: REST client implemented with all endpoint methods (sessions, messages, settings, git)
- [ ] **AC2**: WebSocket client implemented with streaming support
- [ ] **AC3**: All request/response types defined with TypeScript interfaces
- [ ] **AC4**: Custom error classes for different error types (ApiError, ValidationError, NotFoundError, etc.)
- [ ] **AC5**: Request timeout handling using AbortController
- [ ] **AC6**: Automatic retry logic with exponential backoff for failed requests
- [ ] **AC7**: WebSocket reconnection logic with configurable attempts
- [ ] **AC8**: Ping/pong keep-alive for WebSocket connections
- [ ] **AC9**: All public methods have JSDoc documentation
- [ ] **AC10**: Unit tests for all client methods (50+ tests)
- [ ] **AC11**: Integration tests with mocked server responses
- [ ] **AC12**: Test coverage ≥ 80%
- [ ] **AC13**: No TypeScript errors in strict mode
- [ ] **AC14**: REST client configurable (baseUrl, timeout, retryAttempts)
- [ ] **AC15**: WebSocket client supports event handlers (onMessage, onError, onClose, onOpen)

## Success Metrics

### Quantitative Metrics
- **API call latency**: < 100ms for local server
- **Retry success rate**: 90%+ for transient failures
- **WebSocket reconnection**: < 2 seconds after disconnect
- **Test coverage**: ≥ 80%
- **Error handling**: 100% of error types handled

### Qualitative Metrics
- **Type safety**: Full TypeScript coverage, no `any` types
- **Developer experience**: Clear error messages, easy to use APIs
- **Reliability**: Automatic retries and reconnection
- **Maintainability**: Well-documented, testable code

## User Flows

### Primary Flow 1: REST API Request

1. **Component needs to create session**
   - Calls `restClient.createSession({ title, rootDirectory })`

2. **REST client validates parameters**
   - Checks required fields present

3. **REST client makes HTTP request**
   - POST to `/api/sessions`
   - Sets timeout with AbortController
   - Includes proper headers

4. **Server responds**
   - 201 Created with session data

5. **REST client parses response**
   - Validates response structure
   - Returns typed Session object

### Primary Flow 2: WebSocket Streaming

1. **Component wants to stream Claude response**
   - Creates WebSocket client
   - Connects to session stream: `wsClient.connect(sessionId)`

2. **WebSocket client establishes connection**
   - Connects to `ws://localhost:3001/api/sessions/{sessionId}/stream`
   - Receives connection acknowledgment

3. **Component sets up handlers**
   - `wsClient.onMessage((msg) => { /* handle chunks */ })`
   - `wsClient.onError((err) => { /* handle errors */ })`

4. **Component sends message**
   - `wsClient.sendMessage("Hello Claude")`

5. **Component receives streaming chunks**
   - Handler called for each `content_chunk`
   - Accumulates text in state
   - Displays to user in real-time

6. **Stream completes**
   - Receives `done` message
   - Handler cleans up streaming state

### Alternative Flows

#### Alt Flow 1: Request Timeout

1. Component makes API request
2. Server takes too long to respond (> 30s)
3. AbortController cancels request
4. REST client throws TimeoutError
5. Component shows timeout message to user

#### Alt Flow 2: Network Error with Retry

1. Component makes API request
2. Network fails (offline, DNS error, etc.)
3. REST client catches error
4. REST client waits 1 second (exponential backoff)
5. REST client retries request
6. If success: Return response
7. If still failing after 3 attempts: Throw NetworkError

#### Alt Flow 3: WebSocket Disconnection

1. WebSocket connected and streaming
2. Connection drops (network issue)
3. WebSocket client detects close event
4. Client waits configurable delay (1s)
5. Client attempts to reconnect
6. If reconnect succeeds: Resume normal operation
7. If reconnect fails after max attempts: Call onError handler

#### Alt Flow 4: Validation Error

1. Component sends invalid data (empty title)
2. Server returns 400 with validation errors
3. REST client parses error response
4. REST client throws ValidationError with issues array
5. Component displays validation errors to user

## Edge Cases

### Edge Case 1: Concurrent Requests to Same Endpoint

- **Situation**: Multiple components request same session simultaneously
- **Expected behavior**: Both requests go through, no deduplication
- **Rationale**: Server handles concurrency, client shouldn't assume

### Edge Case 2: Very Large Response

- **Situation**: Server returns 10MB+ response (large Git status)
- **Expected behavior**: Stream response, handle incrementally
- **Rationale**: Prevent memory issues with large payloads

### Edge Case 3: Malformed JSON from Server

- **Situation**: Server returns invalid JSON (corruption, bug)
- **Expected behavior**: Throw ApiError with clear message
- **Rationale**: Fail fast, provide debugging info

### Edge Case 4: WebSocket Message Order

- **Situation**: Messages arrive out of order (network reordering)
- **Expected behavior**: Use index field to reorder content chunks
- **Rationale**: Preserve message integrity

### Edge Case 5: Multiple WebSocket Connections to Same Session

- **Situation**: User opens same session in multiple windows
- **Expected behavior**: Each connection independent, server handles state
- **Rationale**: Client doesn't enforce single-connection rule

### Edge Case 6: API Base URL Change at Runtime

- **Situation**: User changes backend server URL in settings
- **Expected behavior**: Create new client instance with new baseUrl
- **Rationale**: Clients are immutable by design

### Edge Case 7: Retry on Non-Retriable Error

- **Situation**: 404 Not Found or 401 Unauthorized
- **Expected behavior**: Don't retry, throw error immediately
- **Rationale**: Retrying won't help for client errors (4xx)

## Dependencies

### Required Features
- [Feature 007]: Tauri Desktop App Setup - Provides React environment

### External Dependencies
- **fetch API**: Built-in browser HTTP client
- **WebSocket API**: Built-in browser WebSocket
- **TypeScript**: Type safety
- **Vitest**: Testing framework
- **MSW (Mock Service Worker)**: HTTP mocking for tests

## Technical Notes

### Architecture Considerations

**Client Layer Architecture**:
```
React Components
       ↓
  API Client Layer
  ├── RestClient (HTTP)
  └── WebSocketClient (Streaming)
       ↓
  Network Layer (fetch, WebSocket)
       ↓
  Backend Server
```

### Data Model Changes

N/A - API clients don't modify database

### API Design

**REST Client Interface**:
```typescript
class RestClient {
  constructor(config?: Partial<ApiConfig>);

  // Sessions
  createSession(data: CreateSessionRequest): Promise<Session>;
  listSessions(): Promise<Session[]>;
  getSession(id: string): Promise<Session>;
  updateSession(id: string, data: UpdateSessionRequest): Promise<Session>;
  deleteSession(id: string, deleteGitBranch?: boolean): Promise<void>;
  switchSession(id: string): Promise<Session>;

  // Messages
  getMessages(sessionId: string): Promise<Message[]>;
  sendMessage(sessionId: string, content: string): Promise<SendMessageResponse>;

  // Settings
  getAllSettings(): Promise<Setting[]>;
  getSetting(key: string): Promise<GetSettingResponse>;
  setSetting(key: string, value: any): Promise<SetSettingResponse>;
  deleteSetting(key: string): Promise<void>;

  // Git Operations
  mergeBranch(sessionId: string, targetBranch?: string): Promise<void>;
  checkConflicts(sessionId: string, targetBranch?: string): Promise<CheckConflictsResponse>;
  deleteBranch(sessionId: string): Promise<void>;

  // Health
  healthCheck(): Promise<HealthCheckResponse>;
}
```

**WebSocket Client Interface**:
```typescript
class WebSocketClient {
  constructor(options: WebSocketClientOptions);

  // Connection
  connect(sessionId: string): Promise<void>;
  disconnect(): void;
  isConnected(): boolean;

  // Messaging
  sendMessage(content: string): void;
  ping(): void;

  // Event Handlers
  onMessage(handler: MessageHandler): void;
  onError(handler: ErrorHandler): void;
  onClose(handler: CloseHandler): void;
  onOpen(handler: () => void): void;
}
```

### Type Definitions

**Request Types**:
```typescript
interface CreateSessionRequest {
  title: string;
  rootDirectory: string;
  baseBranch?: string;
  metadata?: Record<string, unknown>;
}

interface UpdateSessionRequest {
  title?: string;
  metadata?: Record<string, unknown>;
}
```

**Response Types**:
```typescript
interface Session {
  id: string;
  title: string;
  rootDirectory: string;
  workspacePath: string;
  branchName: string;
  baseBranch: string;
  gitStatus: string | null;
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number | null;
  metadata: Record<string, unknown> | null;
  isActive: boolean;
}

interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: any[] | null;
  timestamp: number;
}
```

**Error Types**:
```typescript
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public errorType: string,
    public issues?: any[]
  );
}

class ValidationError extends ApiError {
  constructor(message: string, issues?: any[]);
}

class NotFoundError extends ApiError {
  constructor(message: string);
}

class NetworkError extends ApiError {
  constructor(message: string);
}

class TimeoutError extends ApiError {
  constructor(message: string);
}
```

### Error Handling Strategy

**REST Client Error Handling**:
```typescript
private async request<T>(options: RequestOptions): Promise<T> {
  try {
    // Set up timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    // Make request
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle HTTP errors
    if (!response.ok) {
      const error = await response.json();
      throw this.parseError(error, response.status);
    }

    return await response.json();
  } catch (error) {
    // Handle network errors, timeouts, etc.
    throw this.handleError(error);
  }
}
```

**Retry Logic**:
```typescript
private async retry<T>(fn: () => Promise<T>, attempts: number): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on 4xx errors
      if (error instanceof ApiError && error.statusCode >= 400 && error.statusCode < 500) {
        throw error;
      }

      // Last attempt, throw error
      if (i === attempts - 1) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Retry exhausted');
}
```

**WebSocket Reconnection**:
```typescript
private reconnect(): void {
  if (this.reconnectCount >= this.options.reconnectAttempts) {
    this.errorHandler?.(new Error('Max reconnection attempts reached'));
    return;
  }

  this.reconnectCount++;
  const delay = Math.min(1000 * Math.pow(2, this.reconnectCount - 1), 10000);

  setTimeout(() => {
    this.connect(this.sessionId);
  }, delay);
}
```

### Configuration

**REST Client Config**:
```typescript
interface ApiConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

const defaultConfig: ApiConfig = {
  baseUrl: 'http://localhost:3000/api',
  timeout: 30000,        // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000,      // 1 second initial
};
```

**WebSocket Client Config**:
```typescript
interface WebSocketClientOptions {
  baseUrl: string;
  reconnectAttempts?: number;
  reconnectDelay?: number;
  pingInterval?: number;
}

const defaultOptions = {
  reconnectAttempts: 5,
  reconnectDelay: 1000,
  pingInterval: 30000,   // 30 seconds
};
```

## UI/UX Considerations

N/A - This is a client library with no UI

## Non-Functional Requirements

### Performance
- **Request latency**: < 100ms for local server
- **Memory usage**: < 10MB for client instances
- **WebSocket throughput**: Handle 1000+ chunks/second

### Security
- **No credentials in client**: API keys handled by backend
- **HTTPS support**: Works with https:// URLs
- **WSS support**: Works with wss:// URLs
- **Input validation**: Validate before sending to server

### Reliability
- **Automatic retries**: 3 attempts for transient failures
- **Automatic reconnection**: 5 attempts for WebSocket
- **Graceful degradation**: Clear errors when all retries fail
- **Connection recovery**: Resume after network issues

## Open Questions

- [x] **Q1**: Use fetch or axios?
  - **Answer**: fetch (built-in, no dependencies)

- [x] **Q2**: How many retry attempts?
  - **Answer**: 3 attempts with exponential backoff

- [x] **Q3**: WebSocket reconnection strategy?
  - **Answer**: 5 attempts with exponential backoff, max 10s delay

- [x] **Q4**: Handle request cancellation?
  - **Answer**: Yes, using AbortController

- [x] **Q5**: Support request deduplication?
  - **Answer**: No, server handles concurrency

## Related Features

- [Feature 005]: REST API - Defines endpoints clients call
- [Feature 006]: WebSocket Streaming - Defines streaming protocol
- [Feature 007]: Tauri Setup - Provides React environment
- [Feature 009]: Clone-Based Sessions - workspacePath included in responses

## References

- [Fetch API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [WebSocket API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
- [AbortController](https://developer.mozilla.org/en-US/docs/Web/API/AbortController)
- [MSW (Mock Service Worker)](https://mswjs.io/)
- Backend API Routes: `packages/server/src/routes/`

---

**Document History**:
- 2025-10-24: Initial implementation
- 2025-10-25: Converted to proper use-case format with template structure
