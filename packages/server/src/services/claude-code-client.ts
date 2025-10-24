import { spawn } from 'node:child_process';
import * as readline from 'node:readline';

// Error classes
export class ClaudeCodeError extends Error {
  name = 'ClaudeCodeError';
}

export class ClaudeCodeCommandNotFoundError extends ClaudeCodeError {
  name = 'ClaudeCodeCommandNotFoundError';
}

export class ClaudeCodeExecutionError extends ClaudeCodeError {
  name = 'ClaudeCodeExecutionError';
  constructor(
    message: string,
    public stderr?: string
  ) {
    super(message);
  }
}

// Types matching Claude Code CLI stream-json output
export interface StreamEvent {
  type: 'stream_event';
  event: {
    type:
      | 'message_start'
      | 'content_block_start'
      | 'content_block_delta'
      | 'content_block_stop'
      | 'message_delta'
      | 'message_stop';
    delta?: {
      type: 'text_delta';
      text: string;
    };
    index?: number;
  };
  session_id: string;
}

export interface AssistantMessage {
  type: 'assistant';
  message: {
    id: string;
    model: string;
    role: 'assistant';
    content: Array<{
      type: 'text';
      text: string;
    }>;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
  session_id: string;
}

export interface ResultMessage {
  type: 'result';
  subtype: 'success' | 'error';
  is_error: boolean;
  result: string;
  error?: string;
  session_id: string;
}

export interface SystemMessage {
  type: 'system';
  subtype: 'init';
  session_id: string;
  model: string;
}

export type ClaudeCodeMessage = StreamEvent | AssistantMessage | ResultMessage | SystemMessage;

// Response types
export interface ClaudeResponse {
  content: string;
  sessionId: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// Configuration
export interface ClaudeCodeClientConfig {
  model?: string; // Model alias (e.g., 'sonnet', 'opus') or full name
  workingDirectory?: string; // Working directory for claude command
  timeout?: number; // Timeout in milliseconds (default: 5 minutes)
}

/**
 * Client for executing Claude Code CLI in headless mode
 */
export class ClaudeCodeClient {
  private readonly model: string;
  private readonly workingDirectory: string;
  private readonly timeout: number;

  constructor(config: ClaudeCodeClientConfig = {}) {
    this.model = config.model ?? 'sonnet'; // Default to latest Sonnet
    this.workingDirectory = config.workingDirectory ?? process.cwd();
    this.timeout = config.timeout ?? 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Send a message and get complete response (non-streaming)
   */
  async sendMessage(
    prompt: string,
    options?: {
      sessionId?: string; // UUID to resume session
      continueSession?: boolean; // Continue most recent session
    }
  ): Promise<ClaudeResponse> {
    const args = this.buildCommandArgs(prompt, {
      streaming: false,
      ...options,
    });

    return new Promise((resolve, reject) => {
      const process = spawn('claude', args, {
        cwd: this.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        process.kill();
        reject(new ClaudeCodeExecutionError('Command timeout exceeded', stderr));
      }, this.timeout);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        clearTimeout(timer);
        if (error.message.includes('ENOENT')) {
          reject(
            new ClaudeCodeCommandNotFoundError(
              'Claude Code CLI not found. Please install it first.'
            )
          );
        } else {
          reject(new ClaudeCodeExecutionError(error.message, stderr));
        }
      });

      process.on('close', (code) => {
        clearTimeout(timer);

        if (code !== 0) {
          reject(
            new ClaudeCodeExecutionError(`Claude command exited with code ${code}`, stderr)
          );
          return;
        }

        try {
          // Parse NDJSON output
          const lines = stdout.trim().split('\n');
          let assistantMessage: AssistantMessage | null = null;

          for (const line of lines) {
            const msg = JSON.parse(line) as ClaudeCodeMessage;

            // Look for the assistant message with complete response
            if (msg.type === 'assistant') {
              assistantMessage = msg;
            }
          }

          if (!assistantMessage) {
            reject(new ClaudeCodeExecutionError('No assistant message in response', stderr));
            return;
          }

          const content = assistantMessage.message.content
            .map((block) => block.text)
            .join('');

          resolve({
            content,
            sessionId: assistantMessage.session_id,
            usage: {
              inputTokens: assistantMessage.message.usage.input_tokens,
              outputTokens: assistantMessage.message.usage.output_tokens,
            },
          });
        } catch (error) {
          reject(
            new ClaudeCodeExecutionError(
              `Failed to parse response: ${error instanceof Error ? error.message : String(error)}`,
              stderr
            )
          );
        }
      });

      // Send prompt via stdin
      process.stdin.write(prompt);
      process.stdin.end();
    });
  }

  /**
   * Stream a message response as async generator
   */
  async *streamMessage(
    prompt: string,
    options?: {
      sessionId?: string;
      continueSession?: boolean;
    }
  ): AsyncGenerator<string, ClaudeResponse> {
    const args = this.buildCommandArgs(prompt, {
      streaming: true,
      ...options,
    });

    const process = spawn('claude', args, {
      cwd: this.workingDirectory,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderr = '';
    let fullContent = '';
    let sessionId = '';
    let usage: { inputTokens: number; outputTokens: number } | undefined;

    // Set up readline for line-by-line parsing
    const rl = readline.createInterface({
      input: process.stdout,
      crlfDelay: Number.POSITIVE_INFINITY,
    });

    // Send prompt via stdin
    process.stdin.write(prompt);
    process.stdin.end();

    const timer = setTimeout(() => {
      process.kill();
      rl.close();
    }, this.timeout);

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const msg = JSON.parse(line) as ClaudeCodeMessage;

          // Extract session ID from first message
          if (msg.session_id && !sessionId) {
            sessionId = msg.session_id;
          }

          // Stream text deltas
          if (msg.type === 'stream_event' && msg.event.type === 'content_block_delta') {
            if (msg.event.delta?.type === 'text_delta') {
              const text = msg.event.delta.text;
              fullContent += text;
              yield text;
            }
          }

          // Capture usage from assistant message
          if (msg.type === 'assistant') {
            usage = {
              inputTokens: msg.message.usage.input_tokens,
              outputTokens: msg.message.usage.output_tokens,
            };
          }
        } catch (parseError) {
          // Skip malformed JSON lines
          console.warn('Failed to parse line:', line);
        }
      }

      clearTimeout(timer);

      // Collect any stderr
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Wait for process to exit
      const exitCode = await new Promise<number>((resolve) => {
        process.on('close', resolve);
      });

      if (exitCode !== 0) {
        throw new ClaudeCodeExecutionError(
          `Claude command exited with code ${exitCode}`,
          stderr
        );
      }

      return {
        content: fullContent,
        sessionId,
        usage,
      };
    } catch (error) {
      clearTimeout(timer);
      process.kill();
      rl.close();

      if (error instanceof ClaudeCodeError) {
        throw error;
      }

      throw new ClaudeCodeExecutionError(
        `Streaming failed: ${error instanceof Error ? error.message : String(error)}`,
        stderr
      );
    }
  }

  /**
   * Build command arguments for claude CLI
   */
  private buildCommandArgs(
    prompt: string,
    options: {
      streaming: boolean;
      sessionId?: string;
      continueSession?: boolean;
    }
  ): string[] {
    const args: string[] = [
      '-p', // Print mode (non-interactive)
      '--output-format',
      'stream-json', // Always use stream-json for consistency
      '--verbose', // Required for stream-json
      '--model',
      this.model,
    ];

    // Add streaming flag if needed
    if (options.streaming) {
      args.push('--include-partial-messages');
    }

    // Add session resumption
    if (options.sessionId) {
      args.push('--resume', options.sessionId);
    } else if (options.continueSession) {
      args.push('--continue');
    }

    return args;
  }
}
