# Test Cases: Database Setup

> **Feature ID**: 001
> **Related Use Case**: [use-case.md](./use-case.md)
> **Status**: In Progress
> **Last Updated**: 2025-10-23

## Test Strategy

### Testing Pyramid

```
        E2E Tests (None)
      ─────────────────
     Integration Tests (Few)
   ───────────────────────────
  Unit Tests (Many)
```

### Coverage Goals
- **Unit Test Coverage**: ≥ 80%
- **Integration Tests**: Database initialization and CRUD operations
- **E2E Tests**: N/A (backend only)

### Test Environment
- **Unit Tests**: Vitest, temp in-memory databases
- **Integration Tests**: Vitest, temp file-based databases
- **Test Cleanup**: All temp databases deleted after tests

---

## Unit Tests

### Component/Service: DatabaseClient

**File**: `apps/server/src/db/client.test.ts`

#### Test Suite: constructor()

##### ✅ Test Case 1: Creates database file
```typescript
it('should create database file at specified path', () => {
  // Arrange
  const dbPath = path.join(os.tmpdir(), 'test-db.sqlite');

  // Act
  const db = new DatabaseClient(dbPath);

  // Assert
  expect(fs.existsSync(dbPath)).toBe(true);

  // Cleanup
  db.close();
  fs.unlinkSync(dbPath);
});
```

##### ✅ Test Case 2: Creates parent directories
```typescript
it('should create parent directories if they do not exist', () => {
  // Arrange
  const dbPath = path.join(os.tmpdir(), 'nested', 'dirs', 'test.sqlite');

  // Act
  const db = new DatabaseClient(dbPath);

  // Assert
  expect(fs.existsSync(dbPath)).toBe(true);

  // Cleanup
  db.close();
  fs.rmSync(path.dirname(dbPath), { recursive: true });
});
```

##### ✅ Test Case 3: Initializes schema
```typescript
it('should initialize database schema with all tables', () => {
  // Arrange
  const dbPath = ':memory:';
  const db = new DatabaseClient(dbPath);

  // Act
  const tables = db.raw.prepare(
    "SELECT name FROM sqlite_master WHERE type='table'"
  ).all();

  // Assert
  const tableNames = tables.map((t: any) => t.name);
  expect(tableNames).toContain('sessions');
  expect(tableNames).toContain('messages');
  expect(tableNames).toContain('session_git_state');
  expect(tableNames).toContain('settings');

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 4: Enables WAL mode
```typescript
it('should enable WAL mode for better concurrency', () => {
  // Arrange
  const dbPath = ':memory:';
  const db = new DatabaseClient(dbPath);

  // Act
  const result = db.raw.pragma('journal_mode');

  // Assert
  expect(result).toEqual([{ journal_mode: 'wal' }]);

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 5: Enables foreign keys
```typescript
it('should enable foreign key constraints', () => {
  // Arrange
  const dbPath = ':memory:';
  const db = new DatabaseClient(dbPath);

  // Act
  const result = db.raw.pragma('foreign_keys');

  // Assert
  expect(result).toEqual([{ foreign_keys: 1 }]);

  // Cleanup
  db.close();
});
```

#### Test Suite: insertSession()

##### ✅ Test Case 1: Inserts session successfully
```typescript
it('should insert session and return it with ID', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  const session = {
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
    baseBranch: 'main',
  };

  // Act
  const result = db.insertSession(session);

  // Assert
  expect(result.id).toBe('sess_test123');
  expect(result.title).toBe('Test Session');
  expect(result.createdAt).toBeDefined();
  expect(result.updatedAt).toBeDefined();

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 2: Throws error on duplicate ID
```typescript
it('should throw error when inserting session with duplicate ID', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  const session = {
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  };
  db.insertSession(session);

  // Act & Assert
  expect(() => db.insertSession(session)).toThrow();

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 3: Handles missing optional fields
```typescript
it('should insert session with default values for optional fields', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  const session = {
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  };

  // Act
  const result = db.insertSession(session);

  // Assert
  expect(result.baseBranch).toBe('main');
  expect(result.isActive).toBe(false);
  expect(result.gitStatus).toBeNull();

  // Cleanup
  db.close();
});
```

#### Test Suite: getSession()

##### ✅ Test Case 1: Returns session by ID
```typescript
it('should return session when it exists', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  const session = {
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  };
  db.insertSession(session);

  // Act
  const result = db.getSession('sess_test123');

  // Assert
  expect(result).not.toBeNull();
  expect(result?.id).toBe('sess_test123');
  expect(result?.title).toBe('Test Session');

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 2: Returns null when not found
```typescript
it('should return null when session does not exist', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');

  // Act
  const result = db.getSession('nonexistent');

  // Assert
  expect(result).toBeNull();

  // Cleanup
  db.close();
});
```

#### Test Suite: getSessions()

##### ✅ Test Case 1: Returns all sessions
```typescript
it('should return all sessions ordered by updated_at DESC', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  db.insertSession({
    id: 'sess_1',
    title: 'Session 1',
    rootDirectory: '/path1',
    branchName: 'session/sess_1',
  });
  db.insertSession({
    id: 'sess_2',
    title: 'Session 2',
    rootDirectory: '/path2',
    branchName: 'session/sess_2',
  });

  // Act
  const result = db.getSessions();

  // Assert
  expect(result).toHaveLength(2);
  expect(result[0].id).toBe('sess_2'); // Most recent first

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 2: Returns empty array when no sessions
```typescript
it('should return empty array when no sessions exist', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');

  // Act
  const result = db.getSessions();

  // Assert
  expect(result).toEqual([]);

  // Cleanup
  db.close();
});
```

#### Test Suite: updateSession()

##### ✅ Test Case 1: Updates session fields
```typescript
it('should update session and return updated record', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  const session = db.insertSession({
    id: 'sess_test123',
    title: 'Original Title',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  });

  // Act
  const result = db.updateSession('sess_test123', {
    title: 'Updated Title',
    gitStatus: 'modified',
  });

  // Assert
  expect(result.title).toBe('Updated Title');
  expect(result.gitStatus).toBe('modified');
  expect(result.updatedAt).toBeGreaterThan(session.updatedAt);

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 2: Throws error when session not found
```typescript
it('should throw error when updating nonexistent session', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');

  // Act & Assert
  expect(() => db.updateSession('nonexistent', { title: 'New' }))
    .toThrow('Session not found');

  // Cleanup
  db.close();
});
```

#### Test Suite: deleteSession()

##### ✅ Test Case 1: Deletes session
```typescript
it('should delete session successfully', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  db.insertSession({
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  });

  // Act
  db.deleteSession('sess_test123');

  // Assert
  const result = db.getSession('sess_test123');
  expect(result).toBeNull();

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 2: Cascades to messages
```typescript
it('should cascade delete to messages', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  db.insertSession({
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  });
  db.insertMessage({
    id: 'msg_1',
    sessionId: 'sess_test123',
    role: 'user',
    content: 'Hello',
  });

  // Act
  db.deleteSession('sess_test123');

  // Assert
  const messages = db.getMessages('sess_test123');
  expect(messages).toHaveLength(0);

  // Cleanup
  db.close();
});
```

#### Test Suite: insertMessage()

##### ✅ Test Case 1: Inserts message successfully
```typescript
it('should insert message and return it with timestamp', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  db.insertSession({
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  });

  const message = {
    id: 'msg_1',
    sessionId: 'sess_test123',
    role: 'user',
    content: 'Hello, Claude!',
  };

  // Act
  const result = db.insertMessage(message);

  // Assert
  expect(result.id).toBe('msg_1');
  expect(result.content).toBe('Hello, Claude!');
  expect(result.timestamp).toBeDefined();

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 2: Enforces foreign key
```typescript
it('should throw error when session does not exist', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  const message = {
    id: 'msg_1',
    sessionId: 'nonexistent',
    role: 'user',
    content: 'Hello',
  };

  // Act & Assert
  expect(() => db.insertMessage(message)).toThrow();

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 3: Handles tool calls JSON
```typescript
it('should store and retrieve tool calls as JSON', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  db.insertSession({
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  });

  const toolCalls = [
    { tool: 'write_file', args: { path: 'test.ts' } }
  ];

  const message = {
    id: 'msg_1',
    sessionId: 'sess_test123',
    role: 'assistant',
    content: 'Creating file...',
    toolCalls,
  };

  // Act
  const result = db.insertMessage(message);

  // Assert
  expect(result.toolCalls).toEqual(toolCalls);

  // Cleanup
  db.close();
});
```

#### Test Suite: getMessages()

##### ✅ Test Case 1: Returns messages for session
```typescript
it('should return messages ordered by timestamp ASC', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  db.insertSession({
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  });

  db.insertMessage({
    id: 'msg_1',
    sessionId: 'sess_test123',
    role: 'user',
    content: 'First',
  });

  db.insertMessage({
    id: 'msg_2',
    sessionId: 'sess_test123',
    role: 'assistant',
    content: 'Second',
  });

  // Act
  const result = db.getMessages('sess_test123');

  // Assert
  expect(result).toHaveLength(2);
  expect(result[0].content).toBe('First');
  expect(result[1].content).toBe('Second');

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 2: Limits results
```typescript
it('should limit number of messages returned', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  db.insertSession({
    id: 'sess_test123',
    title: 'Test Session',
    rootDirectory: '/test/path',
    branchName: 'session/sess_test123',
  });

  for (let i = 0; i < 10; i++) {
    db.insertMessage({
      id: `msg_${i}`,
      sessionId: 'sess_test123',
      role: 'user',
      content: `Message ${i}`,
    });
  }

  // Act
  const result = db.getMessages('sess_test123', 5);

  // Assert
  expect(result).toHaveLength(5);

  // Cleanup
  db.close();
});
```

#### Test Suite: Settings Operations

##### ✅ Test Case 1: Gets and sets settings
```typescript
it('should set and get setting', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');

  // Act
  db.setSetting('apiKey', 'sk-test123');
  const result = db.getSetting('apiKey');

  // Assert
  expect(result?.value).toBe('sk-test123');

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 2: Updates existing setting
```typescript
it('should update existing setting', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');
  db.setSetting('model', 'claude-sonnet-4');

  // Act
  db.setSetting('model', 'claude-sonnet-4.5');
  const result = db.getSetting('model');

  // Assert
  expect(result?.value).toBe('claude-sonnet-4.5');

  // Cleanup
  db.close();
});
```

##### ✅ Test Case 3: Handles scoped settings
```typescript
it('should handle global and workspace-scoped settings', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');

  // Act
  db.setSetting('theme', 'dark', 'global');
  db.setSetting('theme', 'light', 'workspace:/test/path');

  const globalSetting = db.getSetting('theme');
  const workspaceSetting = db.getSetting('theme', 'workspace:/test/path');

  // Assert
  expect(globalSetting?.value).toBe('dark');
  expect(workspaceSetting?.value).toBe('light');

  // Cleanup
  db.close();
});
```

#### Test Suite: close()

##### ✅ Test Case 1: Closes database connection
```typescript
it('should close database connection', () => {
  // Arrange
  const db = new DatabaseClient(':memory:');

  // Act
  db.close();

  // Assert
  expect(() => db.getSessions()).toThrow();
});
```

---

## Integration Tests

### Integration Test 1: Full Lifecycle

**Scope**: Database creation → Data insertion → Query → Update → Delete

#### Setup
```typescript
describe('Database Integration', () => {
  let dbPath: string;
  let db: DatabaseClient;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `test-${Date.now()}.sqlite`);
    db = new DatabaseClient(dbPath);
  });

  afterEach(() => {
    db.close();
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });
});
```

#### ✅ Test Case: Complete session workflow
```typescript
it('should handle complete session workflow', () => {
  // Create session
  const session = db.insertSession({
    id: 'sess_integration',
    title: 'Integration Test Session',
    rootDirectory: '/test/integration',
    branchName: 'session/sess_integration',
  });

  expect(session.id).toBe('sess_integration');

  // Add messages
  db.insertMessage({
    id: 'msg_1',
    sessionId: 'sess_integration',
    role: 'user',
    content: 'Test message',
  });

  // Query messages
  const messages = db.getMessages('sess_integration');
  expect(messages).toHaveLength(1);

  // Update session
  db.updateSession('sess_integration', {
    title: 'Updated Title',
    gitStatus: 'modified',
  });

  // Verify update
  const updated = db.getSession('sess_integration');
  expect(updated?.title).toBe('Updated Title');

  // Delete session
  db.deleteSession('sess_integration');

  // Verify deletion
  const deleted = db.getSession('sess_integration');
  expect(deleted).toBeNull();
});
```

---

## Test Data

### Mock Data

#### Sample Session
```typescript
const mockSession: InsertSession = {
  id: 'sess_test123',
  title: 'Test Session',
  rootDirectory: '/Users/test/project',
  branchName: 'session/sess_test123',
  baseBranch: 'main',
  gitStatus: 'clean',
};
```

#### Sample Message
```typescript
const mockMessage: InsertMessage = {
  id: 'msg_abc123',
  sessionId: 'sess_test123',
  role: 'user',
  content: 'Hello, can you help me with this code?',
};
```

#### Sample Message with Tool Calls
```typescript
const mockAssistantMessage: InsertMessage = {
  id: 'msg_def456',
  sessionId: 'sess_test123',
  role: 'assistant',
  content: "I'll create a new file for you.",
  toolCalls: [
    {
      tool: 'write_file',
      args: {
        path: 'test.ts',
        content: 'console.log("hello");'
      }
    }
  ],
};
```

---

## Mocks & Stubs

### Mocking Strategy

For database tests, we use real SQLite databases (in-memory or temp files) rather than mocks because:
- better-sqlite3 is synchronous and fast
- Real databases catch SQL errors
- No complex mocking needed

---

## Test Execution

### Running Tests

```bash
# Run database tests
pnpm --filter @claude-code-manager/server test:unit

# Run specific test file
pnpm --filter @claude-code-manager/server test:unit src/db/client.test.ts

# Run with coverage
pnpm --filter @claude-code-manager/server test:coverage
```

---

## Coverage Requirements

### Minimum Coverage Thresholds

```json
{
  "coverage": {
    "branches": 80,
    "functions": 80,
    "lines": 80,
    "statements": 80
  }
}
```

---

## Checklist

Before marking feature as "tested":

- [ ] All unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Test coverage ≥ 80%
- [ ] No flaky tests
- [ ] All edge cases covered
- [ ] Foreign key constraints tested
- [ ] Error cases covered
- [ ] Database cleanup in all tests

---

**Document History**:
- 2025-10-23: Initial test cases
