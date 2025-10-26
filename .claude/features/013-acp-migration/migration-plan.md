# Feature 013: ACP Migration - Detailed Implementation Plan

> **Status**: Planning
> **Created**: 2025-10-26
> **Target Completion**: 2-3 weeks
> **Priority**: High (Addresses headless mode limitations)

---

## Executive Summary

**Objective**: Migrate from headless Claude CLI subprocess integration to Agent Client Protocol (ACP) for complete feature parity with Claude Code.

**Current Problem**:
- Headless CLI mode incomplete (no tool calls, limited stop reasons)
- Process spawn overhead on every request
- No permission management
- No MCP server support
- Difficult debugging (stderr parsing)

**Solution**:
- Integrate `@zed-industries/claude-code-acp` package
- Use ACP JSON-RPC protocol over stdio
- Enable full Claude Code features (tools, permissions, MCP)

**Expected Benefits**:
- ✅ Tool call information exposed
- ✅ Permission management (4 modes)
- ✅ MCP server integration
- ✅ Better error handling (structured responses)
- ✅ File diff display
- ✅ Long-running process (reduced latency)

**Timeline**: 2-3 weeks across 3 phases

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Target State Architecture](#2-target-state-architecture)
3. [Migration Strategy](#3-migration-strategy)
4. [Phase 1: Foundation (Week 1)](#4-phase-1-foundation-week-1)
5. [Phase 2: Implementation (Week 2)](#5-phase-2-implementation-week-2)
6. [Phase 3: Migration & Cleanup (Week 3)](#6-phase-3-migration--cleanup-week-3)
7. [Testing Strategy](#7-testing-strategy)
8. [Risk Mitigation](#8-risk-mitigation)
9. [Rollback Procedures](#9-rollback-procedures)
10. [Success Criteria](#10-success-criteria)

---

## 1. Current State Analysis

### 1.1 Current Architecture

```
┌─────────────────────────────────────┐
│   ClaudeAgentService                │
│   (apps/server/src/services/)       │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   ClaudeCodeClient                  │
│   (subprocess spawner)              │
└──────────────┬──────────────────────┘
               │
               ↓ spawn('claude', args)
┌─────────────────────────────────────┐
│   Claude CLI Process                │
│   (headless mode)                   │
└─────────────────────────────────────┘
```

### 1.2 Current Implementation Files

```
apps/server/src/
├── services/
│   ├── claude-code-client.ts       # CLI subprocess wrapper
│   └── claude-agent-service.ts     # Service layer
└── routes/
    ├── messages.ts                 # REST endpoints
    └── stream.ts                   # WebSocket streaming
```

### 1.3 Current Limitations

| Issue | Impact | Severity |
|-------|--------|----------|
| No tool call info | Can't display what Claude is doing | High |
| No permission management | Can't control tool execution | High |
| No MCP support | Can't extend with custom tools | Medium |
| Process spawn overhead | ~200-500ms latency per request | Medium |
| Limited stop reasons | Can't distinguish completion types | Low |
| stderr parsing for errors | Fragile error detection | Medium |

### 1.4 Database Schema (Already Ready!)

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  tool_calls TEXT,  -- ✅ Already exists! Just need to populate
  created_at INTEGER NOT NULL
);
```

**Good news**: Our DB already has `tool_calls` column. We just need to start using it!

---

## 2. Target State Architecture

### 2.1 ACP Architecture

```
┌─────────────────────────────────────┐
│   ClaudeAgentService                │
│   (business logic layer)            │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   ClaudeAcpClient                   │ ← NEW
│   (ACP protocol client)             │
└──────────────┬──────────────────────┘
               │
               ↓ JSON-RPC over stdio
┌─────────────────────────────────────┐
│   claude-code-acp process           │
│   (long-running agent)              │
└──────────────┬──────────────────────┘
               │
               ↓
┌─────────────────────────────────────┐
│   Claude Agent SDK                  │
│   → Anthropic API                   │
└─────────────────────────────────────┘
```

### 2.2 New Implementation Structure

```
apps/server/src/
├── services/
│   ├── claude-acp-client.ts        # NEW: ACP client
│   ├── claude-code-client.ts       # KEEP: Legacy CLI client
│   ├── claude-agent-service.ts     # MODIFY: Support both clients
│   └── acp/                        # NEW: ACP-specific modules
│       ├── client-handler.ts       # Implements ACP Client interface
│       ├── types.ts                # ACP type definitions
│       └── utils.ts                # Helper functions
└── routes/
    ├── messages.ts                 # MODIFY: Handle tool calls
    └── stream.ts                   # MODIFY: ACP streaming
```

### 2.3 Key Components

#### ClaudeAcpClient (New)
- Spawns `claude-code-acp` process
- Manages JSON-RPC connection
- Handles protocol initialization
- Manages sessions via ACP protocol
- Exposes tool calls, permissions, diffs

#### AcpClientHandler (New)
- Implements `acp.Client` interface
- Handles permission requests
- Processes diff notifications
- Updates TODO lists
- Relays events to frontend

---

## 3. Migration Strategy

### 3.1 Approach: Feature Flag Strategy

```typescript
// Environment variable controls which client to use
CLAUDE_INTEGRATION_MODE=acp  // 'cli' | 'acp'
```

**Benefits**:
- ✅ Zero downtime migration
- ✅ Easy rollback (flip env var)
- ✅ Gradual testing in production
- ✅ Side-by-side comparison

### 3.2 Migration Phases

```
Phase 1 (Week 1): Foundation
├─ Install dependencies
├─ Create ACP client skeleton
├─ Write unit tests (TDD)
└─ Basic protocol connectivity

Phase 2 (Week 2): Implementation
├─ Full ACP client implementation
├─ Streaming support
├─ Tool call handling
├─ Permission management
└─ Integration testing

Phase 3 (Week 3): Migration & Cleanup
├─ Feature flag integration
├─ E2E testing
├─ Production validation
├─ Documentation
└─ Legacy cleanup (optional)
```

---

## 4. Phase 1: Foundation (Week 1)

### 4.1 Day 1-2: Setup & Planning

#### Task 1.1: Install Dependencies
```bash
cd apps/server
pnpm add @zed-industries/claude-code-acp
pnpm add @zed-industries/agent-client-protocol

# Verify installation
pnpm list | grep agent-client-protocol
```

**Validation**:
- [ ] Packages installed
- [ ] TypeScript types available
- [ ] No dependency conflicts

#### Task 1.2: Create Feature Documentation
```bash
# Create use-case and test-case docs
.claude/features/013-acp-migration/
├── use-case.md           # What and why
├── test-case.md          # Testing scenarios
└── migration-plan.md     # This file
```

**Deliverable**: Complete TDD documentation

#### Task 1.3: Environment Configuration
```typescript
// apps/server/src/config/claude.ts
export interface ClaudeConfig {
  mode: 'cli' | 'acp';
  apiKey?: string;  // For ACP mode
  model?: string;
  timeout?: number;
}

export function loadClaudeConfig(): ClaudeConfig {
  return {
    mode: (process.env.CLAUDE_INTEGRATION_MODE as any) || 'cli',
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',
    timeout: parseInt(process.env.CLAUDE_TIMEOUT || '300000', 10)
  };
}
```

### 4.2 Day 3-4: ACP Client Skeleton (TDD)

#### Task 1.4: Write Test Cases First

```typescript
// apps/server/src/services/acp/claude-acp-client.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeAcpClient } from './claude-acp-client';

describe('ClaudeAcpClient', () => {
  let client: ClaudeAcpClient;

  beforeEach(() => {
    client = new ClaudeAcpClient({
      apiKey: 'test-key',
      model: 'claude-3-5-sonnet-20241022'
    });
  });

  afterEach(async () => {
    await client.close();
  });

  describe('initialization', () => {
    it('should initialize ACP connection', async () => {
      await client.initialize();
      expect(client.isConnected()).toBe(true);
    });

    it('should spawn claude-code-acp process', async () => {
      await client.initialize();
      expect(client.getProcess()).toBeDefined();
    });

    it('should perform ACP handshake', async () => {
      await client.initialize();
      expect(client.getProtocolVersion()).toBe('0.1.0');
    });
  });

  describe('session management', () => {
    it('should create new ACP session', async () => {
      await client.initialize();
      const session = await client.createSession({
        cwd: '/test/path',
        mcpServers: []
      });

      expect(session.sessionId).toBeDefined();
    });

    it('should reuse existing session', async () => {
      await client.initialize();
      const session1 = await client.createSession({ cwd: '/test' });
      const session2 = await client.getSession(session1.sessionId);

      expect(session2).toBeDefined();
      expect(session2.sessionId).toBe(session1.sessionId);
    });
  });

  describe('message sending', () => {
    it('should send prompt and receive response', async () => {
      await client.initialize();
      const session = await client.createSession({ cwd: '/test' });

      const result = await client.sendMessage(session.sessionId, 'Hello');

      expect(result.content).toBeDefined();
      expect(result.stopReason).toBeDefined();
    });

    it('should handle tool calls in response', async () => {
      await client.initialize();
      const session = await client.createSession({ cwd: '/test' });

      const result = await client.sendMessage(
        session.sessionId,
        'Create a file named test.txt'
      );

      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls.length).toBeGreaterThan(0);
      expect(result.toolCalls[0].name).toBe('write_file');
    });

    it('should stream message response', async () => {
      await client.initialize();
      const session = await client.createSession({ cwd: '/test' });

      const chunks: string[] = [];
      for await (const chunk of client.streamMessage(session.sessionId, 'Hello')) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.join('')).toContain('Hello');
    });
  });

  describe('error handling', () => {
    it('should throw error when not initialized', async () => {
      await expect(
        client.sendMessage('session-id', 'Hello')
      ).rejects.toThrow('Client not initialized');
    });

    it('should handle ACP process crash', async () => {
      await client.initialize();
      // Simulate process crash
      client.getProcess()?.kill();

      await expect(
        client.sendMessage('session-id', 'Hello')
      ).rejects.toThrow('ACP process not running');
    });

    it('should reconnect after connection loss', async () => {
      await client.initialize();
      const session = await client.createSession({ cwd: '/test' });

      // Simulate connection loss
      client.disconnect();

      // Should auto-reconnect
      const result = await client.sendMessage(session.sessionId, 'Hello');
      expect(result.content).toBeDefined();
    });
  });
});
```

**Status after this task**: Tests written, all FAILING (Red) ✅

#### Task 1.5: Implement ACP Client Skeleton

```typescript
// apps/server/src/services/acp/claude-acp-client.ts
import * as acp from '@zed-industries/agent-client-protocol';
import { spawn, ChildProcess } from 'node:child_process';
import { Writable, Readable } from 'node:stream';

export interface ClaudeAcpConfig {
  apiKey: string;
  model?: string;
  timeout?: number;
}

export interface AcpSession {
  sessionId: string;
  cwd: string;
}

export interface SendMessageResult {
  content: string;
  stopReason: string;
  toolCalls: Array<{
    id: string;
    name: string;
    input: any;
  }>;
}

export class ClaudeAcpClient {
  private connection: acp.ClientSideConnection | null = null;
  private process: ChildProcess | null = null;
  private config: ClaudeAcpConfig;
  private sessions = new Map<string, AcpSession>();

  constructor(config: ClaudeAcpConfig) {
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Spawn claude-code-acp process
    this.process = spawn('claude-code-acp', [], {
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: this.config.apiKey
      },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Setup error handling
    this.process.on('error', (error) => {
      throw new Error(`Failed to start ACP process: ${error.message}`);
    });

    // Convert Node streams to Web streams
    const input = Writable.toWeb(this.process.stdin!) as WritableStream;
    const output = Readable.toWeb(this.process.stdout!) as ReadableStream;

    // Create ACP connection
    this.connection = new acp.ClientSideConnection(
      (_agent) => new AcpClientHandler(),
      input,
      output
    );

    // Initialize protocol
    await this.connection.initialize({
      protocolVersion: acp.PROTOCOL_VERSION,
      clientCapabilities: {
        fs: { readTextFile: true, writeTextFile: true },
        terminal: { run: true },
        git: { status: true, commit: true }
      }
    });
  }

  async createSession(options: { cwd: string; mcpServers?: any[] }): Promise<AcpSession> {
    if (!this.connection) {
      throw new Error('Client not initialized');
    }

    const result = await this.connection.newSession({
      cwd: options.cwd,
      mcpServers: options.mcpServers || []
    });

    const session: AcpSession = {
      sessionId: result.sessionId,
      cwd: options.cwd
    };

    this.sessions.set(result.sessionId, session);
    return session;
  }

  async sendMessage(sessionId: string, prompt: string): Promise<SendMessageResult> {
    if (!this.connection) {
      throw new Error('Client not initialized');
    }

    if (!this.process || this.process.exitCode !== null) {
      throw new Error('ACP process not running');
    }

    const result = await this.connection.prompt({
      sessionId,
      prompt: [{ type: 'text', text: prompt }]
    });

    return {
      content: this.extractContent(result),
      stopReason: result.stopReason || 'unknown',
      toolCalls: this.extractToolCalls(result)
    };
  }

  async *streamMessage(sessionId: string, prompt: string): AsyncGenerator<string, SendMessageResult> {
    if (!this.connection) {
      throw new Error('Client not initialized');
    }

    // ACP uses notifications for streaming
    // Implementation will depend on ACP SDK streaming support
    // For now, implement as chunks

    let fullContent = '';
    const result = await this.sendMessage(sessionId, prompt);

    // Simulate streaming by chunking the response
    const words = result.content.split(' ');
    for (const word of words) {
      fullContent += word + ' ';
      yield word + ' ';
    }

    return result;
  }

  getSession(sessionId: string): AcpSession | undefined {
    return this.sessions.get(sessionId);
  }

  isConnected(): boolean {
    return this.connection !== null && this.process?.exitCode === null;
  }

  getProcess(): ChildProcess | null {
    return this.process;
  }

  getProtocolVersion(): string {
    // Would be set during initialization
    return acp.PROTOCOL_VERSION;
  }

  disconnect(): void {
    this.connection = null;
  }

  async close(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connection = null;
    this.sessions.clear();
  }

  private extractContent(result: any): string {
    if (!result.content) return '';

    return result.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text)
      .join('');
  }

  private extractToolCalls(result: any): Array<{ id: string; name: string; input: any }> {
    if (!result.content) return [];

    return result.content
      .filter((c: any) => c.type === 'tool_use')
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        input: c.input
      }));
  }
}
```

#### Task 1.6: Implement ACP Client Handler

```typescript
// apps/server/src/services/acp/client-handler.ts
import * as acp from '@zed-industries/agent-client-protocol';

/**
 * Implements the ACP Client interface
 * Handles notifications from the ACP agent
 */
export class AcpClientHandler implements acp.Client {
  private permissionCallbacks = new Map<string, (allowed: boolean) => void>();

  /**
   * Handle permission requests from agent
   */
  async requestPermission(request: acp.PermissionRequest): Promise<acp.PermissionResponse> {
    // For now, auto-approve all (can be made interactive later)
    console.log('[ACP] Permission requested:', request);

    return { allowed: true };
  }

  /**
   * Display diff to user
   */
  async showDiff(diff: acp.Diff): Promise<void> {
    console.log('[ACP] Diff:', diff);
    // TODO: Send to frontend for display
  }

  /**
   * Update TODO list
   */
  async updateTodo(todo: acp.TodoUpdate): Promise<void> {
    console.log('[ACP] TODO update:', todo);
    // TODO: Update UI with TODO items
  }

  /**
   * Display error message
   */
  async showError(error: acp.ErrorNotification): Promise<void> {
    console.error('[ACP] Error:', error);
    // TODO: Send to frontend
  }

  /**
   * Stream chunk received
   */
  async onStreamChunk(chunk: string): Promise<void> {
    // Used for streaming responses
    console.log('[ACP] Stream chunk:', chunk);
  }
}
```

### 4.3 Day 5: Integration Points

#### Task 1.7: Update ClaudeAgentService to Support Both Clients

```typescript
// apps/server/src/services/claude-agent-service.ts
import { ClaudeCodeClient } from './claude-code-client.js';
import { ClaudeAcpClient } from './acp/claude-acp-client.js';
import { loadClaudeConfig } from '../config/claude.js';

type ClaudeClient = ClaudeCodeClient | ClaudeAcpClient;

export class ClaudeAgentService {
  private client: ClaudeClient;
  private readonly mode: 'cli' | 'acp';

  constructor(
    private readonly databaseClient: DatabaseClient,
    config?: ClaudeAgentServiceConfig
  ) {
    const claudeConfig = loadClaudeConfig();
    this.mode = claudeConfig.mode;

    // Initialize appropriate client based on mode
    if (this.mode === 'acp') {
      console.log('[ClaudeAgentService] Using ACP client');
      this.client = new ClaudeAcpClient({
        apiKey: claudeConfig.apiKey!,
        model: config?.model || claudeConfig.model,
        timeout: config?.timeout || claudeConfig.timeout
      });

      // Initialize ACP client
      (this.client as ClaudeAcpClient).initialize().catch(error => {
        console.error('[ClaudeAgentService] Failed to initialize ACP client:', error);
        // Fallback to CLI mode
        this.mode = 'cli';
        this.client = new ClaudeCodeClient({
          model: config?.model,
          workingDirectory: config?.workingDirectory
        });
      });
    } else {
      console.log('[ClaudeAgentService] Using CLI client');
      this.client = new ClaudeCodeClient({
        model: config?.model,
        workingDirectory: config?.workingDirectory
      });
    }
  }

  // Rest of the implementation stays the same
  // The service layer doesn't need to know which client is being used
}
```

**Status at end of Phase 1**:
- ✅ Dependencies installed
- ✅ Tests written (TDD)
- ✅ Basic ACP client implementation
- ✅ Tests passing (Green)
- ⏳ Not yet integrated with routes

---

## 5. Phase 2: Implementation (Week 2)

### 5.1 Day 6-8: Full ACP Client Implementation

#### Task 2.1: Implement Real Streaming

```typescript
// Update ClaudeAcpClient.streamMessage()
async *streamMessage(
  sessionId: string,
  prompt: string
): AsyncGenerator<string, SendMessageResult> {
  if (!this.connection) {
    throw new Error('Client not initialized');
  }

  // Use ACP notification system for streaming
  let fullContent = '';
  const toolCalls: any[] = [];
  let stopReason = 'unknown';

  // Setup notification handler
  const notificationHandler = (notification: any) => {
    if (notification.type === 'stream_chunk') {
      fullContent += notification.content;
      return notification.content;
    }
    if (notification.type === 'tool_use') {
      toolCalls.push(notification);
    }
    return null;
  };

  // Send prompt (implementation depends on ACP SDK)
  // This is pseudo-code - actual implementation will vary
  const stream = await this.connection.promptStreaming({
    sessionId,
    prompt: [{ type: 'text', text: prompt }]
  });

  for await (const event of stream) {
    if (event.type === 'content_delta') {
      fullContent += event.delta;
      yield event.delta;
    }
    if (event.type === 'tool_use') {
      toolCalls.push({
        id: event.id,
        name: event.name,
        input: event.input
      });
    }
    if (event.type === 'stop') {
      stopReason = event.reason;
    }
  }

  return {
    content: fullContent,
    stopReason,
    toolCalls
  };
}
```

#### Task 2.2: Implement Permission Management

```typescript
// apps/server/src/services/acp/client-handler.ts
export class AcpClientHandler implements acp.Client {
  private permissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' = 'default';

  setPermissionMode(mode: typeof this.permissionMode) {
    this.permissionMode = mode;
  }

  async requestPermission(request: acp.PermissionRequest): Promise<acp.PermissionResponse> {
    // Handle based on permission mode
    switch (this.permissionMode) {
      case 'bypassPermissions':
        return { allowed: true };

      case 'acceptEdits':
        // Auto-approve file edits, ask for everything else
        if (request.tool === 'write_file' || request.tool === 'edit_file') {
          return { allowed: true };
        }
        break;

      case 'plan':
        // Deny all tool executions (analysis only)
        return { allowed: false };

      case 'default':
      default:
        // Ask user for permission
        // TODO: Implement permission UI
        break;
    }

    // For now, auto-approve (later: send to frontend for user decision)
    return { allowed: true };
  }
}
```

#### Task 2.3: Add Permission API Endpoints

```typescript
// apps/server/src/routes/sessions.ts

// GET /api/sessions/:id/permission-mode
fastify.get<{ Params: { id: string } }>(
  '/api/sessions/:id/permission-mode',
  async (request, reply) => {
    const { id } = request.params;

    // Get permission mode from session metadata
    const session = databaseClient.getSession(id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const metadata = session.metadata as any;
    const mode = metadata?.permissionMode || 'default';

    return reply.send({ permissionMode: mode });
  }
);

// PUT /api/sessions/:id/permission-mode
fastify.put<{
  Params: { id: string };
  Body: { permissionMode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions' };
}>(
  '/api/sessions/:id/permission-mode',
  async (request, reply) => {
    const { id } = request.params;
    const { permissionMode } = request.body;

    // Validate permission mode
    const validModes = ['default', 'acceptEdits', 'plan', 'bypassPermissions'];
    if (!validModes.includes(permissionMode)) {
      return reply.code(400).send({ error: 'Invalid permission mode' });
    }

    // Update session metadata
    const session = databaseClient.getSession(id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    const metadata = (session.metadata as any) || {};
    metadata.permissionMode = permissionMode;

    databaseClient.updateSession(id, { metadata });

    // Update ACP client handler
    if (claudeAgentService.getMode() === 'acp') {
      claudeAgentService.setPermissionMode(permissionMode);
    }

    return reply.send({ success: true, permissionMode });
  }
);
```

### 5.2 Day 9-10: Tool Call Display

#### Task 2.4: Update Message Routes to Return Tool Calls

```typescript
// apps/server/src/routes/messages.ts

// Messages now include tool_calls field
fastify.get<{ Params: { sessionId: string } }>(
  '/api/sessions/:sessionId/messages',
  async (request, reply) => {
    const { sessionId } = request.params;
    const messages = databaseClient.getMessagesBySession(sessionId);

    // Parse tool_calls JSON field
    const messagesWithToolCalls = messages.map(msg => ({
      ...msg,
      toolCalls: msg.tool_calls ? JSON.parse(msg.tool_calls) : null
    }));

    return reply.send({ messages: messagesWithToolCalls });
  }
);
```

#### Task 2.5: Update Frontend to Display Tool Calls

```typescript
// apps/desktop/src/components/ToolCallDisplay.tsx
interface ToolCall {
  id: string;
  name: string;
  input: any;
}

export function ToolCallDisplay({ toolCalls }: { toolCalls: ToolCall[] }) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="tool-calls-container">
      <h4>🛠️ Tool Calls</h4>
      {toolCalls.map((call) => (
        <div key={call.id} className="tool-call">
          <div className="tool-name">{call.name}</div>
          <pre className="tool-input">
            {JSON.stringify(call.input, null, 2)}
          </pre>
        </div>
      ))}
    </div>
  );
}
```

```typescript
// apps/desktop/src/components/MessageItem.tsx
import { ToolCallDisplay } from './ToolCallDisplay';

export function MessageItem({ message }: { message: Message }) {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        {message.content}
      </div>

      {message.toolCalls && (
        <ToolCallDisplay toolCalls={message.toolCalls} />
      )}

      <div className="message-timestamp">
        {formatTimestamp(message.createdAt)}
      </div>
    </div>
  );
}
```

**Status at end of Phase 2**:
- ✅ Full ACP client implementation
- ✅ Streaming support
- ✅ Tool call handling
- ✅ Permission management
- ✅ Frontend displays tool calls
- ✅ All tests passing

---

## 6. Phase 3: Migration & Cleanup (Week 3)

### 6.1 Day 11-12: Feature Flag & Testing

#### Task 3.1: Environment Variable Setup

```bash
# .env.example
# Claude Integration Mode
# Options: 'cli' (legacy subprocess) | 'acp' (Agent Client Protocol)
CLAUDE_INTEGRATION_MODE=acp

# Required for ACP mode
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional settings
CLAUDE_MODEL=claude-3-5-sonnet-20241022
CLAUDE_TIMEOUT=300000
```

#### Task 3.2: Add Mode Switching UI (Admin Panel)

```typescript
// apps/desktop/src/components/Settings/IntegrationSettings.tsx
export function IntegrationSettings() {
  const [mode, setMode] = useState<'cli' | 'acp'>('cli');

  const handleModeChange = async (newMode: 'cli' | 'acp') => {
    // This would restart the backend with new mode
    await fetch('/api/settings/integration-mode', {
      method: 'PUT',
      body: JSON.stringify({ mode: newMode })
    });
    setMode(newMode);
  };

  return (
    <div>
      <h3>Claude Integration Mode</h3>
      <select value={mode} onChange={(e) => handleModeChange(e.target.value as any)}>
        <option value="cli">CLI (Legacy)</option>
        <option value="acp">ACP (Recommended)</option>
      </select>

      {mode === 'acp' && (
        <div className="info">
          <p>✅ Tool calls visible</p>
          <p>✅ Permission management</p>
          <p>✅ Better performance</p>
        </div>
      )}
    </div>
  );
}
```

#### Task 3.3: Comprehensive Testing

```bash
# Test both modes
CLAUDE_INTEGRATION_MODE=cli pnpm test
CLAUDE_INTEGRATION_MODE=acp pnpm test

# E2E tests for both modes
CLAUDE_INTEGRATION_MODE=cli pnpm test:e2e
CLAUDE_INTEGRATION_MODE=acp pnpm test:e2e

# Manual testing checklist:
# [ ] Create session (both modes)
# [ ] Send message (both modes)
# [ ] Stream message (both modes)
# [ ] Tool calls display (ACP only)
# [ ] Permission dialogs (ACP only)
# [ ] Switch between modes
# [ ] Error handling (both modes)
```

### 6.2 Day 13-14: Documentation & Polish

#### Task 3.4: Update Documentation

```markdown
# apps/server/README.md

## Claude Integration Modes

### CLI Mode (Legacy)
- Uses `claude` CLI via subprocess
- Limited features (no tool calls)
- Compatible with older Claude CLI versions

### ACP Mode (Recommended)
- Uses Agent Client Protocol
- Full feature support
- Better performance
- Requires `claude-code-acp` package

### Switching Modes
Set environment variable:
\`\`\`bash
CLAUDE_INTEGRATION_MODE=acp  # or 'cli'
\`\`\`

Or use Settings UI in desktop app.
```

#### Task 3.5: Migration Guide for Users

```markdown
# MIGRATION.md

## Migrating from CLI to ACP

### Prerequisites
1. Update to latest version
2. Install claude-code-acp:
   \`\`\`bash
   npm install -g @zed-industries/claude-code-acp
   \`\`\`

### Migration Steps
1. Stop the app
2. Update `.env`:
   \`\`\`
   CLAUDE_INTEGRATION_MODE=acp
   ANTHROPIC_API_KEY=your-key-here
   \`\`\`
3. Restart the app
4. Existing sessions will continue to work

### Rollback
If you encounter issues:
1. Stop the app
2. Set `CLAUDE_INTEGRATION_MODE=cli`
3. Restart

### New Features After Migration
- 🎉 See what Claude is doing (tool calls)
- 🎉 Control permissions (4 modes)
- 🎉 View file diffs before applying
- 🎉 Better error messages
```

### 6.3 Day 15: Production Validation & Optional Cleanup

#### Task 3.6: Production Validation Checklist

- [ ] All 257+ tests passing in both modes
- [ ] E2E tests cover both modes
- [ ] Manual testing completed
- [ ] Performance benchmarks meet targets
- [ ] Error handling verified
- [ ] Documentation complete
- [ ] Migration guide tested
- [ ] Rollback procedure verified

#### Task 3.7: Optional Legacy Cleanup

**Decision Point**: Keep or remove CLI client?

**Option A: Keep Both (Recommended for MVP)**
- Pros: Easy rollback, supports old Claude CLI versions
- Cons: More code to maintain

**Option B: Remove CLI Client (Future)**
- Pros: Cleaner codebase
- Cons: Breaking change for some users
- Timeline: After 3-6 months of ACP stability

**Recommendation**: Keep both for now, deprecate CLI mode in 6 months

---

## 7. Testing Strategy

### 7.1 Unit Tests

```typescript
// Test files to create/update:
apps/server/src/services/acp/
├── claude-acp-client.test.ts        # 50+ tests
├── client-handler.test.ts           # 20+ tests
└── utils.test.ts                    # 10+ tests

apps/server/src/services/
└── claude-agent-service.test.ts     # Update: +30 tests for ACP mode
```

**Coverage Target**: 90%+ (higher than MVP because migration is critical)

### 7.2 Integration Tests

```typescript
// apps/server/src/routes/__tests__/
describe('ACP Integration', () => {
  it('should send message via ACP and save tool calls', async () => {
    // Setup ACP mode
    process.env.CLAUDE_INTEGRATION_MODE = 'acp';

    // Create session
    const session = await createSession({ title: 'Test' });

    // Send message that triggers tool
    const response = await sendMessage(session.id, 'Create file test.txt');

    // Verify tool call saved
    const messages = await getMessages(session.id);
    const assistantMsg = messages.find(m => m.role === 'assistant');

    expect(assistantMsg.toolCalls).toHaveLength(1);
    expect(assistantMsg.toolCalls[0].name).toBe('write_file');
  });
});
```

### 7.3 E2E Tests

```typescript
// apps/desktop/e2e/acp-features.spec.ts
import { test, expect } from '@playwright/test';

test('should display tool calls in ACP mode', async ({ page }) => {
  // Enable ACP mode
  await page.goto('http://localhost:3000');
  await page.click('[data-testid="settings"]');
  await page.selectOption('[data-testid="integration-mode"]', 'acp');

  // Create session and send message
  await page.click('[data-testid="new-session"]');
  await page.fill('[data-testid="session-title"]', 'Test Session');
  await page.click('[data-testid="create-session"]');

  await page.fill('[data-testid="message-input"]', 'Create a file');
  await page.click('[data-testid="send-message"]');

  // Wait for response with tool calls
  await expect(page.locator('.tool-call')).toBeVisible();
  await expect(page.locator('.tool-name')).toContainText('write_file');
});
```

### 7.4 Performance Tests

```typescript
// apps/server/src/__benchmarks__/acp-vs-cli.bench.ts
import { bench, describe } from 'vitest';

describe('ACP vs CLI Performance', () => {
  bench('CLI: First message latency', async () => {
    // Measure CLI spawn + first message
  });

  bench('ACP: First message latency', async () => {
    // Measure ACP connection + first message
  });

  bench('CLI: Subsequent message', async () => {
    // CLI with session reuse
  });

  bench('ACP: Subsequent message', async () => {
    // ACP with existing connection
  });
});
```

**Expected Results**:
- ACP first message: ~500-800ms (vs CLI ~1-2s)
- ACP subsequent: ~200-400ms (vs CLI ~800-1200ms)

---

## 8. Risk Mitigation

### 8.1 Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ACP SDK breaking changes | Medium | High | Pin to specific version, test upgrades thoroughly |
| claude-code-acp not installed | High | Critical | Check on startup, show clear error + installation instructions |
| Performance regression | Low | Medium | Benchmark before/after, keep CLI as fallback |
| Tool call parsing errors | Medium | Medium | Extensive error handling, fallback to raw response |
| Session migration issues | Low | High | Sessions are independent, no data migration needed |
| Permission UI complexity | Medium | Low | Start with auto-approve, add UI later |

### 8.2 Mitigation Strategies

#### Risk 1: claude-code-acp Not Installed
```typescript
// Startup check
try {
  const result = execSync('which claude-code-acp');
  if (!result) throw new Error('Not found');
} catch (error) {
  console.error(`
    ❌ claude-code-acp not found!

    To use ACP mode, install it:
      npm install -g @zed-industries/claude-code-acp

    Or use CLI mode:
      CLAUDE_INTEGRATION_MODE=cli pnpm dev
  `);
  process.exit(1);
}
```

#### Risk 2: Version Compatibility
```json
// package.json - Pin exact versions
{
  "dependencies": {
    "@zed-industries/claude-code-acp": "0.1.5",
    "@zed-industries/agent-client-protocol": "0.5.1"
  }
}
```

#### Risk 3: Graceful Degradation
```typescript
// Fallback to CLI if ACP fails
async initialize() {
  try {
    await this.initializeAcp();
  } catch (error) {
    console.warn('[ClaudeAgent] ACP init failed, falling back to CLI:', error);
    this.mode = 'cli';
    await this.initializeCli();
  }
}
```

---

## 9. Rollback Procedures

### 9.1 Quick Rollback (Emergency)

```bash
# 1. Stop the application
# 2. Revert environment variable
CLAUDE_INTEGRATION_MODE=cli

# 3. Restart
pnpm dev
```

**Impact**: Immediate, zero downtime (just restart)

### 9.2 Code Rollback

```bash
# Revert to previous commit
git revert <migration-commit>

# Or rollback to before migration
git reset --hard <pre-migration-commit>

# Reinstall dependencies
pnpm install

# Restart
pnpm dev
```

**Impact**: Requires code deployment

### 9.3 Data Rollback

**Good News**: No database migration needed!

- Messages table already has `tool_calls` column
- If ACP writes tool calls, CLI just ignores them
- No data corruption risk

### 9.4 Rollback Testing

```bash
# Test rollback procedure
# 1. Start in ACP mode
CLAUDE_INTEGRATION_MODE=acp pnpm dev

# 2. Create session, send messages
# 3. Stop app
# 4. Switch to CLI mode
CLAUDE_INTEGRATION_MODE=cli pnpm dev

# 5. Verify:
#    - Existing sessions load
#    - Messages display correctly
#    - Can send new messages
#    - No errors in logs
```

---

## 10. Success Criteria

### 10.1 Functional Requirements

- [ ] ACP client can initialize and connect
- [ ] Can create sessions via ACP protocol
- [ ] Can send messages and receive responses
- [ ] Streaming responses work correctly
- [ ] Tool calls are captured and displayed
- [ ] Permission management works (at least auto-approve)
- [ ] Error handling is comprehensive
- [ ] Feature flag switching works
- [ ] Both modes can coexist

### 10.2 Quality Requirements

- [ ] All existing tests still pass (257+)
- [ ] New ACP tests pass (100+ new tests)
- [ ] Code coverage ≥ 90% for ACP code
- [ ] E2E tests cover both modes
- [ ] No memory leaks (process monitoring)
- [ ] Performance meets targets:
  - First message: <1s (ACP) vs ~2s (CLI)
  - Subsequent: <500ms (ACP) vs ~1s (CLI)

### 10.3 Documentation Requirements

- [ ] Use case document complete
- [ ] Test case document complete
- [ ] Migration guide written
- [ ] API documentation updated
- [ ] README updated with ACP info
- [ ] Code comments comprehensive

### 10.4 Production Readiness

- [ ] Deployed to staging
- [ ] Manual testing completed
- [ ] Performance benchmarks collected
- [ ] Rollback tested successfully
- [ ] Team trained on new system
- [ ] User migration guide published

---

## 11. Timeline & Milestones

### Week 1: Foundation
- **Day 1-2**: Setup, dependencies, documentation
- **Day 3-4**: TDD - write tests, skeleton implementation
- **Day 5**: Integration points, feature flag setup
- **Milestone**: ACP client connects, basic tests pass

### Week 2: Implementation
- **Day 6-8**: Full ACP client, streaming, tool calls
- **Day 9-10**: Permission management, frontend display
- **Milestone**: Feature complete, all tests passing

### Week 3: Migration & Polish
- **Day 11-12**: Feature flag, testing both modes
- **Day 13-14**: Documentation, migration guide
- **Day 15**: Production validation, optional cleanup
- **Milestone**: Ready for production deployment

### Contingency Buffer: +3-5 days
- Unexpected issues
- Additional testing
- Documentation refinement

**Total Estimated Time**: 15-20 days (3-4 weeks)

---

## 12. Post-Migration Tasks

### Immediate (Week 4)
- [ ] Monitor error logs for ACP issues
- [ ] Collect user feedback
- [ ] Performance monitoring
- [ ] Bug fixes as needed

### Short-term (Month 2)
- [ ] Add permission request UI
- [ ] Implement diff display
- [ ] Add MCP server configuration
- [ ] Improve tool call visualization

### Long-term (Month 3-6)
- [ ] Consider deprecating CLI mode
- [ ] Add advanced ACP features
- [ ] Performance optimizations
- [ ] User preference for permission modes

---

## Conclusion

This migration plan provides a comprehensive, phased approach to moving from headless Claude CLI to ACP integration. The feature flag strategy ensures zero downtime and easy rollback, while the TDD approach ensures quality throughout the migration.

**Key Success Factors**:
1. ✅ Comprehensive testing (unit, integration, E2E)
2. ✅ Feature flag for gradual rollout
3. ✅ Clear rollback procedures
4. ✅ Detailed documentation
5. ✅ Performance monitoring

**Ready to start Phase 1!** 🚀
