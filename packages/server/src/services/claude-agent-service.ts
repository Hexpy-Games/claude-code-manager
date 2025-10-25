import { nanoid } from 'nanoid';
import { DatabaseClient } from '../db/client.js';
import type { Message, InsertMessage } from '../db/types.js';
import {
  ClaudeCodeClient,
  ClaudeCodeError,
  ClaudeCodeCommandNotFoundError,
  ClaudeCodeExecutionError,
  type ClaudeResponse,
} from './claude-code-client.js';

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
  model?: string;
  maxTokens?: number;
  workingDirectory?: string;
}

// Result types
export interface SendMessageResult {
  userMessage: Message;
  assistantMessage: Message;
}

/**
 * Claude Agent Service
 *
 * Manages interactions with Claude using the Claude Code CLI in headless mode.
 * This service wraps the CLI to provide a programmatic interface for sending
 * messages and streaming responses.
 *
 * ## Implementation Approach
 *
 * Uses Claude Code CLI (`claude` command) instead of the Anthropic SDK because:
 * 1. **Session Management**: CLI automatically handles conversation context and session persistence
 * 2. **Tool Integration**: Built-in support for file operations, shell commands, and other tools
 * 3. **Consistency**: Same model and behavior as the interactive Claude Code experience
 * 4. **Simplicity**: No need to manually manage conversation history or tool implementations
 *
 * ## Headless Mode
 *
 * The CLI is invoked with `claude -p <prompt> --output-format stream-json` which:
 * - Runs non-interactively (no TTY required)
 * - Streams responses as NDJSON (newline-delimited JSON)
 * - Supports session resumption via `--session-id` flag
 * - Returns structured output that can be parsed programmatically
 *
 * ## Session Persistence
 *
 * Claude Code CLI maintains its own session state. We store the CLI session ID
 * in our database session metadata to enable conversation continuity:
 * - First message: CLI creates new session, we store the session ID
 * - Follow-up messages: We pass stored session ID to resume conversation
 *
 * ## Limitations in CLI Mode
 *
 * - **Tool Calls**: Not exposed in headless mode output (handled internally by CLI)
 * - **Stop Reason**: Limited visibility into why response ended
 * - **Usage Metrics**: Token counts available but not real-time
 *
 * ## Error Handling
 *
 * Maps CLI errors to appropriate service errors:
 * - Command not found → ConfigurationError
 * - Rate limit (429) → RateLimitError
 * - Network errors (ETIMEDOUT, ECONNRESET) → NetworkError
 * - Other CLI errors → ClaudeAPIError
 *
 * @see ClaudeCodeClient for CLI interaction details
 */
export class ClaudeAgentService {
  private readonly client: ClaudeCodeClient;
  private readonly maxTokens: number;

  constructor(
    private readonly databaseClient: DatabaseClient,
    private readonly config: ClaudeAgentServiceConfig
  ) {
    // Set defaults
    this.maxTokens = config.maxTokens ?? 4096;

    // Initialize Claude Code CLI client
    this.client = new ClaudeCodeClient({
      model: config.model ?? 'sonnet', // Default to latest Sonnet
      workingDirectory: config.workingDirectory,
    });
  }

  /**
   * Generate unique message ID in format: msg_{nanoid}
   */
  private generateMessageId(): string {
    return `msg_${nanoid(12)}`;
  }

  /**
   * Get Claude Code session ID from database session metadata
   */
  private getClaudeSessionId(sessionId: string): string | null {
    const session = this.databaseClient.getSession(sessionId);
    if (!session || !session.metadata) {
      return null;
    }

    // Check if metadata has claudeSessionId
    const metadata = session.metadata as Record<string, any>;
    return metadata.claudeSessionId || null;
  }

  /**
   * Store Claude Code session ID in database session metadata
   */
  private storeClaudeSessionId(sessionId: string, claudeSessionId: string): void {
    const session = this.databaseClient.getSession(sessionId);
    if (!session) {
      return;
    }

    const metadata = (session.metadata as Record<string, any>) || {};
    metadata.claudeSessionId = claudeSessionId;

    this.databaseClient.updateSession(sessionId, { metadata });
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
   * Handle errors from Claude Code CLI
   */
  private handleClaudeCodeError(error: any): never {
    // Command not found - CLI not installed
    if (error instanceof ClaudeCodeCommandNotFoundError) {
      throw new ConfigurationError(
        'Claude Code CLI not found. Please install it: npm install -g @anthropic-ai/claude-code'
      );
    }

    // Execution errors from CLI
    if (error instanceof ClaudeCodeExecutionError) {
      // Check stderr for rate limit indicators
      if (error.stderr?.includes('rate limit') || error.stderr?.includes('429')) {
        throw new RateLimitError('Rate limit exceeded');
      }

      // Check for network/connection errors
      if (
        error.stderr?.includes('ETIMEDOUT') ||
        error.stderr?.includes('ECONNRESET') ||
        error.stderr?.includes('network')
      ) {
        throw new NetworkError(`Network error: ${error.message}`);
      }

      // Generic Claude Code error
      throw new ClaudeAPIError(error.message);
    }

    // Generic error
    if (error instanceof ClaudeCodeError) {
      throw new ClaudeAPIError(error.message);
    }

    // Unknown error
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

    // Save user message
    const userMessage = this.databaseClient.insertMessage({
      id: this.generateMessageId(),
      sessionId,
      role: 'user',
      content,
    });

    try {
      // Get existing Claude session ID if any
      const claudeSessionId = this.getClaudeSessionId(sessionId);

      // Call Claude Code CLI
      const response = await this.client.sendMessage(content, {
        sessionId: claudeSessionId || undefined,
      });

      // Store Claude session ID if this is the first message
      if (!claudeSessionId && response.sessionId) {
        this.storeClaudeSessionId(sessionId, response.sessionId);
      }

      // Save assistant message
      const assistantMessage = this.databaseClient.insertMessage({
        id: this.generateMessageId(),
        sessionId,
        role: 'assistant',
        content: response.content,
        toolCalls: null, // Tool calls not supported yet in CLI mode
      });

      return {
        userMessage,
        assistantMessage,
      };
    } catch (error) {
      // Handle Claude Code errors
      this.handleClaudeCodeError(error);
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

    // Save user message
    this.databaseClient.insertMessage({
      id: this.generateMessageId(),
      sessionId,
      role: 'user',
      content,
    });

    let fullContent = '';
    let newClaudeSessionId = '';
    let streamCompleted = false;
    let assistantMessage: Message | null = null;

    try {
      // Get existing Claude session ID if any
      const claudeSessionId = this.getClaudeSessionId(sessionId);

      // Stream response from Claude Code CLI
      const stream = this.client.streamMessage(content, {
        sessionId: claudeSessionId || undefined,
      });

      // Accumulate chunks and stream to caller
      for await (const chunk of stream) {
        fullContent += chunk;
        yield chunk;
      }

      // Mark stream as completed successfully
      streamCompleted = true;

      // The async generator's return value contains session ID
      // We'll extract it by wrapping the iteration
      try {
        const finalResult = await stream.next();
        if (finalResult.done) {
          const response = finalResult.value as ClaudeResponse;
          if (response?.sessionId) {
            newClaudeSessionId = response.sessionId;
          }
        }
      } catch {
        // Generator already exhausted, which is normal
      }

      // Store Claude session ID if this is the first message
      if (!claudeSessionId && newClaudeSessionId) {
        this.storeClaudeSessionId(sessionId, newClaudeSessionId);
      }

      // Save complete assistant message
      assistantMessage = this.databaseClient.insertMessage({
        id: this.generateMessageId(),
        sessionId,
        role: 'assistant',
        content: fullContent,
        toolCalls: null, // Tool calls not supported yet in CLI mode
      });

      return assistantMessage;
    } catch (error) {
      console.log(`[ClaudeAgentService] Stream interrupted or error occurred. Partial content length: ${fullContent.length}`);

      // Save partial content if we have any (stream was interrupted)
      if (fullContent.length > 0 && !assistantMessage) {
        console.log('[ClaudeAgentService] Saving partial assistant message before throwing error');
        assistantMessage = this.databaseClient.insertMessage({
          id: this.generateMessageId(),
          sessionId,
          role: 'assistant',
          content: fullContent,
          toolCalls: null,
        });
      }

      // Stream interrupted - wrap error
      if (error instanceof Error && error.message.includes('Connection')) {
        throw new NetworkError('Stream interrupted');
      }
      // Handle other Claude Code errors
      this.handleClaudeCodeError(error);
    } finally {
      // IMPORTANT: Save partial content if stream was interrupted and we haven't saved yet
      // This ensures interrupted messages (ESC/Stop button) are preserved
      if (!streamCompleted && fullContent.length > 0 && !assistantMessage) {
        console.log('[ClaudeAgentService] Stream interrupted - saving partial content in finally block');
        try {
          this.databaseClient.insertMessage({
            id: this.generateMessageId(),
            sessionId,
            role: 'assistant',
            content: fullContent,
            toolCalls: null,
          });
          console.log(`[ClaudeAgentService] ✅ Saved partial message (${fullContent.length} chars)`);
        } catch (saveError) {
          console.error('[ClaudeAgentService] ❌ Failed to save partial content:', saveError);
        }
      }
    }
  }
}
