/**
 * Git Operations Routes Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createServer } from '../server.js';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import simpleGit from 'simple-git';

describe('Git Operations Routes', () => {
  let server: FastifyInstance;
  let testDbPath: string;
  let testRepoPath: string;
  let sessionId: string;

  beforeEach(async () => {
    // Create temp database with unique name
    testDbPath = path.join(
      os.tmpdir(),
      `test-db-${Date.now()}-${Math.random().toString(36).substring(7)}.sqlite`,
    );

    // Create temp Git repository with unique name
    testRepoPath = path.join(
      os.tmpdir(),
      `test-repo-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    );

    // Ensure clean state - remove if exists
    if (fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    }

    fs.mkdirSync(testRepoPath, { recursive: true });

    const git = simpleGit(testRepoPath);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');

    // Create initial commit on main branch
    fs.writeFileSync(path.join(testRepoPath, 'README.md'), '# Test Repo');
    await git.add('.');
    await git.commit('Initial commit');

    // Create server
    server = await createServer({
      databasePath: testDbPath,
      claudeApiKey: 'test-api-key',
      logLevel: 'silent',
    });

    // Create a test session (which creates a branch)
    const createResponse = await server.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {
        title: 'Test Session',
        rootDirectory: testRepoPath,
      },
    });

    sessionId = JSON.parse(createResponse.body).data.session.id;
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    if (fs.existsSync(testRepoPath)) {
      fs.rmSync(testRepoPath, { recursive: true, force: true });
    }
  });

  describe('POST /api/sessions/:id/git/merge', () => {
    it('should merge session branch into main successfully', async () => {
      // Add a commit to the session branch
      const git = simpleGit(testRepoPath);
      const session = server.db.getSession(sessionId);
      await git.checkout(session!.branchName);
      fs.writeFileSync(path.join(testRepoPath, 'feature.txt'), 'feature content');
      await git.add('.');
      await git.commit('Add feature');

      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/git/merge`,
        payload: {
          targetBranch: 'main',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);

      // Verify merge happened
      await git.checkout('main');
      expect(fs.existsSync(path.join(testRepoPath, 'feature.txt'))).toBe(true);
    });

    it('should default to main branch if targetBranch not specified', async () => {
      // Add a commit to the session branch
      const git = simpleGit(testRepoPath);
      const session = server.db.getSession(sessionId);
      await git.checkout(session!.branchName);
      fs.writeFileSync(path.join(testRepoPath, 'feature.txt'), 'feature content');
      await git.add('.');
      await git.commit('Add feature');

      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/git/merge`,
        payload: {},
      });

      expect(response.statusCode).toBe(200);

      // Verify merge happened on main
      await git.checkout('main');
      expect(fs.existsSync(path.join(testRepoPath, 'feature.txt'))).toBe(true);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions/sess_nonexistent1/git/merge',
        payload: {
          targetBranch: 'main',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('SessionNotFoundError');
    });

    it('should return 400 for invalid session ID format', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/api/sessions/invalid-id/git/merge',
        payload: {
          targetBranch: 'main',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
    });

    it('should handle Git operation errors', async () => {
      // Try to merge to a non-existent target branch
      const response = await server.inject({
        method: 'POST',
        url: `/api/sessions/${sessionId}/git/merge`,
        payload: {
          targetBranch: 'nonexistent-branch',
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitOperationError');
    });
  });

  describe('GET /api/sessions/:id/git/conflicts', () => {
    it('should return false when no conflicts exist', async () => {
      // Add non-conflicting changes to session branch
      const git = simpleGit(testRepoPath);
      const session = server.db.getSession(sessionId);
      await git.checkout(session!.branchName);
      fs.writeFileSync(path.join(testRepoPath, 'new-file.txt'), 'new content');
      await git.add('.');
      await git.commit('Add new file');

      const response = await server.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/git/conflicts`,
        query: {
          targetBranch: 'main',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.hasConflicts).toBe(false);
    });

    it('should return true when conflicts exist', async () => {
      const git = simpleGit(testRepoPath);
      const session = server.db.getSession(sessionId);

      // Create conflicting changes on main
      await git.checkout('main');
      fs.writeFileSync(path.join(testRepoPath, 'conflict.txt'), 'main content');
      await git.add('.');
      await git.commit('Update on main');

      // Create conflicting changes on session branch (from before main's change)
      await git.checkout(session!.branchName);
      await git.raw(['reset', '--hard', 'main~1']); // Go back to before main's commit
      fs.writeFileSync(path.join(testRepoPath, 'conflict.txt'), 'branch content');
      await git.add('.');
      await git.commit('Update on branch');

      const response = await server.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/git/conflicts`,
        query: {
          targetBranch: 'main',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.hasConflicts).toBe(true);
    });

    it('should default to main branch if targetBranch not specified', async () => {
      const response = await server.inject({
        method: 'GET',
        url: `/api/sessions/${sessionId}/git/conflicts`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data).toHaveProperty('hasConflicts');
      expect(typeof body.data.hasConflicts).toBe('boolean');
    });

    it('should return 404 for non-existent session', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions/sess_nonexistent1/git/conflicts',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('SessionNotFoundError');
    });

    it('should return 400 for invalid session ID format', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/sessions/invalid-id/git/conflicts',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
    });
  });

  describe('DELETE /api/sessions/:id/git/branch', () => {
    it('should delete session branch successfully', async () => {
      const git = simpleGit(testRepoPath);
      const session = server.db.getSession(sessionId);
      const branchName = session!.branchName;

      // Verify branch exists
      const branchesBeforeInject = await git.branch();
      expect(branchesBeforeInject.all).toContain(branchName);

      // Checkout to main first (can't delete current branch)
      await git.checkout('main');

      // Delete the branch
      const response = await server.inject({
        method: 'DELETE',
        url: `/api/sessions/${sessionId}/git/branch`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.success).toBe(true);

      // Verify branch is deleted
      const branchesAfter = await git.branch();
      expect(branchesAfter.all).not.toContain(branchName);
    });

    it('should return 404 for non-existent session', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/sessions/sess_nonexistent1/git/branch',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('SessionNotFoundError');
    });

    it('should return 400 for invalid session ID format', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/api/sessions/invalid-id/git/branch',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('ValidationError');
    });

    it('should handle error when branch does not exist', async () => {
      // Delete the branch manually first
      const git = simpleGit(testRepoPath);
      const session = server.db.getSession(sessionId);
      await git.checkout('main');
      await git.deleteLocalBranch(session!.branchName);

      const response = await server.inject({
        method: 'DELETE',
        url: `/api/sessions/${sessionId}/git/branch`,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitOperationError');
    });
  });
});
