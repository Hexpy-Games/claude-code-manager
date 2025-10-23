/**
 * Settings Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

describe('Settings Routes', () => {
  let server: FastifyInstance;
  let testDbPath: string;

  beforeEach(async () => {
    // Create temp database
    testDbPath = path.join(os.tmpdir(), `test-db-${Date.now()}.sqlite`);

    // Create server
    server = await createServer({
      databasePath: testDbPath,
      claudeApiKey: 'test-api-key',
      logLevel: 'silent',
    });
  });

  afterEach(async () => {
    await server.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  });

  describe('GET /api/settings/:key', () => {
    it('should return setting value', async () => {
      // First set a setting
      await server.inject({
        method: 'PUT',
        url: '/api/settings/theme',
        payload: {
          value: 'dark',
        },
      });

      // Get the setting
      const response = await server.inject({
        method: 'GET',
        url: '/api/settings/theme',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.key).toBe('theme');
      expect(body.data.value).toBe('dark');
    });

    it('should return 404 for non-existent setting', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/settings/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('SettingNotFoundError');
    });

    it('should handle complex setting values', async () => {
      // Set complex value
      await server.inject({
        method: 'PUT',
        url: '/api/settings/config',
        payload: {
          value: {
            notifications: true,
            autoSave: 5000,
            theme: { mode: 'dark', accent: 'blue' },
          },
        },
      });

      // Get the setting
      const response = await server.inject({
        method: 'GET',
        url: '/api/settings/config',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toEqual({
        notifications: true,
        autoSave: 5000,
        theme: { mode: 'dark', accent: 'blue' },
      });
    });

    it('should handle array values', async () => {
      // Set array value
      await server.inject({
        method: 'PUT',
        url: '/api/settings/favorites',
        payload: {
          value: ['item1', 'item2', 'item3'],
        },
      });

      // Get the setting
      const response = await server.inject({
        method: 'GET',
        url: '/api/settings/favorites',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toEqual(['item1', 'item2', 'item3']);
    });
  });

  describe('PUT /api/settings/:key', () => {
    it('should create new setting', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/theme',
        payload: {
          value: 'dark',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.key).toBe('theme');
      expect(body.data.value).toBe('dark');
    });

    it('should update existing setting', async () => {
      // Create setting
      await server.inject({
        method: 'PUT',
        url: '/api/settings/theme',
        payload: {
          value: 'light',
        },
      });

      // Update setting
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/theme',
        payload: {
          value: 'dark',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toBe('dark');
    });

    it('should accept string values', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/language',
        payload: {
          value: 'en',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toBe('en');
    });

    it('should accept number values', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/fontSize',
        payload: {
          value: 14,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toBe(14);
    });

    it('should accept boolean values', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/autoSave',
        payload: {
          value: true,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toBe(true);
    });

    it('should accept null values', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/temp',
        payload: {
          value: null,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toBe(null);
    });

    it('should accept object values', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/preferences',
        payload: {
          value: {
            theme: 'dark',
            fontSize: 14,
            notifications: true,
          },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toEqual({
        theme: 'dark',
        fontSize: 14,
        notifications: true,
      });
    });

    it('should accept array values', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/recentFiles',
        payload: {
          value: ['/path/1', '/path/2', '/path/3'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.value).toEqual(['/path/1', '/path/2', '/path/3']);
    });

    it('should reject request without value field', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/theme',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
    });

    it('should handle special characters in key', async () => {
      const response = await server.inject({
        method: 'PUT',
        url: '/api/settings/user.preferences.theme',
        payload: {
          value: 'dark',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.key).toBe('user.preferences.theme');
    });

    it('should handle multiple settings independently', async () => {
      // Set multiple settings
      await server.inject({
        method: 'PUT',
        url: '/api/settings/theme',
        payload: { value: 'dark' },
      });

      await server.inject({
        method: 'PUT',
        url: '/api/settings/fontSize',
        payload: { value: 14 },
      });

      await server.inject({
        method: 'PUT',
        url: '/api/settings/autoSave',
        payload: { value: true },
      });

      // Get each setting
      const response1 = await server.inject({
        method: 'GET',
        url: '/api/settings/theme',
      });
      expect(JSON.parse(response1.body).data.value).toBe('dark');

      const response2 = await server.inject({
        method: 'GET',
        url: '/api/settings/fontSize',
      });
      expect(JSON.parse(response2.body).data.value).toBe(14);

      const response3 = await server.inject({
        method: 'GET',
        url: '/api/settings/autoSave',
      });
      expect(JSON.parse(response3.body).data.value).toBe(true);
    });
  });
});
