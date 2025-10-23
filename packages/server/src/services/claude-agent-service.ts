import { nanoid } from 'nanoid';
import { DatabaseClient } from '../db/client.js';
import type { Message, InsertMessage } from '../db/types.js';

// Custom error classes
export class SessionNotFoundError extends Error {
  name = 'SessionNotFoundError';
}

export class InvalidMessageError extends Error {
  name = 'InvalidMessageError';
}

export class ConfigurationError extends Error {
  name = 'ConfigurationError';
}

export class RateLimitError extends Error {
  name = 'RateLimitError';
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message);
  }
}

export class NetworkError extends Error {
  name = 'NetworkError';
}

export class ClaudeAPIError extends Error {
  name = 'ClaudeAPIError';
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
  }
}

// Configuration interface
export interface ClaudeAgentServiceConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
}

// Result types
export interface SendMessageResult {
  userMessage: Message;
  assistantMessage: Message;
}

// Claude API types (simplified - adjust based on actual SDK)
interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
  tool_calls?: any;
}

interface ClaudeResponse {
  content: string;
  tool_calls?: any[] | null;
}

interface ClaudeStreamChunk {
  delta: {
    text?: string;
    tool_calls?: any[];
  };
}

// Mock Claude Agent interface (to be replaced with actual SDK)
interface ClaudeAgent {
  sendMessage(params: { messages: ClaudeMessage[]; max_tokens: number }): Promise<ClaudeResponse>;
  streamMessage(params: {
    messages: ClaudeMessage[];
    max_tokens: number;
  }): AsyncGenerator<ClaudeStreamChunk>;
}

export class ClaudeAgentService {
  private readonly agent: ClaudeAgent;
  private readonly maxTokens: number;
  private readonly model: string;

  constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly config: ClaudeAgentServiceConfig
  ) {
    // Validate API key
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new ConfigurationError('API key is required');
    }

    // Set defaults
    this.maxTokens = config.maxTokens ?? 4096;
    this.model = config.model ?? 'claude-3-5-sonnet-20241022';

    // Initialize Claude Agent
    // Note: Using dynamic import placeholder - actual SDK initialization would go here
    this.agent = this.initializeAgent();
  }

  private initializeAgent(): ClaudeAgent {
    // This is a placeholder for the actual Claude Agent SDK initialization
    // In real implementation, this would be:
    // import { ClaudeAgent } from '@anthropic-ai/claude-agent-sdk';
    // return new ClaudeAgent({ apiKey: this.config.apiKey, model: this.model });

    // For now, return a mock that will be overridden in tests
    return {
      sendMessage: async () => ({ content: '', tool_calls: null }),
      streamMessage: async function* () {
        yield { delta: { text: '' } };
      },
    };
  }

  /**
   * Generate unique message ID in format: msg_{nanoid}
   */
  private generateMessageId(): string {
    return `msg_${nanoid(12)}`;
  }

  /**
   * Get conversation history for a session
   */
  private async getConversationHistory(sessionId: string): Promise<ClaudeMessage[]> {
    const messages = this.databaseClient.getMessages(sessionId);

    return messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
      tool_calls: msg.toolCalls,
    }));
  }

  /**
   * Validate message content
   */
  private validateMessage(content: string): void {
    if (!content || content.trim() === '') {
      throw new InvalidMessageError('Message content cannot be empty');
    }
  }

  /**
   * Handle errors from Claude API
   */
  private handleAPIError(error: any): never {
    // Check for rate limit
    if (error.status === 429) {
      const retryAfter = error.headers?.['retry-after']
        ? Number.parseInt(error.headers['retry-after'], 10)
        : undefined;
      throw new RateLimitError('Rate limit exceeded', retryAfter);
    }

    // Check for network errors
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
      throw new NetworkError(`Network error: ${error.message}`);
    }

    // Check for API errors
    if (error.status) {
      throw new ClaudeAPIError(error.message || 'Claude API error', error.status);
    }

    // Generic error
    throw new NetworkError(error.message || 'Unknown error occurred');
  }

  /**
   * Send a message and get complete response
   */
  async sendMessage(sessionId: string, content: string): Promise<SendMessageResult> {
    // Validate message
    this.validateMessage(content);

    // Verify session exists
    const session = this.databaseClient.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session not found: ${sessionId}`);
    }

    // Get conversation history BEFORE adding new message
    const history = await this.getConversationHistory(sessionId);

    // Save user message
    const userMessage = this.databaseClient.insertMessage({
      id: this.generateMessageId(),
      sessionId,
      role: 'user',
      content,
    });

    try {
      // Add current message to history
      const messagesWithCurrent = [
        ...history,
        { role: 'user' as const, content, tool_calls: undefined },
      ];

      // Call Claude API
      const response = await this.agent.sendMessage({
        messages: messagesWithCurrent,
        max_tokens: this.maxTokens,
      });

      // Save assistant message
      const assistantMessage = this.databaseClient.insertMessage({
        id: this.generateMessageId(),
        sessionId,
        role: 'assistant',
        content: response.content,
        toolCalls: response.tool_calls || null,
      });

      return {
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      // Handle API errors
      this.handleAPIError(error);
    }
  }

  /**
   * Stream message response as async generator
   */
  async *streamMessage(sessionId: string, content: string): AsyncGenerator<string, Message, void> {
    // Validate message
    this.validateMessage(content);

    // Verify session exists
    const session = this.databaseClient.getSession(sessionId);
    if (!session) {
      throw new SessionNotFoundError(`Session not found: ${sessionId}`);
    }

    // Get conversation history BEFORE adding new message
    const history = await this.getConversationHistory(sessionId);

    // Save user message
    this.databaseClient.insertMessage({
      id: this.generateMessageId(),
      sessionId,
      role: 'user',
      content,
    });

    let fullContent = '';
    let toolCalls: any[] | null = null;

    try {
      // Add current message to history
      const messagesWithCurrent = [
        ...history,
        { role: 'user' as const, content, tool_calls: undefined },
      ];

      // Stream response from Claude
      const stream = this.agent.streamMessage({
        messages: messagesWithCurrent,
        max_tokens: this.maxTokens,
      });

      for await (const chunk of stream) {
        if (chunk.delta.text) {
          fullContent += chunk.delta.text;
          yield chunk.delta.text;
        }
        if (chunk.delta.tool_calls) {
          toolCalls = chunk.delta.tool_calls;
        }
      }

      // Save complete assistant message
      const assistantMessage = this.databaseClient.insertMessage({
        id: this.generateMessageId(),
        sessionId,
        role: 'assistant',
        content: fullContent,
        toolCalls,
      });

      return assistantMessage;
    } catch (error) {
      // Stream interrupted - wrap error
      if (error instanceof Error && error.message.includes('Connection')) {
        throw new NetworkError('Stream interrupted');
      }
      // Handle other API errors
      this.handleAPIError(error);
    }
  }
}
