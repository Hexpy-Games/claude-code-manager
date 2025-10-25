/**
 * WebSocket Stream Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import simpleGit from 'simple-git';
import WebSocket from 'ws';

// Helper to wait for WebSocket to open
function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });
}

// Helper to wait for specific message type
// Sets up handler BEFORE opening to avoid race conditions
function waitForMessage(ws: WebSocket, type: string, timeout = 8000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.off('message', handler);
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);

    const handler = (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString('utf-8'));
        if (message.type === type) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(message);
        }
      } catch (error) {
        // Ignore parse errors, wait for next message
      }
    };

    // Attach handler immediately to avoid race condition
    ws.on('message', handler);
  });
}

// Helper to wait for WebSocket open AND first 'connected' message
// This combines both operations to prevent race conditions
async function waitForConnection(ws: WebSocket): Promise<any> {
  // Set up message handler FIRST, before connection completes
  const connectedPromise = waitForMessage(ws, 'connected');

  // Then wait for connection to open
  await waitForOpen(ws);

  // Finally wait for the connected message
  return connectedPromise;
}

// Helper to collect all messages until 'done'
function collectMessages(ws: WebSocket, timeout = 8000): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const messages: any[] = [];
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for done message'));
    }, timeout);

    const handler = (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString('utf-8'));
        messages.push(message);
        if (message.type === 'done' || message.type === 'error') {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(messages);
        }
      } catch (error) {
        clearTimeout(timer);
        ws.off('message', handler);
        reject(error);
      }
    };

    ws.on('message', handler);
  });
}

// Skip WebSocket tests temporarily - implementation is complete but needs integration testing
describe('WebSocket Stream Routes', () => {
  let server: FastifyInstance;
  let testDbPath: string;
  let testRepoPath: string;
  let sessionId: string;
  let serverAddress: string;

  beforeEach(async () => {
    // Create temp database
    testDbPath = path.join(os.tmpdir(), `test-db-${Date.now()}.sqlite`);

    // Create temp Git repository
    testRepoPath = path.join(os.tmpdir(), `test-repo-${Date.now()}`);
    fs.mkdirSync(testRepoPath, { recursive: true });

    const git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');

    // Create initial commit
    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repo');
    await git.add('.');
    await git.commit('Initial commit');

    // Create server
    server = await createServer({
      databasePath: testDbPath,
      claudeApiKey: 'test-api-key',
      logLevel: 'silent',
    });

    // Start server
    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    const port = typeof address === 'object' && address !== null ? address.port : 3000;
    serverAddress = `ws://127.0.0.1:${port}`;

    // Create a test session
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        title: 'Test Session',
        rootDirectory: testRepoPath,
      },
    });

    sessionId = JSON.parse(createResponse.body).data.session.id;
  });

  afterEach(async () => {
    vi.restoreAllMocks();

    // Clean up all test sessions from database before closing server
    if (server?.db) {
      try {
        // Get all sessions
        const allSessions = server.db.getSessions();
        console.log(`[Cleanup] Removing ${allSessions.length} test session(s)`);

        // Delete all sessions (this should cascade delete messages)
        for (const session of allSessions) {
          server.db.deleteSession(session.id);
        }

        console.log('[Cleanup] All test sessions removed from database');
      } catch (error) {
        console.error('[Cleanup] Error cleaning up sessions:', error);
      }
    }

    // Close server
    if (server) {
      await server.close();
      console.log('[Cleanup] Server closed');
    }

    // Remove test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('[Cleanup] Test database deleted:', testDbPath);
    }

    // Remove test git repository
    if (fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
      console.log('[Cleanup] Test repository deleted:', testRepoPath);
    }

    console.log('[Cleanup] ✅ All test data cleaned up\n');
  });

  describe('Connection Lifecycle', () => {
    it('should establish WebSocket connection and receive connected message', async () => {
      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      const connectedMsg = await waitForConnection(ws);

      expect(connectedMsg.type).toBe('connected');
      expect(connectedMsg.sessionId).toBe(sessionId);

      ws.close();
    });

    it('should reject connection for invalid session ID', async () => {
      const ws = new WebSocket(`${serverAddress}/api/sessions/invalid_id/stream`);

      await new Promise<void>((resolve) => {
        ws.on('close', (code, reason) => {
          // Accept either 4404 or 1006 (abnormal closure due to immediate close)
          expect(code).toBeGreaterThanOrEqual(1006);
          resolve();
        });
      });
    });

    it('should handle connection close gracefully', async () => {
      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      const closePromise = new Promise<void>((resolve) => {
        ws.on('close', () => resolve());
      });

      ws.close();
      await closePromise;
    });

    it('should handle multiple concurrent connections to different sessions', async () => {
      // Create second session
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session 2',
          rootDirectory: testRepoPath,
        },
      });
      const sessionId2 = JSON.parse(createResponse.body).data.session.id;

      // Connect to both sessions
      const ws1 = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      const ws2 = new WebSocket(`${serverAddress}/api/sessions/${sessionId2}/stream`);

      const [msg1, msg2] = await Promise.all([
        waitForConnection(ws1),
        waitForConnection(ws2),
      ]);

      expect(msg1.sessionId).toBe(sessionId);
      expect(msg2.sessionId).toBe(sessionId2);

      ws1.close();
      ws2.close();
    });
  });

  describe('Message Handling', () => {
    it('should accept valid message and stream response', async () => {
      // Mock streamMessage to return test chunks
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent, 'streamMessage')
        .mockImplementation(async function* (sessId, content) {
          yield 'Hello, ';
          yield 'how can ';
          yield 'I help you?';

          // Return a mock message
          return {
            id: `msg_test_${Date.now()}`,
            sessionId: sessId,
            role: 'assistant' as const,
            content: 'Hello, how can I help you?',
            toolCalls: null,
            createdAt: new Date(),
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      // Send message
      ws.send(JSON.stringify({ type: 'message', content: 'Hello' }));

      // Collect all messages
      const messages = await collectMessages(ws);

      // Verify content chunks
      const chunks = messages.filter((m) => m.type === 'content_chunk');
      expect(chunks).toHaveLength(3);
      expect(chunks[0].content).toBe('Hello, ');
      expect(chunks[0].index).toBe(0);
      expect(chunks[1].content).toBe('how can ');
      expect(chunks[1].index).toBe(1);
      expect(chunks[2].content).toBe('I help you?');
      expect(chunks[2].index).toBe(2);

      // Verify done message
      const doneMsg = messages.find((m) => m.type === 'done');
      expect(doneMsg).toBeDefined();
      expect(doneMsg?.stopReason).toBe('end_turn');

      ws.close();
      mockStreamMessage.mockRestore();
    });

    it('should reject message with missing content', async () => {
      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'message' }));

      const errorMsg = await waitForMessage(ws, 'error');
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.error).toBe('InvalidMessage');
      expect(errorMsg.message).toContain('content is required');

      ws.close();
    });

    it('should reject message with empty content', async () => {
      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'message', content: '' }));

      const errorMsg = await waitForMessage(ws, 'error');
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.error).toBe('InvalidMessage');

      ws.close();
    });

    it('should reject message with invalid type', async () => {
      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'invalid', content: 'test' }));

      const errorMsg = await waitForMessage(ws, 'error');
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.error).toBe('InvalidMessageType');

      ws.close();
    });

    it('should reject malformed JSON', async () => {
      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send('{invalid json}');

      const errorMsg = await waitForMessage(ws, 'error');
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.error).toBe('InvalidJSON');

      ws.close();
    });

    it('should handle ping/pong messages', async () => {
      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'ping' }));

      const pongMsg = await waitForMessage(ws, 'pong');
      expect(pongMsg.type).toBe('pong');

      ws.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle ClaudeAgentService errors', async () => {
      // Mock streamMessage to throw error
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent, 'streamMessage')
        .mockImplementation(async function* () {
          throw new Error('API Error');
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'message', content: 'test' }));

      const errorMsg = await waitForMessage(ws, 'error');
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.error).toBeDefined();

      ws.close();
      mockStreamMessage.mockRestore();
    });

    it('should handle streaming interruption on close', async () => {
      // Mock streamMessage with long delay
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent, 'streamMessage')
        .mockImplementation(async function* () {
          yield 'First chunk';
          await new Promise((resolve) => setTimeout(resolve, 100));
          yield 'Second chunk';
          await new Promise((resolve) => setTimeout(resolve, 100));
          yield 'Third chunk';

          return {
            id: `msg_test_${Date.now()}`,
            sessionId,
            role: 'assistant' as const,
            content: 'Complete',
            toolCalls: null,
            createdAt: new Date(),
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'message', content: 'test' }));

      // Wait for first chunk
      await waitForMessage(ws, 'content_chunk');

      // Close connection immediately
      ws.close();

      // Give server time to clean up
      await new Promise((resolve) => setTimeout(resolve, 50));

      mockStreamMessage.mockRestore();
    });
  });

  describe('Streaming Features', () => {
    it('should stream multiple content chunks with correct indexes', async () => {
      const chunks = Array.from({ length: 10 }, (_, i) => `Chunk ${i} `);

      const mockStreamMessage = vi
        .spyOn(server.claudeAgent, 'streamMessage')
        .mockImplementation(async function* (sessId) {
          for (const chunk of chunks) {
            yield chunk;
          }

          return {
            id: `msg_test_${Date.now()}`,
            sessionId: sessId,
            role: 'assistant' as const,
            content: chunks.join(''),
            toolCalls: null,
            createdAt: new Date(),
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'message', content: 'test' }));

      const messages = await collectMessages(ws);
      const contentChunks = messages.filter((m) => m.type === 'content_chunk');

      expect(contentChunks).toHaveLength(10);
      contentChunks.forEach((chunk, i) => {
        expect(chunk.index).toBe(i);
        expect(chunk.content).toBe(`Chunk ${i} `);
      });

      ws.close();
      mockStreamMessage.mockRestore();
    });

    it('should handle empty stream (no content)', async () => {
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent, 'streamMessage')
        .mockImplementation(async function* (sessId) {
          // Return immediately without yielding
          return {
            id: `msg_test_${Date.now()}`,
            sessionId: sessId,
            role: 'assistant' as const,
            content: '',
            toolCalls: null,
            createdAt: new Date(),
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'message', content: 'test' }));

      const messages = await collectMessages(ws);
      const contentChunks = messages.filter((m) => m.type === 'content_chunk');
      const doneMsg = messages.find((m) => m.type === 'done');

      expect(contentChunks).toHaveLength(0);
      expect(doneMsg).toBeDefined();

      ws.close();
      mockStreamMessage.mockRestore();
    });

    it('should persist message to database after streaming', async () => {
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent, 'streamMessage')
        .mockImplementation(async function* (sessId, content) {
          // Save user message
          server.db.insertMessage({
            id: `msg_user_${Date.now()}`,
            sessionId: sessId,
            role: 'user',
            content,
          });

          yield 'Response';

          // Save assistant message
          return server.db.insertMessage({
            id: `msg_asst_${Date.now()}`,
            sessionId: sessId,
            role: 'assistant',
            content: 'Response',
            toolCalls: null,
          });
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'message', content: 'Hello' }));
      await collectMessages(ws);

      // Verify messages saved
      const messages = server.db.getMessages(sessionId);
      expect(messages.length).toBeGreaterThanOrEqual(2);

      ws.close();
      mockStreamMessage.mockRestore();
    });
  });

  describe('Stop/Interrupt Functionality', () => {
    it('should save partial content when client disconnects during streaming (ESC/Stop button)', async () => {
      // Mock the Claude Code CLI client (not the service) so service logic runs normally
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent['client'], 'streamMessage')
        .mockImplementation(async function* () {
          yield 'First chunk, ';
          await new Promise((resolve) => setTimeout(resolve, 50));
          yield 'second chunk, ';
          await new Promise((resolve) => setTimeout(resolve, 50));
          yield 'third chunk, ';
          await new Promise((resolve) => setTimeout(resolve, 50));
          yield 'fourth chunk';

          // Return value for the generator
          return {
            content: 'First chunk, second chunk, third chunk, fourth chunk',
            sessionId: 'claude_session_123',
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      // Send message
      ws.send(JSON.stringify({ type: 'message', content: 'Test message' }));

      // Wait for first two chunks
      await waitForMessage(ws, 'content_chunk');
      await waitForMessage(ws, 'content_chunk');

      // Simulate user pressing Stop/ESC by closing WebSocket
      ws.close();

      // Wait for server to process the interruption and save partial content
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Verify partial message was saved to database
      const messages = server.db.getMessages(sessionId);

      // Should have user message + partial assistant message
      expect(messages.length).toBeGreaterThanOrEqual(2);

      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();
      expect(userMessage?.content).toBe('Test message');

      const assistantMessage = messages.find((m) => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();

      // Partial content should be saved (not all 4 chunks)
      expect(assistantMessage?.content).toContain('First chunk');
      expect(assistantMessage?.content).toContain('second chunk');

      // Content should be partial, not complete
      const content = assistantMessage?.content || '';
      const chunkCount = (content.match(/chunk/g) || []).length;
      expect(chunkCount).toBeLessThan(4); // Not all chunks received
      expect(chunkCount).toBeGreaterThan(0); // But some chunks saved

      mockStreamMessage.mockRestore();
    });

    it('should not send done event when stream is interrupted', async () => {
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent['client'], 'streamMessage')
        .mockImplementation(async function* () {
          yield 'Chunk 1 ';
          await new Promise((resolve) => setTimeout(resolve, 50));
          yield 'Chunk 2 ';
          await new Promise((resolve) => setTimeout(resolve, 50));
          yield 'Chunk 3';

          return {
            content: 'Chunk 1 Chunk 2 Chunk 3',
            sessionId: 'claude_session_123',
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      const receivedMessages: any[] = [];
      ws.on('message', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString('utf-8'));
          receivedMessages.push(message);
        } catch (e) {
          // Ignore parse errors
        }
      });

      ws.send(JSON.stringify({ type: 'message', content: 'Test' }));

      // Wait for first chunk
      await waitForMessage(ws, 'content_chunk');

      // Close connection (interrupt)
      ws.close();

      // Wait a bit for any pending messages
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Verify no 'done' message was received
      const doneMessage = receivedMessages.find((m) => m.type === 'done');
      expect(doneMessage).toBeUndefined();

      // But we should have received at least one content_chunk
      const chunks = receivedMessages.filter((m) => m.type === 'content_chunk');
      expect(chunks.length).toBeGreaterThan(0);

      mockStreamMessage.mockRestore();
    });

    it('should preserve partial content after interruption and allow new messages', async () => {
      // First message - interrupted
      const mockStreamMessage1 = vi
        .spyOn(server.claudeAgent['client'], 'streamMessage')
        .mockImplementationOnce(async function* () {
          yield 'Partial ';
          await new Promise((resolve) => setTimeout(resolve, 50));
          yield 'response';

          return {
            content: 'Partial response',
            sessionId: 'claude_session_123',
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      // Send first message
      ws.send(JSON.stringify({ type: 'message', content: 'First message' }));

      // Wait for first chunk
      await waitForMessage(ws, 'content_chunk');

      // Interrupt by closing
      ws.close();

      // Wait for partial content to be saved
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Verify first partial message was saved
      let messages = server.db.getMessages(sessionId);
      expect(messages.length).toBeGreaterThanOrEqual(2);

      // Now send a second message with a new connection
      const mockStreamMessage2 = vi
        .spyOn(server.claudeAgent['client'], 'streamMessage')
        .mockImplementationOnce(async function* () {
          yield 'Complete response';

          return {
            content: 'Complete response',
            sessionId: 'claude_session_123',
          };
        });

      const ws2 = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws2);

      ws2.send(JSON.stringify({ type: 'message', content: 'Second message' }));
      const messages2 = await collectMessages(ws2);

      // Verify second message completed normally
      const doneMsg = messages2.find((m) => m.type === 'done');
      expect(doneMsg).toBeDefined();

      ws2.close();

      // Verify both messages are in database
      messages = server.db.getMessages(sessionId);
      expect(messages.length).toBeGreaterThanOrEqual(4); // 2 user + 2 assistant

      // Verify first partial message is still there
      const firstAssistant = messages.find(
        (m) => m.role === 'assistant' && m.content.includes('Partial')
      );
      expect(firstAssistant).toBeDefined();

      // Verify second complete message is there
      const secondAssistant = messages.filter((m) => m.role === 'assistant')[1];
      expect(secondAssistant).toBeDefined();
      expect(secondAssistant?.content).toBe('Complete response');

      mockStreamMessage1.mockRestore();
      mockStreamMessage2.mockRestore();
    });

    it('should handle immediate disconnect before any chunks are sent', async () => {
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent['client'], 'streamMessage')
        .mockImplementation(async function* () {
          // Add delay before first chunk
          await new Promise((resolve) => setTimeout(resolve, 100));
          yield 'First chunk';

          return {
            content: 'First chunk',
            sessionId: 'claude_session_123',
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'message', content: 'Test' }));

      // Close immediately without waiting for any chunks
      await new Promise((resolve) => setTimeout(resolve, 20));
      ws.close();

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // User message should be saved, but assistant message might be empty or not exist
      const messages = server.db.getMessages(sessionId);
      const userMessage = messages.find((m) => m.role === 'user');
      expect(userMessage).toBeDefined();

      mockStreamMessage.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle Unicode and special characters', async () => {
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent, 'streamMessage')
        .mockImplementation(async function* (sessId) {
          yield '你好 👋 ';
          yield 'émojis and ';
          yield 'special chars!';

          return {
            id: `msg_test_${Date.now()}`,
            sessionId: sessId,
            role: 'assistant' as const,
            content: '你好 👋 émojis and special chars!',
            toolCalls: null,
            createdAt: new Date(),
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      ws.send(JSON.stringify({ type: 'message', content: '你好 世界' }));

      const messages = await collectMessages(ws);
      const chunks = messages.filter((m) => m.type === 'content_chunk');

      expect(chunks[0].content).toBe('你好 👋 ');
      expect(chunks[1].content).toBe('émojis and ');
      expect(chunks[2].content).toBe('special chars!');

      ws.close();
      mockStreamMessage.mockRestore();
    });

    it('should handle rapid sequential messages', async () => {
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent, 'streamMessage')
        .mockImplementation(async function* (sessId) {
          yield 'Response';

          return {
            id: `msg_test_${Date.now()}`,
            sessionId: sessId,
            role: 'assistant' as const,
            content: 'Response',
            toolCalls: null,
            createdAt: new Date(),
          };
        });

      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      // Send first message
      ws.send(JSON.stringify({ type: 'message', content: 'First' }));
      await collectMessages(ws);

      // Send second message
      ws.send(JSON.stringify({ type: 'message', content: 'Second' }));
      await collectMessages(ws);

      // Both should complete successfully
      expect(mockStreamMessage).toHaveBeenCalledTimes(2);

      ws.close();
      mockStreamMessage.mockRestore();
    });

    it('should maintain connection after error', async () => {
      const ws = new WebSocket(`${serverAddress}/api/sessions/${sessionId}/stream`);
      await waitForConnection(ws);

      // Send invalid message
      ws.send(JSON.stringify({ type: 'message', content: '' }));
      await waitForMessage(ws, 'error');

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN);

      // Should be able to send valid message
      const mockStreamMessage = vi
        .spyOn(server.claudeAgent, 'streamMessage')
        .mockImplementation(async function* (sessId) {
          yield 'Success';

          return {
            id: `msg_test_${Date.now()}`,
            sessionId: sessId,
            role: 'assistant' as const,
            content: 'Success',
            toolCalls: null,
            createdAt: new Date(),
          };
        });

      ws.send(JSON.stringify({ type: 'message', content: 'Valid message' }));
      const messages = await collectMessages(ws);
      const chunks = messages.filter((m) => m.type === 'content_chunk');

      expect(chunks.length).toBeGreaterThan(0);

      ws.close();
      mockStreamMessage.mockRestore();
    });
  });
});
