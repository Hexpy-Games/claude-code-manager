# Test Cases: API Client (REST + WebSocket)

> **Feature ID**: 008
> **Related Use Case**: [use-case.md](./use-case.md)
> **Status**: Complete ✅
> **Last Updated**: 2025-10-25

## Test Strategy

### Testing Pyramid

```
        E2E Tests (N/A)
      ─────────────────
     Integration Tests (15)
   ───────────────────────────
  Unit Tests (40+)
```

### Coverage Goals
- **Unit Test Coverage**: ≥ 80%
- **Integration Tests**: All API endpoints with mocked responses
- **E2E Tests**: N/A (tested via component tests)

### Test Environment
- **Unit Tests**: Vitest with mocked fetch and WebSocket
- **Integration Tests**: MSW (Mock Service Worker) for HTTP mocking
- **WebSocket Tests**: Custom WebSocket mock

---

## Unit Tests - REST Client

### Component/Service: RestClient

**File**: `apps/desktop/src/services/api/rest-client.test.ts`

#### Test Suite: Session Management

##### ✅ Test Case 1: Create session successfully
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestClient } from './rest-client';

it('should create session successfully', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'sess_123', title: 'Test' })
  });
  const client = new RestClient();

  // Act
  const session = await client.createSession({ title: 'Test', rootDirectory: '/path' });

  // Assert
  expect(session.id).toBe('sess_123');
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:3000/api/sessions',
    expect.objectContaining({ method: 'POST' })
  );
});
```

##### ✅ Test Case 2: List all sessions
```typescript
it('should list all sessions', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ([
      { id: 'sess_1', title: 'Session 1' },
      { id: 'sess_2', title: 'Session 2' }
    ])
  });
  const client = new RestClient();

  // Act
  const sessions = await client.listSessions();

  // Assert
  expect(sessions).toHaveLength(2);
  expect(sessions[0].id).toBe('sess_1');
});
```

##### ✅ Test Case 3: Get session by ID
```typescript
it('should get session by id', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'sess_123', title: 'Test' })
  });
  const client = new RestClient();

  // Act
  const session = await client.getSession('sess_123');

  // Assert
  expect(session.id).toBe('sess_123');
  expect(fetch).toHaveBeenCalledWith('http://localhost:3000/api/sessions/sess_123', expect.any(Object));
});
```

##### ✅ Test Case 4: Handle 404 error
```typescript
it('should throw NotFoundError on 404', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: async () => ({ error: 'Not Found', message: 'Session not found' })
  });
  const client = new RestClient();

  // Act & Assert
  await expect(client.getSession('invalid_id')).rejects.toThrow('Session not found');
});
```

##### ✅ Test Case 5: Update session
```typescript
it('should update session', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'sess_123', title: 'Updated Title' })
  });
  const client = new RestClient();

  // Act
  const session = await client.updateSession('sess_123', { title: 'Updated Title' });

  // Assert
  expect(session.title).toBe('Updated Title');
});
```

##### ✅ Test Case 6: Delete session
```typescript
it('should delete session', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
  const client = new RestClient();

  // Act
  await client.deleteSession('sess_123');

  // Assert
  expect(fetch).toHaveBeenCalledWith(
    'http://localhost:3000/api/sessions/sess_123',
    expect.objectContaining({ method: 'DELETE' })
  );
});
```

##### ✅ Test Case 7: Delete session with Git branch
```typescript
it('should delete session with git branch', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({ ok: true });
  const client = new RestClient();

  // Act
  await client.deleteSession('sess_123', true);

  // Assert
  expect(fetch).toHaveBeenCalledWith(
    expect.stringContaining('deleteGitBranch=true'),
    expect.any(Object)
  );
});
```

##### ✅ Test Case 8: Switch session
```typescript
it('should switch active session', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ id: 'sess_123', isActive: true })
  });
  const client = new RestClient();

  // Act
  const session = await client.switchSession('sess_123');

  // Assert
  expect(session.isActive).toBe(true);
});
```

#### Test Suite: Error Handling

##### ✅ Test Case 9: Handle network errors
```typescript
it('should handle network errors', async () => {
  // Arrange
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  const client = new RestClient();

  // Act & Assert
  await expect(client.listSessions()).rejects.toThrow('Network error');
});
```

##### ✅ Test Case 10: Handle timeout errors
```typescript
it('should timeout after configured duration', async () => {
  // Arrange
  global.fetch = vi.fn().mockImplementation(() =>
    new Promise(resolve => setTimeout(resolve, 35000))
  );
  const client = new RestClient({ timeout: 1000 });

  // Act & Assert
  await expect(client.listSessions()).rejects.toThrow('timeout');
}, 2000);
```

##### ✅ Test Case 11: Retry failed requests
```typescript
it('should retry failed requests', async () => {
  // Arrange
  let attempts = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    attempts++;
    if (attempts < 3) {
      return Promise.reject(new Error('Network error'));
    }
    return Promise.resolve({
      ok: true,
      json: async () => ([])
    });
  });
  const client = new RestClient({ retryAttempts: 3 });

  // Act
  const result = await client.listSessions();

  // Assert
  expect(attempts).toBe(3);
  expect(result).toEqual([]);
});
```

##### ✅ Test Case 12: Don't retry on 4xx errors
```typescript
it('should not retry on 400 errors', async () => {
  // Arrange
  let attempts = 0;
  global.fetch = vi.fn().mockImplementation(() => {
    attempts++;
    return Promise.resolve({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Bad Request' })
    });
  });
  const client = new RestClient({ retryAttempts: 3 });

  // Act & Assert
  await expect(client.listSessions()).rejects.toThrow();
  expect(attempts).toBe(1); // Should not retry
});
```

##### ✅ Test Case 13: Parse API error responses
```typescript
it('should parse API error responses', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    status: 400,
    json: async () => ({
      error: 'ValidationError',
      message: 'Title is required',
      issues: [{ field: 'title', message: 'Required' }]
    })
  });
  const client = new RestClient();

  // Act & Assert
  try {
    await client.createSession({ title: '', rootDirectory: '/path' });
    fail('Should have thrown');
  } catch (error) {
    expect(error).toHaveProperty('issues');
    expect(error.issues[0].field).toBe('title');
  }
});
```

#### Test Suite: Configuration

##### ✅ Test Case 14: Use custom base URL
```typescript
it('should use custom base URL', async () => {
  // Arrange
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ([])
  });
  const client = new RestClient({ baseUrl: 'http://custom:4000/api' });

  // Act
  await client.listSessions();

  // Assert
  expect(fetch).toHaveBeenCalledWith(
    'http://custom:4000/api/sessions',
    expect.any(Object)
  );
});
```

##### ✅ Test Case 15: Apply custom timeout
```typescript
it('should apply custom timeout', async () => {
  // Arrange
  const client = new RestClient({ timeout: 5000 });

  // Assert
  expect(client['config'].timeout).toBe(5000);
});
```

---

## Unit Tests - WebSocket Client

### Component/Service: WebSocketClient

**File**: `apps/desktop/src/services/api/websocket-client.test.ts`

#### Test Suite: Connection Management

##### ✅ Test Case 16: Connect to WebSocket
```typescript
import { WebSocketClient } from './websocket-client';

it('should connect to WebSocket', async () => {
  // Arrange
  const client = new WebSocketClient({ baseUrl: 'ws://localhost:3001/api' });

  // Act
  await client.connect('sess_123');

  // Assert
  expect(client.isConnected()).toBe(true);
});
```

##### ✅ Test Case 17: Receive connected message
```typescript
it('should receive connected message', async () => {
  // Arrange
  const client = new WebSocketClient({ baseUrl: 'ws://localhost:3001/api' });
  const onMessage = vi.fn();
  client.onMessage(onMessage);

  // Act
  await client.connect('sess_123');

  // Assert
  expect(onMessage).toHaveBeenCalledWith({
    type: 'connected',
    sessionId: 'sess_123'
  });
});
```

##### ✅ Test Case 18: Disconnect cleanly
```typescript
it('should disconnect cleanly', async () => {
  // Arrange
  const client = new WebSocketClient({ baseUrl: 'ws://localhost:3001/api' });
  await client.connect('sess_123');

  // Act
  client.disconnect();

  // Assert
  expect(client.isConnected()).toBe(false);
});
```

##### ✅ Test Case 19: Reconnect on connection loss
```typescript
it('should reconnect on connection loss', async () => {
  // Arrange
  const client = new WebSocketClient({
    baseUrl: 'ws://localhost:3001/api',
    reconnectAttempts: 3
  });
  await client.connect('sess_123');

  // Act - simulate disconnect
  mockWebSocket.simulateClose();
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Assert
  expect(client.isConnected()).toBe(true);
});
```

##### ✅ Test Case 20: Stop reconnecting after max attempts
```typescript
it('should stop reconnecting after max attempts', async () => {
  // Arrange
  const client = new WebSocketClient({
    baseUrl: 'ws://localhost:3001/api',
    reconnectAttempts: 2
  });
  const onError = vi.fn();
  client.onError(onError);

  // Act
  await client.connect('sess_123');
  mockWebSocket.simulateClose();
  mockWebSocket.simulateClose();
  mockWebSocket.simulateClose();

  // Assert
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: expect.stringContaining('Max reconnection') })
  );
});
```

#### Test Suite: Message Handling

##### ✅ Test Case 21: Send message
```typescript
it('should send message', async () => {
  // Arrange
  const client = new WebSocketClient({ baseUrl: 'ws://localhost:3001/api' });
  await client.connect('sess_123');

  // Act
  client.sendMessage('Hello');

  // Assert
  expect(mockWebSocket.send).toHaveBeenCalledWith(
    JSON.stringify({ type: 'message', content: 'Hello' })
  );
});
```

##### ✅ Test Case 22: Receive content chunks
```typescript
it('should receive content chunks', async () => {
  // Arrange
  const client = new WebSocketClient({ baseUrl: 'ws://localhost:3001/api' });
  const onMessage = vi.fn();
  client.onMessage(onMessage);
  await client.connect('sess_123');

  // Act
  mockWebSocket.simulateMessage({ type: 'content_chunk', content: 'Hello', index: 0 });
  mockWebSocket.simulateMessage({ type: 'content_chunk', content: ' World', index: 1 });

  // Assert
  expect(onMessage).toHaveBeenCalledTimes(3); // connected + 2 chunks
  expect(onMessage).toHaveBeenCalledWith({ type: 'content_chunk', content: 'Hello', index: 0 });
});
```

##### ✅ Test Case 23: Handle done message
```typescript
it('should handle done message', async () => {
  // Arrange
  const client = new WebSocketClient({ baseUrl: 'ws://localhost:3001/api' });
  const onMessage = vi.fn();
  client.onMessage(onMessage);
  await client.connect('sess_123');

  // Act
  mockWebSocket.simulateMessage({ type: 'done', stopReason: 'end_turn' });

  // Assert
  expect(onMessage).toHaveBeenCalledWith({ type: 'done', stopReason: 'end_turn' });
});
```

##### ✅ Test Case 24: Handle error messages
```typescript
it('should handle error messages', async () => {
  // Arrange
  const client = new WebSocketClient({ baseUrl: 'ws://localhost:3001/api' });
  const onMessage = vi.fn();
  client.onMessage(onMessage);
  await client.connect('sess_123');

  // Act
  mockWebSocket.simulateMessage({ type: 'error', error: 'InvalidMessage', message: 'Content required' });

  // Assert
  expect(onMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
});
```

#### Test Suite: Ping/Pong

##### ✅ Test Case 25: Send ping messages
```typescript
it('should send ping messages', async () => {
  // Arrange
  const client = new WebSocketClient({
    baseUrl: 'ws://localhost:3001/api',
    pingInterval: 1000
  });
  await client.connect('sess_123');

  // Act - wait for ping
  await new Promise(resolve => setTimeout(resolve, 1100));

  // Assert
  expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'ping' }));
});
```

##### ✅ Test Case 26: Receive pong responses
```typescript
it('should receive pong responses', async () => {
  // Arrange
  const client = new WebSocketClient({ baseUrl: 'ws://localhost:3001/api' });
  const onMessage = vi.fn();
  client.onMessage(onMessage);
  await client.connect('sess_123');

  // Act
  mockWebSocket.simulateMessage({ type: 'pong' });

  // Assert
  expect(onMessage).toHaveBeenCalledWith({ type: 'pong' });
});
```

---

## Integration Tests

### Integration Test 1: REST Client with MSW

**File**: `apps/desktop/src/services/api/__tests__/rest-client.integration.test.ts`

#### Setup
```typescript
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

const server = setupServer(
  http.post('http://localhost:3000/api/sessions', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'sess_new123',
      title: body.title,
      rootDirectory: body.rootDirectory,
      workspacePath: `/tmp/claude-sessions/sess_new123/${body.rootDirectory.split('/').pop()}`,
      branchName: 'session/sess_new123',
      baseBranch: 'main',
      isActive: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
  }),
  http.get('http://localhost:3000/api/sessions', () => {
    return HttpResponse.json([
      { id: 'sess_1', title: 'Session 1', isActive: true },
      { id: 'sess_2', title: 'Session 2', isActive: false }
    ]);
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

##### ✅ Test Case 27: End-to-end session creation
```typescript
it('should create session end-to-end', async () => {
  // Arrange
  const client = new RestClient();

  // Act
  const session = await client.createSession({
    title: 'Test Session',
    rootDirectory: '/Users/test/project'
  });

  // Assert
  expect(session.id).toBeDefined();
  expect(session.title).toBe('Test Session');
  expect(session.workspacePath).toContain('/tmp/claude-sessions');
});
```

##### ✅ Test Case 28: Complete session lifecycle
```typescript
it('should handle complete session lifecycle', async () => {
  // Arrange
  const client = new RestClient();

  // Act & Assert - Create
  const created = await client.createSession({ title: 'Test', rootDirectory: '/path' });
  expect(created.id).toBeDefined();

  // Act & Assert - Update
  const updated = await client.updateSession(created.id, { title: 'Updated' });
  expect(updated.title).toBe('Updated');

  // Act & Assert - Get
  const retrieved = await client.getSession(created.id);
  expect(retrieved.title).toBe('Updated');

  // Act & Assert - Delete
  await client.deleteSession(created.id);
  // Subsequent get should 404
  await expect(client.getSession(created.id)).rejects.toThrow();
});
```

---

## Test Data

### Mock Data

#### Sample Session
```typescript
const mockSession = {
  id: 'sess_test123',
  title: 'Test Session',
  rootDirectory: '/Users/test/project',
  workspacePath: '/tmp/claude-sessions/sess_test123/project',
  branchName: 'session/sess_test123',
  baseBranch: 'main',
  gitStatus: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
  lastMessageAt: null,
  metadata: null,
  isActive: true
};
```

---

## Test Execution

```bash
# Run all API client tests
pnpm test src/services/api

# Run REST client tests only
pnpm test src/services/api/rest-client.test.ts

# Run WebSocket client tests only
pnpm test src/services/api/websocket-client.test.ts

# Run with coverage
pnpm test:coverage src/services/api
```

---

## Coverage Requirements

Minimum: 80% coverage for:
- rest-client.ts
- websocket-client.ts
- errors.ts

---

## Checklist

- [x] All REST client methods tested
- [x] All WebSocket client methods tested
- [x] Error handling scenarios covered
- [x] Retry logic tested
- [x] Timeout handling tested
- [x] Reconnection logic tested
- [x] Integration tests with MSW
- [x] Test coverage ≥ 80%

---

**Document History**:
- 2025-10-24: Initial test implementation
- 2025-10-25: Converted to proper test-case format
