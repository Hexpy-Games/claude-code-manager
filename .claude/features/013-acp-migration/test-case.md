# Feature 013: ACP Migration - Test Cases

> **Feature**: Migrate from Headless Claude CLI to Agent Client Protocol (ACP)
> **Status**: Planning
> **Test Coverage Target**: ≥ 90%

---

## Test Strategy

### Testing Pyramid

```
              ┌──────────────┐
              │  Manual (5%) │
              └──────────────┘
          ┌─────────────────────┐
          │  E2E Tests (15%)    │
          └─────────────────────┘
     ┌──────────────────────────────┐
     │  Integration Tests (30%)     │
     └──────────────────────────────┘
┌─────────────────────────────────────────┐
│   Unit Tests (50%)                      │
└─────────────────────────────────────────┘
```

### Test Files

```
apps/server/src/
├── services/
│   ├── acp/
│   │   ├── claude-acp-client.test.ts       # 50+ tests
│   │   ├── client-handler.test.ts          # 20+ tests
│   │   └── utils.test.ts                   # 10+ tests
│   └── claude-agent-service.test.ts        # +30 tests for ACP mode
├── routes/
│   ├── messages.test.ts                    # +10 tests for tool calls
│   └── stream.test.ts                      # +10 tests for ACP streaming
└── __integration__/
    └── acp-integration.test.ts             # 30+ tests

apps/desktop/e2e/
├── acp-features.spec.ts                    # 15+ tests
├── acp-mode-switching.spec.ts              # 10+ tests
└── tool-call-display.spec.ts               # 10+ tests
```

---

## Unit Tests

### ClaudeAcpClient Tests

#### Initialization Tests

```typescript
describe('ClaudeAcpClient - Initialization', () => {
  it('should spawn claude-code-acp process', async () => {
    const client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();

    expect(client.getProcess()).toBeDefined();
    expect(client.getProcess()?.pid).toBeGreaterThan(0);
  });

  it('should establish ACP connection', async () => {
    const client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();

    expect(client.isConnected()).toBe(true);
  });

  it('should perform protocol handshake', async () => {
    const client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();

    expect(client.getProtocolVersion()).toBe('0.1.0');
  });

  it('should throw error if API key missing', async () => {
    const client = new ClaudeAcpClient({ apiKey: '' });

    await expect(client.initialize()).rejects.toThrow('API key required');
  });

  it('should throw error if claude-code-acp not found', async () => {
    // Mock spawn to simulate command not found
    const client = new ClaudeAcpClient({ apiKey: 'test-key' });

    await expect(client.initialize()).rejects.toThrow('claude-code-acp not found');
  });

  it('should set client capabilities', async () => {
    const client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();

    const caps = client.getCapabilities();
    expect(caps.fs.readTextFile).toBe(true);
    expect(caps.fs.writeTextFile).toBe(true);
    expect(caps.terminal.run).toBe(true);
  });

  it('should handle initialization timeout', async () => {
    const client = new ClaudeAcpClient({ apiKey: 'test-key', timeout: 100 });

    await expect(client.initialize()).rejects.toThrow('Initialization timeout');
  });
});
```

#### Session Management Tests

```typescript
describe('ClaudeAcpClient - Session Management', () => {
  let client: ClaudeAcpClient;

  beforeEach(async () => {
    client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();
  });

  afterEach(async () => {
    await client.close();
  });

  it('should create new session', async () => {
    const session = await client.createSession({
      cwd: '/test/path',
      mcpServers: []
    });

    expect(session.sessionId).toBeDefined();
    expect(session.cwd).toBe('/test/path');
  });

  it('should create session with MCP servers', async () => {
    const session = await client.createSession({
      cwd: '/test/path',
      mcpServers: [{ name: 'test-server', config: {} }]
    });

    expect(session.sessionId).toBeDefined();
  });

  it('should reuse existing session', async () => {
    const session1 = await client.createSession({ cwd: '/test' });
    const session2 = client.getSession(session1.sessionId);

    expect(session2).toBeDefined();
    expect(session2?.sessionId).toBe(session1.sessionId);
  });

  it('should return undefined for non-existent session', async () => {
    const session = client.getSession('non-existent-id');
    expect(session).toBeUndefined();
  });

  it('should track multiple sessions', async () => {
    const session1 = await client.createSession({ cwd: '/test1' });
    const session2 = await client.createSession({ cwd: '/test2' });

    expect(session1.sessionId).not.toBe(session2.sessionId);
    expect(client.getSession(session1.sessionId)).toBeDefined();
    expect(client.getSession(session2.sessionId)).toBeDefined();
  });
});
```

#### Message Sending Tests

```typescript
describe('ClaudeAcpClient - Message Sending', () => {
  let client: ClaudeAcpClient;
  let sessionId: string;

  beforeEach(async () => {
    client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();
    const session = await client.createSession({ cwd: '/test' });
    sessionId = session.sessionId;
  });

  afterEach(async () => {
    await client.close();
  });

  it('should send message and receive response', async () => {
    const result = await client.sendMessage(sessionId, 'Hello');

    expect(result.content).toBeDefined();
    expect(result.content).toContain('Hello');
  });

  it('should handle tool calls in response', async () => {
    const result = await client.sendMessage(
      sessionId,
      'Create a file named test.txt'
    );

    expect(result.toolCalls).toBeDefined();
    expect(result.toolCalls.length).toBeGreaterThan(0);
    expect(result.toolCalls[0].name).toBe('write_file');
    expect(result.toolCalls[0].input.path).toContain('test.txt');
  });

  it('should include stop reason in response', async () => {
    const result = await client.sendMessage(sessionId, 'Hello');

    expect(result.stopReason).toBeDefined();
    expect(['end_turn', 'stop_sequence', 'max_tokens']).toContain(result.stopReason);
  });

  it('should throw error when not initialized', async () => {
    const uninitClient = new ClaudeAcpClient({ apiKey: 'test-key' });

    await expect(
      uninitClient.sendMessage(sessionId, 'Hello')
    ).rejects.toThrow('Client not initialized');
  });

  it('should throw error for invalid session ID', async () => {
    await expect(
      client.sendMessage('invalid-session', 'Hello')
    ).rejects.toThrow('Session not found');
  });

  it('should handle empty messages', async () => {
    await expect(
      client.sendMessage(sessionId, '')
    ).rejects.toThrow('Message cannot be empty');
  });

  it('should handle very long messages', async () => {
    const longMessage = 'a'.repeat(100000);
    const result = await client.sendMessage(sessionId, longMessage);

    expect(result.content).toBeDefined();
  });
});
```

#### Streaming Tests

```typescript
describe('ClaudeAcpClient - Streaming', () => {
  let client: ClaudeAcpClient;
  let sessionId: string;

  beforeEach(async () => {
    client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();
    const session = await client.createSession({ cwd: '/test' });
    sessionId = session.sessionId;
  });

  afterEach(async () => {
    await client.close();
  });

  it('should stream message chunks', async () => {
    const chunks: string[] = [];

    for await (const chunk of client.streamMessage(sessionId, 'Hello')) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.join('')).toContain('Hello');
  });

  it('should return final result after streaming', async () => {
    const stream = client.streamMessage(sessionId, 'Create file test.txt');

    // Consume all chunks
    for await (const chunk of stream) {
      // Just consume
    }

    // Check return value
    const result = await stream.next();
    if (result.done) {
      expect(result.value.toolCalls).toBeDefined();
      expect(result.value.stopReason).toBeDefined();
    }
  });

  it('should handle stream interruption', async () => {
    const stream = client.streamMessage(sessionId, 'Write a long essay');

    // Take only first few chunks
    let count = 0;
    for await (const chunk of stream) {
      count++;
      if (count >= 5) break;
    }

    expect(count).toBe(5);
  });

  it('should handle stream errors gracefully', async () => {
    // Simulate connection drop during stream
    const stream = client.streamMessage(sessionId, 'Hello');

    let errorThrown = false;
    try {
      for await (const chunk of stream) {
        // Simulate process crash
        if (chunk.length > 10) {
          client.getProcess()?.kill();
        }
      }
    } catch (error) {
      errorThrown = true;
      expect(error).toBeInstanceOf(Error);
    }

    expect(errorThrown).toBe(true);
  });
});
```

#### Error Handling Tests

```typescript
describe('ClaudeAcpClient - Error Handling', () => {
  it('should handle process crash', async () => {
    const client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();
    const session = await client.createSession({ cwd: '/test' });

    // Kill process
    client.getProcess()?.kill();

    await expect(
      client.sendMessage(session.sessionId, 'Hello')
    ).rejects.toThrow('ACP process not running');
  });

  it('should handle connection loss', async () => {
    const client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();
    const session = await client.createSession({ cwd: '/test' });

    // Simulate connection loss
    client.disconnect();

    await expect(
      client.sendMessage(session.sessionId, 'Hello')
    ).rejects.toThrow('Client not initialized');
  });

  it('should handle malformed ACP responses', async () => {
    // Mock ACP to return invalid JSON
    const client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();
    const session = await client.createSession({ cwd: '/test' });

    // This would be mocked in actual test
    const result = await client.sendMessage(session.sessionId, 'Hello');

    // Should handle gracefully, not crash
    expect(result).toBeDefined();
  });

  it('should handle timeout errors', async () => {
    const client = new ClaudeAcpClient({ apiKey: 'test-key', timeout: 1000 });
    await client.initialize();
    const session = await client.createSession({ cwd: '/test' });

    // Mock long response
    await expect(
      client.sendMessage(session.sessionId, 'Very complex task')
    ).rejects.toThrow('Request timeout');
  });

  it('should cleanup resources on error', async () => {
    const client = new ClaudeAcpClient({ apiKey: 'test-key' });
    await client.initialize();

    try {
      await client.sendMessage('invalid-session', 'Hello');
    } catch (error) {
      // Error expected
    }

    // Should still be able to close cleanly
    await expect(client.close()).resolves.not.toThrow();
  });
});
```

### AcpClientHandler Tests

```typescript
describe('AcpClientHandler', () => {
  let handler: AcpClientHandler;

  beforeEach(() => {
    handler = new AcpClientHandler();
  });

  describe('Permission Requests', () => {
    it('should auto-approve in bypassPermissions mode', async () => {
      handler.setPermissionMode('bypassPermissions');

      const response = await handler.requestPermission({
        tool: 'write_file',
        params: { path: 'test.txt' }
      });

      expect(response.allowed).toBe(true);
    });

    it('should auto-approve file edits in acceptEdits mode', async () => {
      handler.setPermissionMode('acceptEdits');

      const response = await handler.requestPermission({
        tool: 'write_file',
        params: { path: 'test.txt' }
      });

      expect(response.allowed).toBe(true);
    });

    it('should deny all in plan mode', async () => {
      handler.setPermissionMode('plan');

      const response = await handler.requestPermission({
        tool: 'write_file',
        params: { path: 'test.txt' }
      });

      expect(response.allowed).toBe(false);
    });

    it('should ask user in default mode', async () => {
      handler.setPermissionMode('default');

      // In tests, default to allow
      const response = await handler.requestPermission({
        tool: 'run_command',
        params: { command: 'ls' }
      });

      expect(response.allowed).toBeDefined();
    });
  });

  describe('Diff Display', () => {
    it('should handle diff notification', async () => {
      const diff = {
        path: 'test.txt',
        oldContent: 'old',
        newContent: 'new'
      };

      await expect(handler.showDiff(diff)).resolves.not.toThrow();
    });
  });

  describe('TODO Updates', () => {
    it('should handle todo update', async () => {
      const todo = {
        action: 'add',
        item: 'Test item'
      };

      await expect(handler.updateTodo(todo)).resolves.not.toThrow();
    });
  });

  describe('Error Display', () => {
    it('should handle error notification', async () => {
      const error = {
        message: 'Test error',
        code: 'TEST_ERROR'
      };

      await expect(handler.showError(error)).resolves.not.toThrow();
    });
  });
});
```

### ClaudeAgentService Tests (ACP Mode)

```typescript
describe('ClaudeAgentService - ACP Mode', () => {
  let service: ClaudeAgentService;
  let db: DatabaseClient;

  beforeEach(() => {
    process.env.CLAUDE_INTEGRATION_MODE = 'acp';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    db = new DatabaseClient(':memory:');
    service = new ClaudeAgentService(db, { model: 'claude-3-5-sonnet-20241022' });
  });

  it('should initialize with ACP client', () => {
    expect(service.getMode()).toBe('acp');
  });

  it('should send message via ACP client', async () => {
    const session = db.insertSession({
      id: 'sess_test',
      title: 'Test',
      rootDirectory: '/test',
      branchName: 'main',
      workspacePath: '/test'
    });

    const result = await service.sendMessage(session.id, 'Hello');

    expect(result.assistantMessage.content).toBeDefined();
  });

  it('should save tool calls to database', async () => {
    const session = db.insertSession({
      id: 'sess_test',
      title: 'Test',
      rootDirectory: '/test',
      branchName: 'main',
      workspacePath: '/test'
    });

    await service.sendMessage(session.id, 'Create file test.txt');

    const messages = db.getMessagesBySession(session.id);
    const assistantMsg = messages.find(m => m.role === 'assistant');

    expect(assistantMsg?.tool_calls).toBeDefined();
    const toolCalls = JSON.parse(assistantMsg!.tool_calls!);
    expect(toolCalls.length).toBeGreaterThan(0);
    expect(toolCalls[0].name).toBe('write_file');
  });

  it('should fallback to CLI if ACP fails', async () => {
    // Simulate ACP failure
    process.env.CLAUDE_INTEGRATION_MODE = 'acp';
    delete process.env.ANTHROPIC_API_KEY;

    const service2 = new ClaudeAgentService(db);

    // Should fallback to CLI
    expect(service2.getMode()).toBe('cli');
  });
});
```

---

## Integration Tests

### ACP Integration Tests

```typescript
describe('ACP Integration', () => {
  let fastify: FastifyInstance;
  let db: DatabaseClient;

  beforeEach(async () => {
    process.env.CLAUDE_INTEGRATION_MODE = 'acp';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    db = new DatabaseClient(':memory:');
    fastify = await createServer(db);
  });

  afterEach(async () => {
    await fastify.close();
  });

  it('should create session and send message via ACP', async () => {
    // Create session
    const sessionRes = await fastify.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        title: 'Test Session',
        rootDirectory: '/test/repo'
      }
    });

    expect(sessionRes.statusCode).toBe(200);
    const { session } = JSON.parse(sessionRes.body);

    // Send message
    const messageRes = await fastify.inject({
      method: 'POST',
      url: `/api/sessions/${session.id}/messages`,
      payload: {
        content: 'Create a file named test.txt'
      }
    });

    expect(messageRes.statusCode).toBe(200);
    const { userMessage, assistantMessage } = JSON.parse(messageRes.body);

    // Check tool calls saved
    expect(assistantMessage.toolCalls).toBeDefined();
    expect(assistantMessage.toolCalls.length).toBeGreaterThan(0);
  });

  it('should stream messages via WebSocket in ACP mode', async () => {
    // Create session
    const session = db.insertSession({
      id: 'sess_test',
      title: 'Test',
      rootDirectory: '/test',
      branchName: 'main',
      workspacePath: '/test'
    });

    // Connect WebSocket
    const ws = new WebSocket(`ws://localhost:${fastify.server.address().port}/ws`);

    const chunks: string[] = [];

    ws.on('message', (data) => {
      chunks.push(data.toString());
    });

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'stream',
        sessionId: session.id,
        content: 'Hello'
      }));
    });

    // Wait for stream to complete
    await new Promise(resolve => ws.on('close', resolve));

    expect(chunks.length).toBeGreaterThan(0);
  });

  it('should handle permission mode changes', async () => {
    const session = db.insertSession({
      id: 'sess_test',
      title: 'Test',
      rootDirectory: '/test',
      branchName: 'main',
      workspacePath: '/test'
    });

    // Set permission mode
    const res = await fastify.inject({
      method: 'PUT',
      url: `/api/sessions/${session.id}/permission-mode`,
      payload: { permissionMode: 'acceptEdits' }
    });

    expect(res.statusCode).toBe(200);

    // Verify mode saved
    const getRes = await fastify.inject({
      method: 'GET',
      url: `/api/sessions/${session.id}/permission-mode`
    });

    const { permissionMode } = JSON.parse(getRes.body);
    expect(permissionMode).toBe('acceptEdits');
  });
});
```

### Mode Switching Tests

```typescript
describe('Mode Switching', () => {
  it('should switch from CLI to ACP', async () => {
    // Start in CLI mode
    process.env.CLAUDE_INTEGRATION_MODE = 'cli';
    const db1 = new DatabaseClient(':memory:');
    const server1 = await createServer(db1);

    const service1 = server1.services.claude;
    expect(service1.getMode()).toBe('cli');

    await server1.close();

    // Switch to ACP mode
    process.env.CLAUDE_INTEGRATION_MODE = 'acp';
    process.env.ANTHROPIC_API_KEY = 'test-key';

    const db2 = new DatabaseClient(':memory:');
    const server2 = await createServer(db2);

    const service2 = server2.services.claude;
    expect(service2.getMode()).toBe('acp');

    await server2.close();
  });

  it('should preserve existing sessions when switching modes', async () => {
    const db = new DatabaseClient(':memory:');

    // Create session in CLI mode
    process.env.CLAUDE_INTEGRATION_MODE = 'cli';
    const session = db.insertSession({
      id: 'sess_test',
      title: 'Test',
      rootDirectory: '/test',
      branchName: 'main',
      workspacePath: '/test'
    });

    // Switch to ACP mode
    process.env.CLAUDE_INTEGRATION_MODE = 'acp';

    // Session should still exist
    const retrieved = db.getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(session.id);
  });
});
```

---

## E2E Tests

### ACP Feature Tests

```typescript
// apps/desktop/e2e/acp-features.spec.ts
import { test, expect } from '@playwright/test';

test.describe('ACP Features', () => {
  test.beforeEach(async ({ page }) => {
    // Enable ACP mode
    await page.goto('http://localhost:3000');
    // Set env var or use settings UI
  });

  test('should display tool calls in message', async ({ page }) => {
    // Create session
    await page.click('[data-testid="new-session"]');
    await page.fill('[data-testid="session-title"]', 'Test Session');
    await page.click('[data-testid="create-session"]');

    // Send message that triggers tool
    await page.fill('[data-testid="message-input"]', 'Create a file named test.txt');
    await page.click('[data-testid="send-message"]');

    // Wait for response
    await page.waitForSelector('.message.assistant');

    // Check for tool call display
    await expect(page.locator('.tool-call')).toBeVisible();
    await expect(page.locator('.tool-name')).toContainText('write_file');
    await expect(page.locator('.tool-input')).toContainText('test.txt');
  });

  test('should stream messages smoothly', async ({ page }) => {
    await page.click('[data-testid="new-session"]');
    await page.fill('[data-testid="session-title"]', 'Test');
    await page.click('[data-testid="create-session"]');

    // Send message
    await page.fill('[data-testid="message-input"]', 'Write a short story');
    await page.click('[data-testid="send-message"]');

    // Check for streaming indicator
    await expect(page.locator('.typing-indicator')).toBeVisible();

    // Wait for completion
    await page.waitForSelector('.message.assistant');

    // Verify content appeared
    const content = await page.textContent('.message.assistant .message-content');
    expect(content).toBeTruthy();
    expect(content!.length).toBeGreaterThan(50);
  });

  test('should handle permission mode changes', async ({ page }) => {
    await page.click('[data-testid="settings"]');

    // Find permission mode setting
    await page.selectOption('[data-testid="permission-mode"]', 'acceptEdits');

    // Verify mode changed
    const selected = await page.inputValue('[data-testid="permission-mode"]');
    expect(selected).toBe('acceptEdits');

    // Send message requiring file edit
    await page.click('[data-testid="close-settings"]');
    await page.fill('[data-testid="message-input"]', 'Edit the README');
    await page.click('[data-testid="send-message"]');

    // Should not show permission dialog (auto-approved)
    await expect(page.locator('.permission-dialog')).not.toBeVisible();
  });
});
```

### Mode Switching E2E Tests

```typescript
// apps/desktop/e2e/acp-mode-switching.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mode Switching', () => {
  test('should switch between CLI and ACP modes', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Open settings
    await page.click('[data-testid="settings"]');

    // Check current mode
    const currentMode = await page.textContent('[data-testid="current-mode"]');
    expect(currentMode).toBeTruthy();

    // Switch mode
    if (currentMode === 'CLI') {
      await page.selectOption('[data-testid="integration-mode"]', 'acp');
    } else {
      await page.selectOption('[data-testid="integration-mode"]', 'cli');
    }

    // Click save (may require restart)
    await page.click('[data-testid="save-settings"]');

    // Check for restart prompt or confirmation
    await expect(
      page.locator('text=Restart required') || page.locator('text=Mode updated')
    ).toBeVisible();
  });

  test('should show ACP benefits in settings', async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.click('[data-testid="settings"]');

    // Select ACP mode
    await page.selectOption('[data-testid="integration-mode"]', 'acp');

    // Check for benefits display
    await expect(page.locator('text=Tool calls visible')).toBeVisible();
    await expect(page.locator('text=Permission management')).toBeVisible();
    await expect(page.locator('text=Better performance')).toBeVisible();
  });
});
```

### Tool Call Display E2E Tests

```typescript
// apps/desktop/e2e/tool-call-display.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Tool Call Display', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure ACP mode
    await page.goto('http://localhost:3000');
    // ... setup ...
  });

  test('should display write_file tool call', async ({ page }) => {
    await sendMessage(page, 'Create file test.txt with content "Hello"');

    await expect(page.locator('.tool-call')).toBeVisible();
    await expect(page.locator('.tool-name')).toHaveText('write_file');

    const input = await page.textContent('.tool-input');
    expect(input).toContain('test.txt');
    expect(input).toContain('Hello');
  });

  test('should display run_command tool call', async ({ page }) => {
    await sendMessage(page, 'Run ls command');

    await expect(page.locator('.tool-call')).toBeVisible();
    await expect(page.locator('.tool-name')).toHaveText('run_command');

    const input = await page.textContent('.tool-input');
    expect(input).toContain('ls');
  });

  test('should display multiple tool calls', async ({ page }) => {
    await sendMessage(page, 'Create two files: a.txt and b.txt');

    const toolCalls = page.locator('.tool-call');
    await expect(toolCalls).toHaveCount(2);

    const names = await toolCalls.locator('.tool-name').allTextContents();
    expect(names.every(n => n === 'write_file')).toBe(true);
  });

  test('should format tool call JSON nicely', async ({ page }) => {
    await sendMessage(page, 'Create file test.txt');

    const input = page.locator('.tool-input');
    const text = await input.textContent();

    // Check for pretty-printed JSON
    expect(text).toContain('{\n');
    expect(text).toContain('  ');  // Indentation
  });
});

async function sendMessage(page: Page, text: string) {
  await page.fill('[data-testid="message-input"]', text);
  await page.click('[data-testid="send-message"]');
  await page.waitForSelector('.message.assistant');
}
```

---

## Performance Tests

```typescript
// apps/server/src/__benchmarks__/acp-vs-cli.bench.ts
import { bench, describe } from 'vitest';

describe('ACP vs CLI Performance', () => {
  bench('CLI: First message latency', async () => {
    process.env.CLAUDE_INTEGRATION_MODE = 'cli';
    const service = new ClaudeAgentService(db);
    const start = Date.now();
    await service.sendMessage(sessionId, 'Hello');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(2000);  // < 2s
  });

  bench('ACP: First message latency', async () => {
    process.env.CLAUDE_INTEGRATION_MODE = 'acp';
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const service = new ClaudeAgentService(db);
    const start = Date.now();
    await service.sendMessage(sessionId, 'Hello');
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);  // < 1s
  });

  bench('CLI: Subsequent message', async () => {
    // ... similar test for cached session
    expect(duration).toBeLessThan(1200);
  });

  bench('ACP: Subsequent message', async () => {
    // ... similar test with reused connection
    expect(duration).toBeLessThan(500);
  });

  bench('Memory usage: 100 messages (CLI)', async () => {
    const initialMem = process.memoryUsage().heapUsed;
    for (let i = 0; i < 100; i++) {
      await service.sendMessage(sessionId, `Message ${i}`);
    }
    const finalMem = process.memoryUsage().heapUsed;
    const diff = finalMem - initialMem;
    expect(diff).toBeLessThan(50 * 1024 * 1024);  // < 50MB
  });

  bench('Memory usage: 100 messages (ACP)', async () => {
    // ... same test, should show similar or better memory usage
    expect(diff).toBeLessThan(50 * 1024 * 1024);
  });
});
```

---

## Test Coverage Requirements

### Minimum Coverage by Module

| Module | Target | Critical |
|--------|--------|----------|
| claude-acp-client.ts | 95% | Yes |
| client-handler.ts | 90% | Yes |
| claude-agent-service.ts | 90% | Yes |
| Message routes | 85% | Medium |
| Stream routes | 85% | Medium |
| Frontend tool display | 80% | Low |

### Critical Paths (100% Coverage Required)

- [ ] ACP connection initialization
- [ ] Session creation
- [ ] Message sending
- [ ] Tool call extraction
- [ ] Error handling
- [ ] Resource cleanup

---

## Manual Testing Checklist

### Pre-Deployment Testing

- [ ] Install fresh on clean machine
- [ ] Verify claude-code-acp installation check works
- [ ] Test CLI mode (baseline)
- [ ] Switch to ACP mode
- [ ] Create session in ACP mode
- [ ] Send various message types:
  - [ ] Simple question
  - [ ] File creation request
  - [ ] Command execution request
  - [ ] Multi-step task
- [ ] Verify tool calls display correctly
- [ ] Test streaming smoothness
- [ ] Test permission modes (all 4)
- [ ] Switch back to CLI mode
- [ ] Verify existing data intact
- [ ] Test error scenarios:
  - [ ] API key missing
  - [ ] claude-code-acp not installed
  - [ ] Network interruption
  - [ ] Process crash
- [ ] Performance testing (subjective feel)
- [ ] Memory leak testing (long session)

### Regression Testing

- [ ] All 257 existing tests still pass
- [ ] No new console errors
- [ ] No UI glitches
- [ ] Git operations still work
- [ ] Session switching still works
- [ ] Settings save correctly

---

## Test Data

### Sample Messages

```typescript
export const TEST_MESSAGES = {
  simple: 'Hello, how are you?',
  fileCreate: 'Create a file named test.txt with content "Hello World"',
  fileEdit: 'Edit the README.md file to add a new section',
  commandRun: 'Run the command "npm test"',
  multiStep: 'Create a new React component called Button in src/components/',
  longResponse: 'Write a detailed explanation of how React hooks work',
  complex: 'Refactor the authentication system to use JWT tokens'
};
```

### Sample Tool Calls

```typescript
export const SAMPLE_TOOL_CALLS = [
  {
    id: 'toolu_01A09q90qw90',
    name: 'write_file',
    input: {
      path: 'test.txt',
      content: 'Hello World'
    }
  },
  {
    id: 'toolu_02B19r01qx01',
    name: 'run_command',
    input: {
      command: 'npm test',
      cwd: '/workspace'
    }
  },
  {
    id: 'toolu_03C29s12ry12',
    name: 'edit_file',
    input: {
      path: 'README.md',
      changes: [...]
    }
  }
];
```

---

## Success Criteria

### Test Metrics

- [ ] All new tests pass (100+ new tests)
- [ ] All existing tests pass (257 tests)
- [ ] Code coverage ≥ 90% for ACP code
- [ ] Code coverage ≥ 85% overall
- [ ] 0 critical bugs
- [ ] Performance benchmarks meet targets
- [ ] E2E tests cover all user workflows
- [ ] Manual testing checklist 100% complete

### Quality Metrics

- [ ] No flaky tests
- [ ] No skipped tests in CI
- [ ] All tests run in < 5 minutes
- [ ] E2E tests run in < 2 minutes
- [ ] Test output is clear and actionable

---

**Status**: Test cases defined, ready for TDD implementation 🚀
