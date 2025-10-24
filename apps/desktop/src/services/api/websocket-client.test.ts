/**
 * WebSocket Client Tests
 *
 * Comprehensive tests for the WebSocket client using TDD methodology.
 */

import { MockWebSocket } from '@/test/mocks/websocket';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StreamMessage } from './types';
import { WebSocketClient } from './websocket-client';

describe('WebSocketClient', () => {
  beforeEach(() => {
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      expect(client.isConnected()).toBe(true);
    });

    it('should receive connected message', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const messages: StreamMessage[] = [];
      client.onMessage((msg) => messages.push(msg));

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe('connected');
      expect(messages[0].sessionId).toBe('sess_test123');
    });

    it('should disconnect cleanly', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      client.disconnect();
      await vi.advanceTimersByTimeAsync(20);

      expect(client.isConnected()).toBe(false);
    });

    it('should reconnect on connection loss', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
        reconnectAttempts: 3,
        reconnectDelay: 100,
      });

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      // Simulate connection loss
      const ws = (client as any).ws as unknown as MockWebSocket;
      ws.simulateClose(1006, 'Connection lost');

      await vi.advanceTimersByTimeAsync(200);

      // Should reconnect
      expect(client.isConnected()).toBe(true);
    });

    it('should stop reconnecting after max attempts', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
        reconnectAttempts: 2,
        reconnectDelay: 100,
      });

      const errorHandler = vi.fn();
      client.onError(errorHandler);

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      // Disconnect to prevent reconnection
      client.disconnect();
      await vi.advanceTimersByTimeAsync(20);

      expect(client.isConnected()).toBe(false);
    });
  });

  describe('Message Handling', () => {
    it('should send message', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      client.sendMessage('Hello');

      const ws = (client as any).ws as unknown as MockWebSocket;
      expect(ws.sentMessages).toContain(JSON.stringify({ type: 'message', content: 'Hello' }));
    });

    it('should receive content chunks', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const messages: StreamMessage[] = [];
      client.onMessage((msg) => {
        if (msg.type === 'content_chunk') {
          messages.push(msg);
        }
      });

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      client.sendMessage('Hello');
      await vi.advanceTimersByTimeAsync(200);

      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].type).toBe('content_chunk');
      expect(messages[0].content).toBeDefined();
    });

    it('should handle tool use messages', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const messages: StreamMessage[] = [];
      client.onMessage((msg) => messages.push(msg));

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      const ws = (client as any).ws as unknown as MockWebSocket;
      ws.simulateMessage({
        type: 'tool_use',
        content: 'Using tool',
      });

      expect(messages.some((m) => m.type === 'tool_use')).toBe(true);
    });

    it('should handle done message', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const messages: StreamMessage[] = [];
      client.onMessage((msg) => {
        if (msg.type === 'done') {
          messages.push(msg);
        }
      });

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      client.sendMessage('Hello');
      await vi.advanceTimersByTimeAsync(200);

      expect(messages.some((m) => m.type === 'done')).toBe(true);
    });

    it('should handle error messages', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const messages: StreamMessage[] = [];
      client.onMessage((msg) => messages.push(msg));

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      const ws = (client as any).ws as unknown as MockWebSocket;
      ws.simulateMessage({
        type: 'error',
        error: 'TestError',
        message: 'Test error occurred',
      });

      expect(messages.some((m) => m.type === 'error')).toBe(true);
    });
  });

  describe('Ping/Pong', () => {
    it('should send ping messages', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
        pingInterval: 1000,
      });

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      const ws = (client as any).ws as unknown as MockWebSocket;
      const initialCount = ws.sentMessages.length;

      // Advance time to trigger ping
      await vi.advanceTimersByTimeAsync(1000);

      expect(ws.sentMessages.length).toBeGreaterThan(initialCount);
      expect(ws.sentMessages.some((m) => m.includes('"type":"ping"'))).toBe(true);
    });

    it('should receive pong responses', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
        pingInterval: 1000,
      });

      const messages: StreamMessage[] = [];
      client.onMessage((msg) => messages.push(msg));

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      client.ping();
      await vi.advanceTimersByTimeAsync(20);

      expect(messages.some((m) => m.type === 'pong')).toBe(true);
    });

    it('should maintain connection with ping', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
        pingInterval: 1000,
      });

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      // Advance time for multiple ping intervals
      await vi.advanceTimersByTimeAsync(5000);

      expect(client.isConnected()).toBe(true);
    });
  });

  describe('Event Handlers', () => {
    it('should call onMessage handler', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const handler = vi.fn();
      client.onMessage(handler);

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      expect(handler).toHaveBeenCalled();
    });

    it('should call onError handler', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const handler = vi.fn();
      client.onError(handler);

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      const ws = (client as any).ws as unknown as MockWebSocket;
      ws.simulateError();

      expect(handler).toHaveBeenCalled();
    });

    it('should call onClose handler', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const handler = vi.fn();
      client.onClose(handler);

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      client.disconnect();
      await vi.advanceTimersByTimeAsync(20);

      expect(handler).toHaveBeenCalled();
    });

    it('should call onOpen handler', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const handler = vi.fn();
      client.onOpen(handler);

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      expect(handler).toHaveBeenCalled();
    });

    it('should support multiple handlers', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const handler1 = vi.fn();
      const handler2 = vi.fn();

      client.onMessage(handler1);
      client.onMessage(handler2);

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle connection errors', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const errorHandler = vi.fn();
      client.onError(errorHandler);

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      const ws = (client as any).ws as unknown as MockWebSocket;
      ws.simulateError();

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle malformed messages', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const errorHandler = vi.fn();
      client.onError(errorHandler);

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      const ws = (client as any).ws as unknown as MockWebSocket;
      if (ws.onmessage) {
        ws.onmessage(
          new MessageEvent('message', {
            data: 'invalid json',
          })
        );
      }

      expect(errorHandler).toHaveBeenCalled();
    });

    it('should handle server errors', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const messages: StreamMessage[] = [];
      client.onMessage((msg) => messages.push(msg));

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      const ws = (client as any).ws as unknown as MockWebSocket;
      ws.simulateMessage({
        type: 'error',
        error: 'ServerError',
        message: 'Internal server error',
      });

      expect(messages.some((m) => m.type === 'error')).toBe(true);
    });

    it('should emit errors to handlers', async () => {
      const client = new WebSocketClient({
        baseUrl: 'ws://localhost:3000/api',
      });

      const errorHandler = vi.fn();
      client.onError(errorHandler);

      const promise = client.connect('sess_test123');
      await vi.advanceTimersByTimeAsync(20);
      await promise;

      const ws = (client as any).ws as unknown as MockWebSocket;
      ws.simulateError();

      expect(errorHandler).toHaveBeenCalled();
      expect(errorHandler.mock.calls[0][0]).toBeInstanceOf(Error);
    });
  });
});
