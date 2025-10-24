/**
 * Messages Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import simpleGit from 'simple-git';

describe('Messages Routes', () => {
  let server: FastifyInstance;
  let testDbPath: string;
  let testRepoPath: string;
  let sessionId: string;
  let mockSendMessage: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    // Create temp database with unique name (timestamp + random)
    testDbPath = path.join(os.tmpdir(), `test-db-${Date.now()}-${Math.random().toString(36).substring(7)}.sqlite`);

    // Create temp Git repository with unique name
    testRepoPath = path.join(os.tmpdir(), `test-repo-${Date.now()}-${Math.random().toString(36).substring(7)}`);

    // Ensure clean state - remove if exists
    if (fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    }

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

    // Mock ClaudeAgentService.sendMessage to actually save messages
    mockSendMessage = vi
      .spyOn(server.claudeAgent, 'sendMessage')
      .mockImplementation(async (sessId, content) => {
        const timestamp = Date.now();
        const userMessage = server.db.insertMessage({
          id: `msg_test_user_${timestamp}_${Math.random().toString(36).substring(7)}`,
          sessionId: sessId,
          role: 'user',
          content,
        });

        const assistantMessage = server.db.insertMessage({
          id: `msg_test_asst_${timestamp}_${Math.random().toString(36).substring(7)}`,
          sessionId: sessId,
          role: 'assistant',
          content: 'Hello! How can I help you today?',
        });

        return {
          userMessage,
          assistantMessage,
        };
      });

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
    if (server) {
      await server.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  describe('GET /api/sessions/:id/messages', () => {
    it('should return empty array when no messages exist', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/messages`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.messages).toEqual([]);
    });

    it('should return all messages for session', async () => {
      // Send a message (which creates user + assistant messages)
      await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: {
          content: 'Hello, Claude!',
        },
      });

      // Get messages
      const response = await server.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/messages`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.messages).toHaveLength(2);
      expect(body.data.messages[0].role).toBe('user');
      expect(body.data.messages[1].role).toBe('assistant');
    });

    it('should return messages in chronological order', async () => {
      // Send multiple messages
      await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: { content: 'Message 1' },
      });

      await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: { content: 'Message 2' },
      });

      // Get messages
      const response = await server.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/messages`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.messages).toHaveLength(4); // 2 user + 2 assistant
      // Should be in order: user1, assistant1, user2, assistant2
      expect(body.data.messages[0].content).toBe('Message 1');
      expect(body.data.messages[2].content).toBe('Message 2');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions/sess_nonexistent1/messages',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('SessionNotFoundError');
    });

    it('should return 400 for invalid session ID format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions/invalid-id/messages',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('POST /api/sessions/:id/messages', () => {
    it('should send message and get response', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: {
          content: 'Hello, Claude!',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.userMessage).toBeDefined();
      expect(body.data.assistantMessage).toBeDefined();
      expect(body.data.userMessage.content).toBe('Hello, Claude!');
      expect(body.data.userMessage.role).toBe('user');
      expect(body.data.assistantMessage.role).toBe('assistant');
    });

    it('should reject empty message content', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: {
          content: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
    });

    it('should reject missing content field', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
    });

    it('should return 404 for non-existent session', async () => {
      // Mock to throw SessionNotFoundError
      vi.spyOn(server.claudeAgent, 'sendMessage').mockRejectedValue({
        name: 'SessionNotFoundError',
        message: 'Session not found: sess_nonexistent1',
      });

      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions/sess_nonexistent1/messages',
        payload: {
          content: 'Hello',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should handle Claude API errors', async () => {
      // Mock to throw ClaudeAPIError
      vi.spyOn(server.claudeAgent, 'sendMessage').mockRejectedValue({
        name: 'ClaudeAPIError',
        message: 'API error occurred',
        statusCode: 500,
      });

      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: {
          content: 'Hello',
        },
      });

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ClaudeAPIError');
    });

    it('should handle rate limit errors', async () => {
      // Mock to throw RateLimitError
      const rateLimitError = {
        name: 'RateLimitError',
        message: 'Rate limit exceeded',
        retryAfter: 60,
      };
      vi.spyOn(server.claudeAgent, 'sendMessage').mockRejectedValue(rateLimitError);

      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: {
          content: 'Hello',
        },
      });

      expect(response.statusCode).toBe(429);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('RateLimitError');
      expect(response.headers['retry-after']).toBe('60');
    });

    it('should handle network errors', async () => {
      // Mock to throw NetworkError
      vi.spyOn(server.claudeAgent, 'sendMessage').mockRejectedValue({
        name: 'NetworkError',
        message: 'Network error occurred',
      });

      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: {
          content: 'Hello',
        },
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NetworkError');
    });

    it('should handle messages with tool calls', async () => {
      // Mock to return message with tool calls
      vi.spyOn(server.claudeAgent, 'sendMessage').mockResolvedValue({
        userMessage: {
          id: 'msg_test_user',
          sessionId,
          role: 'user',
          content: 'What is the weather?',
          toolCalls: null,
          timestamp: Date.now(),
        },
        assistantMessage: {
          id: 'msg_test_assistant',
          sessionId,
          role: 'assistant',
          content: 'Let me check the weather for you.',
          toolCalls: [
            {
              id: 'tool_1',
              name: 'get_weather',
              arguments: { location: 'San Francisco' },
            },
          ],
          timestamp: Date.now(),
        },
      });

      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/messages`,
        payload: {
          content: 'What is the weather?',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.assistantMessage.toolCalls).toBeDefined();
      expect(body.data.assistantMessage.toolCalls).toHaveLength(1);
      expect(body.data.assistantMessage.toolCalls[0].name).toBe('get_weather');
    });
  });
});
