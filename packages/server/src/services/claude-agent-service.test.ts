import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DatabaseClient } from '../db/client.js';
import {
  ClaudeAgentService,
  SessionNotFoundError,
  InvalidMessageError,
  ConfigurationError,
  RateLimitError,
  NetworkError,
  ClaudeAPIError,
} from './claude-agent-service.js';
import type { Session, Message } from '../db/types.js';

// Helper to create mock DatabaseClient
function createMockDatabaseClient() {
  return {
    getSession: vi.fn(),
    getMessages: vi.fn(),
    insertMessage: vi.fn(),
    getSessions: vi.fn(),
    insertSession: vi.fn(),
    updateSession: vi.fn(),
    deleteSession: vi.fn(),
    getMessage: vi.fn(),
    deleteMessages: vi.fn(),
    getSetting: vi.fn(),
    setSetting: vi.fn(),
    deleteSetting: vi.fn(),
    close: vi.fn(),
    raw: {} as any,
  } as unknown as DatabaseClient;
}

// Helper to create mock Claude Agent
function createMockClaudeAgent() {
  return {
    sendMessage: vi.fn(),
    streamMessage: vi.fn(),
  };
}

describe('ClaudeAgentService', () => {
  // Test Suite: Constructor and Initialization

  describe('Constructor and Initialization', () => {
    it('should initialize ClaudeAgentService with API key', () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const config = { apiKey: 'test-key-123' };

      // Act
      const service = new ClaudeAgentService(mockDb, config);

      // Assert
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ClaudeAgentService);
    });

    it('should throw ConfigurationError when API key is missing', () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const config = { apiKey: '' };

      // Act & Assert
      expect(() => new ClaudeAgentService(mockDb, config)).toThrow(ConfigurationError);
      expect(() => new ClaudeAgentService(mockDb, config)).toThrow('API key is required');
    });

    it('should use default model when config.model not provided', () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const config = { apiKey: 'test-key-123' };

      // Act
      const service = new ClaudeAgentService(mockDb, config);

      // Assert
      expect(service).toBeDefined();
    });

    it('should use custom model when provided in config', () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const config = {
        apiKey: 'test-key-123',
        model: 'claude-3-opus-20240229',
      };

      // Act
      const service = new ClaudeAgentService(mockDb, config);

      // Assert
      expect(service).toBeDefined();
    });
  });

  // Test Suite: generateMessageId()

  describe('generateMessageId()', () => {
    it('should generate message ID in format msg_{nanoid}', () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

      // Act
      const id1 = (service as any).generateMessageId();
      const id2 = (service as any).generateMessageId();

      // Assert
      expect(id1).toMatch(/^msg_[A-Za-z0-9_-]{12}$/);
      expect(id2).toMatch(/^msg_[A-Za-z0-9_-]{12}$/);
      expect(id1).not.toBe(id2); // Should be unique
    });
  });

  // Test Suite: sendMessage() - Happy Path

  describe('sendMessage() - Happy Path', () => {
    it('should send user message, get Claude response, and save both to DB', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test Session',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      const mockUserMessage: Message = {
        id: 'msg_user123',
        sessionId: 'sess_123',
        role: 'user',
        content: 'Hello Claude',
        toolCalls: null,
        timestamp: Date.now(),
      };

      const mockAssistantMessage: Message = {
        id: 'msg_asst123',
        sessionId: 'sess_123',
        role: 'assistant',
        content: 'Hello! How can I help you?',
        toolCalls: null,
        timestamp: Date.now(),
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi
        .fn()
        .mockReturnValueOnce(mockUserMessage)
        .mockReturnValueOnce(mockAssistantMessage);

      mockAgent.sendMessage.mockResolvedValue({
        content: 'Hello! How can I help you?',
        tool_calls: null,
      });

      // Act
      const result = await service.sendMessage('sess_123', 'Hello Claude');

      // Assert
      expect(mockDb.getSession).toHaveBeenCalledWith('sess_123');
      expect(mockDb.getMessages).toHaveBeenCalledWith('sess_123');
      expect(mockDb.insertMessage).toHaveBeenCalledTimes(2);

      // Verify user message
      expect(mockDb.insertMessage).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          sessionId: 'sess_123',
          role: 'user',
          content: 'Hello Claude',
        })
      );

      // Verify assistant message
      expect(mockDb.insertMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          sessionId: 'sess_123',
          role: 'assistant',
          content: 'Hello! How can I help you?',
          toolCalls: null,
        })
      );

      expect(result).toEqual({
        userMessage: mockUserMessage,
        assistantMessage: mockAssistantMessage,
      });
    });

    it('should include conversation history in Claude request', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([
        {
          id: 'msg_1',
          sessionId: 'sess_123',
          role: 'user',
          content: 'Previous question',
          toolCalls: null,
          timestamp: 1000,
        },
        {
          id: 'msg_2',
          sessionId: 'sess_123',
          role: 'assistant',
          content: 'Previous answer',
          toolCalls: null,
          timestamp: 2000,
        },
      ]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      mockAgent.sendMessage.mockResolvedValue({
        content: 'Based on our previous conversation...',
        tool_calls: null,
      });

      // Act
      await service.sendMessage('sess_123', 'Follow-up question');

      // Assert
      expect(mockAgent.sendMessage).toHaveBeenCalledWith({
        messages: [
          { role: 'user', content: 'Previous question', tool_calls: null },
          { role: 'assistant', content: 'Previous answer', tool_calls: null },
          { role: 'user', content: 'Follow-up question', tool_calls: undefined },
        ],
        max_tokens: 4096,
      });
    });
  });

  // Test Suite: sendMessage() - Tool Calls

  describe('sendMessage() - Tool Calls', () => {
    it('should save tool_calls when Claude requests tool use', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      const toolCalls = [{ id: 'call_1', name: 'read_file', arguments: { path: '/test.txt' } }];

      mockAgent.sendMessage.mockResolvedValue({
        content: 'Let me read that file for you.',
        tool_calls: toolCalls,
      });

      // Act
      await service.sendMessage('sess_123', 'Read test.txt');

      // Assert
      expect(mockDb.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: 'Let me read that file for you.',
          toolCalls: toolCalls,
        })
      );
    });

    it('should save multiple tool calls from single response', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      const toolCalls = [
        { id: 'call_1', name: 'read_file', arguments: { path: '/file1.txt' } },
        { id: 'call_2', name: 'read_file', arguments: { path: '/file2.txt' } },
      ];

      mockAgent.sendMessage.mockResolvedValue({
        content: 'Let me read both files.',
        tool_calls: toolCalls,
      });

      // Act
      await service.sendMessage('sess_123', 'Compare file1 and file2');

      // Assert
      expect(mockDb.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          toolCalls: expect.arrayContaining([
            expect.objectContaining({ name: 'read_file' }),
            expect.objectContaining({ name: 'read_file' }),
          ]),
        })
      );
    });
  });

  // Test Suite: sendMessage() - Error Cases

  describe('sendMessage() - Error Cases', () => {
    it('should throw SessionNotFoundError when session does not exist', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

      mockDb.getSession = vi.fn().mockReturnValue(null);

      // Act & Assert
      await expect(service.sendMessage('sess_nonexistent', 'Hello')).rejects.toThrow(
        SessionNotFoundError
      );

      await expect(service.sendMessage('sess_nonexistent', 'Hello')).rejects.toThrow(
        'Session not found: sess_nonexistent'
      );

      // Verify no messages were saved
      expect(mockDb.insertMessage).not.toHaveBeenCalled();
    });

    it('should throw InvalidMessageError when content is empty', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);

      // Act & Assert
      await expect(service.sendMessage('sess_123', '')).rejects.toThrow(InvalidMessageError);
      await expect(service.sendMessage('sess_123', '   ')).rejects.toThrow(InvalidMessageError);
    });

    it('should throw RateLimitError when API rate limited', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      const rateLimitError: any = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      rateLimitError.headers = { 'retry-after': '60' };
      mockAgent.sendMessage.mockRejectedValue(rateLimitError);

      // Act & Assert
      await expect(service.sendMessage('sess_123', 'Hello')).rejects.toThrow(RateLimitError);

      // User message should be saved (can retry)
      expect(mockDb.insertMessage).toHaveBeenCalledTimes(1);
      expect(mockDb.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'user' })
      );
    });

    it('should throw ClaudeAPIError for API errors', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      const apiError: any = new Error('Invalid request');
      apiError.status = 400;
      mockAgent.sendMessage.mockRejectedValue(apiError);

      // Act & Assert
      await expect(service.sendMessage('sess_123', 'Hello')).rejects.toThrow(ClaudeAPIError);
    });

    it('should throw NetworkError on network timeout', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      const timeoutError: any = new Error('ETIMEDOUT');
      timeoutError.code = 'ETIMEDOUT';
      mockAgent.sendMessage.mockRejectedValue(timeoutError);

      // Act & Assert
      await expect(service.sendMessage('sess_123', 'Hello')).rejects.toThrow(NetworkError);
    });
  });

  // Test Suite: streamMessage() - Happy Path

  describe('streamMessage() - Happy Path', () => {
    it('should stream tokens as they arrive from Claude', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      // Mock streaming response
      async function* mockStream() {
        yield { delta: { text: 'Hello' } };
        yield { delta: { text: ' there' } };
        yield { delta: { text: '!' } };
      }

      mockAgent.streamMessage.mockReturnValue(mockStream());

      // Act
      const generator = service.streamMessage('sess_123', 'Hi');
      const tokens: string[] = [];

      for await (const token of generator) {
        tokens.push(token);
      }

      // Assert
      expect(tokens).toEqual(['Hello', ' there', '!']);
      expect(mockDb.insertMessage).toHaveBeenCalledTimes(2); // User + complete assistant
    });

    it('should save complete assistant message after streaming completes', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      async function* mockStream() {
        yield { delta: { text: 'Hello' } };
        yield { delta: { text: ' world' } };
      }

      mockAgent.streamMessage.mockReturnValue(mockStream());

      // Act
      const generator = service.streamMessage('sess_123', 'Hi');
      // Consume all tokens
      for await (const token of generator) {
        // Just consume
      }

      // Assert
      expect(mockDb.insertMessage).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          role: 'assistant',
          content: 'Hello world', // Complete accumulated text
        })
      );
    });

    it('should capture tool calls during streaming', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      const toolCalls = [{ id: 'call_1', name: 'read_file', arguments: {} }];

      async function* mockStream() {
        yield { delta: { text: 'Let me read' } };
        yield { delta: { text: ' that file' } };
        yield { delta: { tool_calls: toolCalls } };
      }

      mockAgent.streamMessage.mockReturnValue(mockStream());

      // Act
      const generator = service.streamMessage('sess_123', 'Read file');
      for await (const token of generator) {
        // Consume stream
      }

      // Assert
      expect(mockDb.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: 'Let me read that file',
          toolCalls: toolCalls,
        })
      );
    });
  });

  // Test Suite: streamMessage() - Error Cases

  describe('streamMessage() - Error Cases', () => {
    it('should throw SessionNotFoundError before streaming starts', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

      mockDb.getSession = vi.fn().mockReturnValue(null);

      // Act
      const generator = service.streamMessage('sess_invalid', 'Hello');

      // Assert
      await expect(async () => {
        for await (const token of generator) {
          // Should throw before yielding any tokens
        }
      }).rejects.toThrow(SessionNotFoundError);
    });

    it('should throw NetworkError when stream is interrupted', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      async function* mockStream() {
        yield { delta: { text: 'Hello' } };
        throw new Error('Connection lost');
      }

      mockAgent.streamMessage.mockReturnValue(mockStream());

      // Act & Assert
      await expect(async () => {
        const generator = service.streamMessage('sess_123', 'Hi');
        for await (const token of generator) {
          // Will throw on second iteration
        }
      }).rejects.toThrow(NetworkError);

      // Partial response should NOT be saved
      expect(mockDb.insertMessage).toHaveBeenCalledTimes(1); // Only user message
    });

    it('should not save assistant message if stream fails', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      async function* mockStream() {
        yield { delta: { text: 'Partial' } };
        throw new Error('Stream error');
      }

      mockAgent.streamMessage.mockReturnValue(mockStream());

      // Act
      try {
        const generator = service.streamMessage('sess_123', 'Hi');
        for await (const token of generator) {
          // Will throw
        }
      } catch (error) {
        // Expected
      }

      // Assert
      // Only user message saved, no assistant message
      expect(mockDb.insertMessage).toHaveBeenCalledTimes(1);
      expect(mockDb.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'user' })
      );
    });
  });

  // Test Suite: getConversationHistory()

  describe('getConversationHistory()', () => {
    it('should load conversation history in chronological order', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

      const messages: Message[] = [
        {
          id: 'msg_1',
          sessionId: 'sess_123',
          role: 'user',
          content: 'First',
          toolCalls: null,
          timestamp: 1000,
        },
        {
          id: 'msg_2',
          sessionId: 'sess_123',
          role: 'assistant',
          content: 'Second',
          toolCalls: null,
          timestamp: 2000,
        },
        {
          id: 'msg_3',
          sessionId: 'sess_123',
          role: 'user',
          content: 'Third',
          toolCalls: null,
          timestamp: 3000,
        },
      ];

      mockDb.getMessages = vi.fn().mockReturnValue(messages);

      // Act
      const history = await (service as any).getConversationHistory('sess_123');

      // Assert
      expect(history).toEqual([
        { role: 'user', content: 'First', tool_calls: null },
        { role: 'assistant', content: 'Second', tool_calls: null },
        { role: 'user', content: 'Third', tool_calls: null },
      ]);
    });

    it('should return empty array for new session', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

      mockDb.getMessages = vi.fn().mockReturnValue([]);

      // Act
      const history = await (service as any).getConversationHistory('sess_new');

      // Assert
      expect(history).toEqual([]);
    });

    it('should include tool calls in conversation history', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });

      const toolCalls = [{ id: 'call_1', name: 'read_file', arguments: {} }];
      const messages: Message[] = [
        {
          id: 'msg_1',
          sessionId: 'sess_123',
          role: 'user',
          content: 'Read file',
          toolCalls: null,
          timestamp: 1000,
        },
        {
          id: 'msg_2',
          sessionId: 'sess_123',
          role: 'assistant',
          content: 'Reading...',
          toolCalls,
          timestamp: 2000,
        },
      ];

      mockDb.getMessages = vi.fn().mockReturnValue(messages);

      // Act
      const history = await (service as any).getConversationHistory('sess_123');

      // Assert
      expect(history[1]).toEqual({
        role: 'assistant',
        content: 'Reading...',
        tool_calls: toolCalls,
      });
    });
  });

  // Test Suite: Edge Cases

  describe('Edge Cases', () => {
    it('should handle messages with large content', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      const longMessage = 'x'.repeat(100000); // 100k characters
      mockAgent.sendMessage.mockResolvedValue({ content: 'Received', tool_calls: null });

      // Act
      await service.sendMessage('sess_123', longMessage);

      // Assert
      expect(mockDb.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: longMessage,
        })
      );
    });

    it('should properly save messages with special characters', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      const specialMessage = 'Hello\nWorld\t"quotes"\n\'apostrophe\'\\backslash';
      mockAgent.sendMessage.mockResolvedValue({ content: 'Understood', tool_calls: null });

      // Act
      await service.sendMessage('sess_123', specialMessage);

      // Assert
      expect(mockDb.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: specialMessage,
        })
      );
    });

    it('should save assistant message even with empty content', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      const toolCalls = [{ id: 'call_1', name: 'execute', arguments: {} }];
      mockAgent.sendMessage.mockResolvedValue({
        content: '',
        tool_calls: toolCalls,
      });

      // Act
      await service.sendMessage('sess_123', 'Execute tool');

      // Assert
      expect(mockDb.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'assistant',
          content: '',
          toolCalls: toolCalls,
        })
      );
    });

    it('should handle multiple concurrent sendMessage calls', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);

      mockAgent.sendMessage.mockResolvedValue({ content: 'Response', tool_calls: null });

      // Act
      const promises = [
        service.sendMessage('sess_123', 'Message 1'),
        service.sendMessage('sess_123', 'Message 2'),
        service.sendMessage('sess_123', 'Message 3'),
      ];

      await Promise.all(promises);

      // Assert
      expect(mockDb.insertMessage).toHaveBeenCalledTimes(6); // 3 user + 3 assistant
    });
  });

  // Test Suite: Configuration Options

  describe('Configuration Options', () => {
    it('should use custom maxTokens when provided', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, {
        apiKey: 'test-key',
        maxTokens: 8192,
      });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);
      mockAgent.sendMessage.mockResolvedValue({ content: 'Response', tool_calls: null });

      // Act
      await service.sendMessage('sess_123', 'Hello');

      // Assert
      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 8192,
        })
      );
    });

    it('should use default maxTokens of 4096', async () => {
      // Arrange
      const mockDb = createMockDatabaseClient();
      const mockAgent = createMockClaudeAgent();
      const service = new ClaudeAgentService(mockDb, {
        apiKey: 'test-key',
        // maxTokens not provided
      });
      (service as any).agent = mockAgent;

      const mockSession: Session = {
        id: 'sess_123',
        title: 'Test',
        rootDirectory: '/test',
        branchName: 'session/sess_123',
        baseBranch: 'main',
        gitStatus: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastMessageAt: null,
        metadata: null,
        isActive: true,
      };

      mockDb.getSession = vi.fn().mockReturnValue(mockSession);
      mockDb.getMessages = vi.fn().mockReturnValue([]);
      mockDb.insertMessage = vi.fn().mockReturnValue({} as Message);
      mockAgent.sendMessage.mockResolvedValue({ content: 'Response', tool_calls: null });

      // Act
      await service.sendMessage('sess_123', 'Hello');

      // Assert
      expect(mockAgent.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 4096,
        })
      );
    });
  });

  // Integration Tests

  describe('Integration with DatabaseClient', () => {
    let db: DatabaseClient;
    let service: ClaudeAgentService;
    let mockAgent: any;

    beforeEach(() => {
      // Use real DatabaseClient with :memory: database
      db = new DatabaseClient(':memory:');

      // Create test session
      db.insertSession({
        id: 'sess_integration_test',
        title: 'Integration Test Session',
        rootDirectory: '/test',
        branchName: 'session/test',
      });

      // Mock Claude Agent SDK
      mockAgent = {
        sendMessage: vi.fn(),
        streamMessage: vi.fn(),
      };

      // Create service with real DB and mocked Claude
      service = new ClaudeAgentService(db, { apiKey: 'test-key' });
      (service as any).agent = mockAgent;
    });

    afterEach(() => {
      db.close();
    });

    it('should save user and assistant messages to real database', async () => {
      // Arrange
      mockAgent.sendMessage.mockResolvedValue({
        content: 'Hello from Claude!',
        tool_calls: null,
      });

      // Act
      await service.sendMessage('sess_integration_test', 'Hello Claude');

      // Assert - Query real database
      const messages = db.getMessages('sess_integration_test');
      expect(messages).toHaveLength(2);

      expect(messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello Claude',
        toolCalls: null,
      });

      expect(messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hello from Claude!',
        toolCalls: null,
      });
    });

    it('should accumulate conversation history in database', async () => {
      // Arrange
      mockAgent.sendMessage.mockResolvedValue({ content: 'Response 1', tool_calls: null });

      // Act - Send first message
      await service.sendMessage('sess_integration_test', 'Message 1');

      mockAgent.sendMessage.mockResolvedValue({ content: 'Response 2', tool_calls: null });

      // Act - Send second message
      await service.sendMessage('sess_integration_test', 'Message 2');

      // Assert - Check database has all messages
      const messages = db.getMessages('sess_integration_test');
      expect(messages).toHaveLength(4); // 2 user + 2 assistant

      // Verify order
      expect(messages.map((m) => m.content)).toEqual([
        'Message 1',
        'Response 1',
        'Message 2',
        'Response 2',
      ]);
    });

    it('should update session.last_message_at in database', async () => {
      // Arrange
      const initialSession = db.getSession('sess_integration_test');
      const initialLastMessage = initialSession!.lastMessageAt;

      mockAgent.sendMessage.mockResolvedValue({ content: 'Response', tool_calls: null });

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act
      await service.sendMessage('sess_integration_test', 'Hello');

      // Assert
      const updatedSession = db.getSession('sess_integration_test');
      expect(updatedSession!.lastMessageAt).toBeGreaterThan(initialLastMessage || 0);
    });
  });
});
