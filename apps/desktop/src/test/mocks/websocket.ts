/**
 * Mock WebSocket Implementation
 *
 * A mock WebSocket for testing the WebSocket client.
 */

/**
 * Mock WebSocket class for testing
 */
export class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  public readyState = MockWebSocket.CONNECTING;
  public url: string;

  // Event handlers
  public onopen: ((event: Event) => void) | null = null;
  public onclose: ((event: CloseEvent) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;

  // Track sent messages
  public sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;

    // Simulate connection opening
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
      // Send connected message
      this.simulateMessage({
        type: 'connected',
        sessionId: 'sess_test123',
      });
    }, 10);
  }

  /**
   * Send a message to the server
   */
  send(data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sentMessages.push(data);

    // Parse message and simulate response
    try {
      const message = JSON.parse(data);

      if (message.type === 'ping') {
        // Respond with pong
        setTimeout(() => {
          this.simulateMessage({ type: 'pong' });
        }, 10);
      } else if (message.type === 'message') {
        // Simulate streaming response
        setTimeout(() => {
          this.simulateMessage({
            type: 'content_chunk',
            content: 'Hello ',
            index: 0,
          });
        }, 50);

        setTimeout(() => {
          this.simulateMessage({
            type: 'content_chunk',
            content: 'World',
            index: 1,
          });
        }, 100);

        setTimeout(() => {
          this.simulateMessage({
            type: 'done',
            stopReason: 'end_turn',
          });
        }, 150);
      }
    } catch {
      // Ignore parsing errors
    }
  }

  /**
   * Close the WebSocket connection
   */
  close(code = 1000, reason = 'Normal closure'): void {
    this.readyState = MockWebSocket.CLOSING;

    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        const event = new CloseEvent('close', {
          code,
          reason,
          wasClean: code === 1000,
        });
        this.onclose(event);
      }
    }, 10);
  }

  /**
   * Simulate receiving a message from the server
   */
  simulateMessage(data: unknown): void {
    if (this.onmessage && this.readyState === MockWebSocket.OPEN) {
      const event = new MessageEvent('message', {
        data: JSON.stringify(data),
      });
      this.onmessage(event);
    }
  }

  /**
   * Simulate an error
   */
  simulateError(): void {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }

  /**
   * Simulate connection close
   */
  simulateClose(code = 1000, reason = 'Normal closure'): void {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) {
      const event = new CloseEvent('close', {
        code,
        reason,
        wasClean: code === 1000,
      });
      this.onclose(event);
    }
  }
}

/**
 * Install mock WebSocket in global scope
 * Note: This function is a no-op, use vi.stubGlobal in tests instead
 */
export function installMockWebSocket(): void {
  // No-op - use vi.stubGlobal('WebSocket', MockWebSocket) in tests
}

/**
 * Restore original WebSocket
 * Note: This function is a no-op, use vi.unstubAllGlobals in tests instead
 */
export function restoreMockWebSocket(): void {
  // No-op - use vi.unstubAllGlobals() in tests
}
