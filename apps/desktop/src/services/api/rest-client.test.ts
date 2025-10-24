/**
 * REST Client Tests
 *
 * Comprehensive tests for the REST API client using TDD methodology.
 */

import { server } from '@/test/setup';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError, NetworkError, NotFoundError, TimeoutError, ValidationError } from './errors';
import { RestClient } from './rest-client';

describe('RestClient', () => {
  let client: RestClient;

  beforeEach(() => {
    client = new RestClient({ baseUrl: '/api' });
  });

  describe('Session Management', () => {
    it('should create session successfully', async () => {
      const sessionData = {
        title: 'New Session',
        rootDirectory: '/path/to/repo',
        baseBranch: 'develop',
        metadata: { key: 'value' },
      };

      const session = await client.createSession(sessionData);

      expect(session).toBeDefined();
      expect(session.id).toBe('sess_new123');
      expect(session.title).toBe('New Session');
      expect(session.rootDirectory).toBe('/path/to/repo');
      expect(session.baseBranch).toBe('develop');
    });

    it('should list all sessions', async () => {
      const sessions = await client.listSessions();

      expect(sessions).toBeDefined();
      expect(Array.isArray(sessions)).toBe(true);
      expect(sessions.length).toBeGreaterThan(0);
      expect(sessions[0].id).toBe('sess_test123');
    });

    it('should get session by id', async () => {
      const session = await client.getSession('sess_test123');

      expect(session).toBeDefined();
      expect(session.id).toBe('sess_test123');
      expect(session.title).toBe('Test Session');
    });

    it('should update session', async () => {
      const updateData = {
        title: 'Updated Session',
        metadata: { updated: true },
      };

      const session = await client.updateSession('sess_test123', updateData);

      expect(session).toBeDefined();
      expect(session.title).toBe('Updated Session');
    });

    it('should delete session', async () => {
      await expect(client.deleteSession('sess_test123')).resolves.toBeUndefined();
    });

    it('should delete session with git branch', async () => {
      await expect(client.deleteSession('sess_test123', true)).resolves.toBeUndefined();
    });

    it('should switch active session', async () => {
      const session = await client.switchSession('sess_test123');

      expect(session).toBeDefined();
      expect(session.id).toBe('sess_test123');
      expect(session.isActive).toBe(true);
    });

    it('should handle 404 errors for get session', async () => {
      await expect(client.getSession('sess_notfound')).rejects.toThrow(NotFoundError);
    });

    it('should handle 404 errors for delete session', async () => {
      await expect(client.deleteSession('sess_notfound')).rejects.toThrow(NotFoundError);
    });

    it('should handle 404 errors for switch session', async () => {
      await expect(client.switchSession('sess_notfound')).rejects.toThrow(NotFoundError);
    });
  });

  describe('Message Management', () => {
    it('should get messages for session', async () => {
      const messages = await client.getMessages('sess_test123');

      expect(messages).toBeDefined();
      expect(Array.isArray(messages)).toBe(true);
    });

    it('should send message and receive response', async () => {
      const response = await client.sendMessage('sess_test123', 'Hello Claude');

      expect(response).toBeDefined();
      expect(response.userMessage).toBeDefined();
      expect(response.assistantMessage).toBeDefined();
      expect(response.userMessage.role).toBe('user');
      expect(response.userMessage.content).toBe('Hello Claude');
      expect(response.assistantMessage.role).toBe('assistant');
    });

    it('should handle empty message error', async () => {
      await expect(client.sendMessage('sess_test123', '')).rejects.toThrow(ValidationError);
    });

    it('should handle validation error with issues', async () => {
      try {
        await client.sendMessage('sess_test123', '');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        if (error instanceof ValidationError) {
          expect(error.issues).toBeDefined();
          expect(error.statusCode).toBe(400);
        }
      }
    });
  });

  describe('Settings Management', () => {
    it('should get all settings', async () => {
      const settings = await client.getAllSettings();

      expect(settings).toBeDefined();
      expect(Array.isArray(settings)).toBe(true);
      expect(settings.length).toBeGreaterThan(0);
    });

    it('should get setting by key', async () => {
      const setting = await client.getSetting('api.baseUrl');

      expect(setting).toBeDefined();
      expect(setting.key).toBe('api.baseUrl');
      expect(setting.value).toBe('http://localhost:3000');
    });

    it('should set setting', async () => {
      const setting = await client.setSetting('api.timeout', 5000);

      expect(setting).toBeDefined();
      expect(setting.key).toBe('api.timeout');
      expect(setting.value).toBe(5000);
    });

    it('should delete setting', async () => {
      await expect(client.deleteSetting('api.timeout')).resolves.toBeUndefined();
    });

    it('should handle setting not found', async () => {
      await expect(client.getSetting('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should handle delete non-existent setting', async () => {
      await expect(client.deleteSetting('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('Git Operations', () => {
    it('should merge branch successfully', async () => {
      await expect(client.mergeBranch('sess_test123', 'main')).resolves.toBeUndefined();
    });

    it('should merge branch with default target', async () => {
      await expect(client.mergeBranch('sess_test123')).resolves.toBeUndefined();
    });

    it('should check for conflicts', async () => {
      const result = await client.checkConflicts('sess_test123', 'main');

      expect(result).toBeDefined();
      expect(result.hasConflicts).toBe(false);
    });

    it('should detect conflicts', async () => {
      const result = await client.checkConflicts('sess_conflict', 'main');

      expect(result).toBeDefined();
      expect(result.hasConflicts).toBe(true);
    });

    it('should delete branch', async () => {
      await expect(client.deleteBranch('sess_test123')).resolves.toBeUndefined();
    });

    it('should handle git merge errors', async () => {
      await expect(client.mergeBranch('sess_conflict')).rejects.toThrow(ApiError);
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const health = await client.healthCheck();

      expect(health).toBeDefined();
      expect(health.status).toBe('ok');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      server.use(
        http.get('/api/network-error', () => {
          return HttpResponse.error();
        })
      );

      const customClient = new RestClient({ baseUrl: '/api' });

      await expect(
        customClient.request({
          method: 'GET',
          endpoint: '/network-error',
        })
      ).rejects.toThrow(NetworkError);
    });

    it('should handle timeout errors', async () => {
      const timeoutClient = new RestClient({
        baseUrl: '/api',
        timeout: 100,
      });

      server.use(
        http.get('/api/timeout-test', async () => {
          await new Promise((resolve) => setTimeout(resolve, 500));
          return HttpResponse.json({ data: { status: 'ok' } });
        })
      );

      await expect(
        timeoutClient.request({
          method: 'GET',
          endpoint: '/timeout-test',
        })
      ).rejects.toThrow(TimeoutError);
    });

    it('should retry failed requests', async () => {
      let attempts = 0;

      server.use(
        http.get('/api/retry-test', () => {
          attempts++;
          if (attempts < 3) {
            return HttpResponse.error();
          }
          return HttpResponse.json({ data: { status: 'ok' } });
        })
      );

      const retryClient = new RestClient({
        baseUrl: '/api',
        retryAttempts: 3,
        retryDelay: 10,
      });

      const result = await retryClient.request({
        method: 'GET',
        endpoint: '/retry-test',
      });

      expect(result).toBeDefined();
      expect(attempts).toBe(3);
    });

    it('should not retry on 4xx errors', async () => {
      let attempts = 0;

      server.use(
        http.get('/api/no-retry-test', () => {
          attempts++;
          return HttpResponse.json(
            {
              error: 'ValidationError',
              message: 'Bad request',
              statusCode: 400,
            },
            { status: 400 }
          );
        })
      );

      const retryClient = new RestClient({
        baseUrl: '/api',
        retryAttempts: 3,
        retryDelay: 10,
      });

      await expect(
        retryClient.request({
          method: 'GET',
          endpoint: '/no-retry-test',
        })
      ).rejects.toThrow(ValidationError);

      expect(attempts).toBe(1); // Should not retry
    });

    it('should parse API error responses', async () => {
      server.use(
        http.get('/api/custom-error', () => {
          return HttpResponse.json(
            {
              error: 'CustomError',
              message: 'Custom error message',
              statusCode: 500,
            },
            { status: 500 }
          );
        })
      );

      try {
        await client.request({
          method: 'GET',
          endpoint: '/custom-error',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        if (error instanceof ApiError) {
          expect(error.message).toBe('Custom error message');
          expect(error.statusCode).toBe(500);
          expect(error.errorType).toBe('CustomError');
        }
      }
    });
  });

  describe('Request Configuration', () => {
    it('should use custom base URL', () => {
      const customClient = new RestClient({
        baseUrl: 'http://custom.api.com/api',
      });

      expect((customClient as any).config.baseUrl).toBe('http://custom.api.com/api');
    });

    it('should apply custom timeout', () => {
      const customClient = new RestClient({
        timeout: 60000,
      });

      expect((customClient as any).config.timeout).toBe(60000);
    });

    it('should apply custom retry settings', () => {
      const customClient = new RestClient({
        retryAttempts: 5,
        retryDelay: 2000,
      });

      expect((customClient as any).config.retryAttempts).toBe(5);
      expect((customClient as any).config.retryDelay).toBe(2000);
    });

    it('should merge with default config', () => {
      const customClient = new RestClient({
        timeout: 60000,
      });

      expect((customClient as any).config.baseUrl).toBe('http://localhost:3000/api');
      expect((customClient as any).config.timeout).toBe(60000);
      expect((customClient as any).config.retryAttempts).toBe(3);
    });
  });
});
