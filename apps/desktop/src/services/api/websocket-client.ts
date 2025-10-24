/**
 * WebSocket Client
 *
 * Client for real-time streaming communication with the backend server.
 * Supports automatic reconnection, ping/pong keep-alive, and event handling.
 */

import type { StreamMessage } from './types';

/**
 * WebSocket client configuration options
 */
export interface WebSocketClientOptions {
  /** Base URL for WebSocket connections */
  baseUrl: string;
  /** Number of reconnection attempts (default: 5) */
  reconnectAttempts?: number;
  /** Delay between reconnection attempts in milliseconds (default: 1000) */
  reconnectDelay?: number;
  /** Ping interval in milliseconds (default: 30000) */
  pingInterval?: number;
}

/**
 * Message handler function type
 */
export type MessageHandler = (message: StreamMessage) => void;

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error) => void;

/**
 * Close handler function type
 */
export type CloseHandler = (code: number, reason: string) => void;

/**
 * Open handler function type
 */
export type OpenHandler = () => void;

/**
 * WebSocket Client
 *
 * Manages WebSocket connections for real-time streaming of Claude responses.
 * Features automatic reconnection, ping/pong keep-alive, and flexible event handling.
 *
 * @example
 * ```typescript
 * const client = new WebSocketClient({
 *   baseUrl: 'ws://localhost:3000/api',
 * });
 *
 * client.onMessage((message) => {
 *   if (message.type === 'content_chunk') {
 *     console.log(message.content);
 *   }
 * });
 *
 * await client.connect('sess_123');
 * client.sendMessage('Hello Claude');
 * ```
 */
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private options: Required<WebSocketClientOptions>;
  private reconnectCount = 0;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private shouldReconnect = true;

  // Event handlers
  private messageHandlers: MessageHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private closeHandlers: CloseHandler[] = [];
  private openHandlers: OpenHandler[] = [];

  /**
   * Creates a new WebSocket client
   *
   * @param options - Configuration options
   */
  constructor(options: WebSocketClientOptions) {
    this.options = {
      baseUrl: options.baseUrl,
      reconnectAttempts: options.reconnectAttempts ?? 5,
      reconnectDelay: options.reconnectDelay ?? 1000,
      pingInterval: options.pingInterval ?? 30000,
    };
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  /**
   * Connects to the WebSocket server
   *
   * @param sessionId - Session ID to connect to
   * @returns Promise that resolves when connected
   */
  async connect(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.shouldReconnect = true;
    this.reconnectCount = 0;

    return new Promise((resolve, reject) => {
      try {
        const url = `${this.options.baseUrl}/sessions/${sessionId}/stream`;
        this.ws = new WebSocket(url);

        // Set up event handlers
        this.ws.onopen = () => {
          this.handleOpen();
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onerror = () => {
          this.handleError();
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = (event) => {
          this.handleClose(event);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Disconnects from the WebSocket server
   */
  disconnect(): void {
    this.shouldReconnect = false;
    this.stopPing();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Checks if the WebSocket is connected
   *
   * @returns True if connected
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  // ============================================================================
  // Message Sending
  // ============================================================================

  /**
   * Sends a message to the server
   *
   * @param content - Message content
   * @throws {Error} If not connected
   */
  sendMessage(content: string): void {
    if (!this.isConnected()) {
      throw new Error('WebSocket is not connected');
    }

    this.ws?.send(
      JSON.stringify({
        type: 'message',
        content,
      })
    );
  }

  /**
   * Sends a ping message to keep connection alive
   */
  ping(): void {
    if (!this.isConnected()) {
      return;
    }

    this.ws?.send(
      JSON.stringify({
        type: 'ping',
      })
    );
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  /**
   * Registers a message handler
   *
   * @param handler - Function to handle messages
   */
  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  /**
   * Registers an error handler
   *
   * @param handler - Function to handle errors
   */
  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  /**
   * Registers a close handler
   *
   * @param handler - Function to handle connection close
   */
  onClose(handler: CloseHandler): void {
    this.closeHandlers.push(handler);
  }

  /**
   * Registers an open handler
   *
   * @param handler - Function to handle connection open
   */
  onOpen(handler: OpenHandler): void {
    this.openHandlers.push(handler);
  }

  // ============================================================================
  // Internal Methods
  // ============================================================================

  /**
   * Handles incoming messages
   *
   * @param event - Message event
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data) as StreamMessage;

      // Emit to all handlers
      for (const handler of this.messageHandlers) {
        handler(message);
      }
    } catch (error) {
      const parseError = new Error(
        `Failed to parse WebSocket message: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
      for (const handler of this.errorHandlers) {
        handler(parseError);
      }
    }
  }

  /**
   * Handles WebSocket errors
   */
  private handleError(): void {
    const error = new Error('WebSocket error occurred');

    // Emit to all handlers
    for (const handler of this.errorHandlers) {
      handler(error);
    }
  }

  /**
   * Handles connection close
   *
   * @param event - Close event
   */
  private handleClose(event: CloseEvent): void {
    this.stopPing();

    // Emit to all handlers
    for (const handler of this.closeHandlers) {
      handler(event.code, event.reason);
    }

    // Attempt reconnection if appropriate
    if (
      this.shouldReconnect &&
      event.code !== 1000 &&
      this.reconnectCount < this.options.reconnectAttempts
    ) {
      this.reconnect();
    }
  }

  /**
   * Handles connection open
   */
  private handleOpen(): void {
    this.reconnectCount = 0;
    this.startPing();

    // Emit to all handlers
    for (const handler of this.openHandlers) {
      handler();
    }
  }

  /**
   * Attempts to reconnect to the server
   */
  private reconnect(): void {
    this.reconnectCount++;

    const delay = this.options.reconnectDelay * 2 ** (this.reconnectCount - 1);

    setTimeout(() => {
      if (this.sessionId && this.shouldReconnect) {
        this.connect(this.sessionId).catch((error) => {
          for (const handler of this.errorHandlers) {
            handler(error);
          }
        });
      }
    }, delay);
  }

  /**
   * Starts the ping timer
   */
  private startPing(): void {
    this.stopPing();

    this.pingTimer = setInterval(() => {
      this.ping();
    }, this.options.pingInterval);
  }

  /**
   * Stops the ping timer
   */
  private stopPing(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }
}
