/**
 * Sessions Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import simpleGit from 'simple-git';

describe('Sessions Routes', () => {
  let server: FastifyInstance;
  let testDbPath: string;
  let testRepoPath: string;

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
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    if (testDbPath && fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (testRepoPath && fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  describe('POST /api/sessions', () => {
    it('should create a new session with valid data', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: testRepoPath,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.session).toBeDefined();
      expect(body.data.session.title).toBe('Test Session');
      expect(body.data.session.rootDirectory).toBe(testRepoPath);
      expect(body.data.session.id).toMatch(/^sess_[a-zA-Z0-9_-]{12}$/);
      expect(body.data.session.branchName).toMatch(/^session\/sess_/);
    });

    it('should create session with optional baseBranch and metadata', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: testRepoPath,
          baseBranch: 'main',
          metadata: { author: 'test-user' },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.data.session.baseBranch).toBe('main');
      expect(body.data.session.metadata).toEqual({ author: 'test-user' });
    });

    it('should reject request with missing title', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          rootDirectory: testRepoPath,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
    });

    it('should reject request with empty title', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: '',
          rootDirectory: testRepoPath,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
    });

    it('should reject request with non-existent directory', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: '/does/not/exist',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('InvalidSessionDataError');
    });

    it('should reject request with non-Git directory', async () => {
      const nonGitDir = path.join(os.tmpdir(), `non-git-${Date.now()}`);
      fs.mkdirSync(nonGitDir, { recursive: true });

      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: nonGitDir,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('NotGitRepoError');

      fs.rmSync(nonGitDir, { recursive: true, force: true });
    });
  });

  describe('GET /api/sessions', () => {
    it('should return empty array when no sessions exist', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.sessions).toEqual([]);
    });

    it('should return all sessions', async () => {
      // Create two sessions
      await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Session 1',
          rootDirectory: testRepoPath,
        },
      });

      await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Session 2',
          rootDirectory: testRepoPath,
        },
      });

      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.sessions).toHaveLength(2);
      expect(body.data.sessions[0].title).toBe('Session 2'); // Most recent first
      expect(body.data.sessions[1].title).toBe('Session 1');
    });
  });

  describe('GET /api/sessions/:id', () => {
    it('should return specific session', async () => {
      // Create session
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: testRepoPath,
        },
      });

      const { id } = JSON.parse(createResponse.body).data.session;

      // Get session
      const response = await server.inject({
        method: 'GET',
        url: `/api/sessions/${id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.session.id).toBe(id);
      expect(body.data.session.title).toBe('Test Session');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions/sess_nonexistent1',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('SessionNotFoundError');
    });

    it('should return 400 for invalid session ID format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions/invalid-id',
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('PATCH /api/sessions/:id', () => {
    it('should update session title', async () => {
      // Create session
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Original Title',
          rootDirectory: testRepoPath,
        },
      });

      const { id } = JSON.parse(createResponse.body).data.session;

      // Update session
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/sessions/${id}`,
        payload: {
          title: 'Updated Title',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.session.title).toBe('Updated Title');
    });

    it('should update session metadata', async () => {
      // Create session
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: testRepoPath,
        },
      });

      const { id } = JSON.parse(createResponse.body).data.session;

      // Update metadata
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/sessions/${id}`,
        payload: {
          metadata: { key: 'value' },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.session.metadata).toEqual({ key: 'value' });
    });

    it('should return 404 for non-existent session', async () => {
      const response = await server.inject({
        method: 'PATCH',
        url: '/api/sessions/sess_nonexistent1',
        payload: {
          title: 'New Title',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('SessionNotFoundError');
    });

    it('should reject empty title', async () => {
      // Create session
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: testRepoPath,
        },
      });

      const { id } = JSON.parse(createResponse.body).data.session;

      // Try to update with empty title
      const response = await server.inject({
        method: 'PATCH',
        url: `/api/sessions/${id}`,
        payload: {
          title: '',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
    });
  });

  describe('DELETE /api/sessions/:id', () => {
    it('should delete session', async () => {
      // Create session
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: testRepoPath,
        },
      });

      const { id } = JSON.parse(createResponse.body).data.session;

      // Delete session
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/sessions/${id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);

      // Verify session is deleted
      const getResponse = await server.inject({
        method: 'GET',
        url: `/api/sessions/${id}`,
      });
      expect(getResponse.statusCode).toBe(404);
    });

    it('should delete active session', async () => {
      // Create and switch to session
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: testRepoPath,
        },
      });

      const { id } = JSON.parse(createResponse.body).data.session;

      await server.inject({
        method: 'POST',
        url: `/api/sessions/${id}/switch`,
      });

      // Delete active session
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/sessions/${id}`,
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/sessions/sess_nonexistent1',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('SessionNotFoundError');
    });
  });

  describe('POST /api/sessions/:id/switch', () => {
    it('should switch to session', async () => {
      // Create two sessions
      const response1 = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Session 1',
          rootDirectory: testRepoPath,
        },
      });
      const id1 = JSON.parse(response1.body).data.session.id;

      const response2 = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Session 2',
          rootDirectory: testRepoPath,
        },
      });
      const id2 = JSON.parse(response2.body).data.session.id;

      // Switch to session 1
      await server.inject({
        method: 'POST',
        url: `/api/sessions/${id1}/switch`,
      });

      // Switch to session 2
      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${id2}/switch`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.session.id).toBe(id2);
      expect(body.data.session.isActive).toBe(true);

      // Verify session 1 is inactive
      const getResponse = await server.inject({
        method: 'GET',
        url: `/api/sessions/${id1}`,
      });
      const session1 = JSON.parse(getResponse.body).data.session;
      expect(session1.isActive).toBe(false);
    });

    it('should be idempotent when switching to already active session', async () => {
      // Create session
      const createResponse = await server.inject({
        method: 'POST',
        url: '/api/sessions',
        payload: {
          title: 'Test Session',
          rootDirectory: testRepoPath,
        },
      });

      const { id } = JSON.parse(createResponse.body).data.session;

      // Switch to session
      await server.inject({
        method: 'POST',
        url: `/api/sessions/${id}/switch`,
      });

      // Switch again
      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${id}/switch`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.session.isActive).toBe(true);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions/sess_nonexistent1/switch',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('SessionNotFoundError');
    });
  });
});
