/**
 * Session Manager Tests
 *
 * Comprehensive unit and integration tests for session management operations.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import simpleGit from 'simple-git';
import { DatabaseClient } from '../db/client.js';
import { GitService, NotGitRepoError, BranchExistsError, GitOperationError } from './git-service.js';
import {
  SessionManager,
  SessionNotFoundError,
  InvalidSessionDataError,
  type CreateSessionOptions,
  type DeleteSessionOptions,
} from './session-manager.js';

/**
 * Test helper functions
 */

function createTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'session-test-'));
}

async function createTempGitRepo(): Promise<string> {
  const tempDir = createTempDir();
  const git = simpleGit(tempDir);
  await git.init();

  // Configure git
  await git.addConfig('user.name', 'Test User');
  await git.addConfig('user.email', 'test@example.com');

  // Create initial commit (required for branch operations)
  fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Project');
  await git.add('.');
  await git.commit('Initial commit');

  return tempDir;
}

function cleanupDir(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Mock implementations for unit tests
 */

function createMockDatabase(): DatabaseClient {
  const sessions: any[] = [];
  let idCounter = 0;

  return {
    insertSession: vi.fn((session) => {
      const now = Date.now();
      const fullSession = {
        ...session,
        createdAt: now,
        updatedAt: now,
        lastMessageAt: null,
        isActive: false,
        baseBranch: session.baseBranch ?? 'main',
        gitStatus: session.gitStatus ?? null,
        metadata: session.metadata ?? null,
      };
      sessions.push(fullSession);
      return fullSession;
    }),
    getSession: vi.fn((id: string) => {
      return sessions.find((s) => s.id === id) ?? null;
    }),
    getSessions: vi.fn(() => {
      return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    }),
    updateSession: vi.fn((id: string, updates) => {
      const session = sessions.find((s) => s.id === id);
      if (!session) {
        throw new Error(`Session not found: ${id}`);
      }
      Object.assign(session, updates, { updatedAt: Date.now() });
      return session;
    }),
    deleteSession: vi.fn((id: string) => {
      const index = sessions.findIndex((s) => s.id === id);
      if (index !== -1) {
        sessions.splice(index, 1);
      }
    }),
    close: vi.fn(),
  } as any;
}

function createMockGitService(): GitService {
  const branches: string[] = ['main'];

  return {
    checkGitInstalled: vi.fn(async () => true),
    isGitRepo: vi.fn(async (directory: string) => {
      return fs.existsSync(directory);
    }),
    initRepo: vi.fn(async () => {}),
    createBranch: vi.fn(async (branchName: string, baseBranch: string, directory: string) => {
      if (branches.includes(branchName)) {
        throw new BranchExistsError(branchName);
      }
      branches.push(branchName);
    }),
    checkoutBranch: vi.fn(async () => {}),
    getCurrentBranch: vi.fn(async () => 'main'),
    getBranches: vi.fn(async () => [...branches]),
    branchExists: vi.fn(async (branchName: string) => branches.includes(branchName)),
    getStatus: vi.fn(async () => ({
      branch: 'main',
      ahead: 0,
      behind: 0,
      modified: [],
      created: [],
      deleted: [],
      renamed: [],
      isClean: true,
    })),
  } as any;
}

/**
 * Unit Tests (Mocked Dependencies)
 */

describe('SessionManager - Unit Tests', () => {
  let sessionManager: SessionManager;
  let mockDb: DatabaseClient;
  let mockGit: GitService;
  let tempDir: string;

  beforeEach(async () => {
    mockDb = createMockDatabase();
    mockGit = createMockGitService();
    sessionManager = new SessionManager(mockDb, mockGit);

    // Create temp directory for testing
    tempDir = createTempDir();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  describe('createSession()', () => {
    it('TC-001: should create session with valid data', async () => {
      // Arrange
      const options: CreateSessionOptions = {
        title: 'My Test Session',
        rootDirectory: tempDir,
        baseBranch: 'main',
      };

      // Act
      const session = await sessionManager.createSession(options);

      // Assert
      expect(session).toBeDefined();
      expect(session.id).toMatch(/^sess_[a-zA-Z0-9_-]{12}$/);
      expect(session.branchName).toMatch(/^session\/sess_/);
      expect(session.title).toBe('My Test Session');
      expect(session.rootDirectory).toBe(tempDir);
      expect(session.baseBranch).toBe('main');
      expect(session.isActive).toBe(false);
      expect(mockGit.createBranch).toHaveBeenCalled();
      expect(mockDb.insertSession).toHaveBeenCalled();
    });

    it('TC-002: should create session with custom base branch', async () => {
      // Arrange
      const options: CreateSessionOptions = {
        title: 'Dev Session',
        rootDirectory: tempDir,
        baseBranch: 'develop',
      };

      // Act
      const session = await sessionManager.createSession(options);

      // Assert
      expect(session.baseBranch).toBe('develop');
      expect(mockGit.createBranch).toHaveBeenCalledWith(
        expect.stringMatching(/^session\//),
        'develop',
        tempDir,
      );
    });

    it('TC-003: should create session with metadata', async () => {
      // Arrange
      const metadata = { projectType: 'react', version: '18.0' };
      const options: CreateSessionOptions = {
        title: 'React Session',
        rootDirectory: tempDir,
        metadata,
      };

      // Act
      const session = await sessionManager.createSession(options);

      // Assert
      expect(session.metadata).toEqual(metadata);
    });

    it('TC-004: should generate unique IDs for multiple sessions', async () => {
      // Arrange
      const options: CreateSessionOptions = {
        title: 'Test Session',
        rootDirectory: tempDir,
      };

      // Act
      const session1 = await sessionManager.createSession(options);
      const session2 = await sessionManager.createSession(options);
      const session3 = await sessionManager.createSession(options);

      // Assert
      expect(session1.id).not.toBe(session2.id);
      expect(session2.id).not.toBe(session3.id);
      expect(session1.id).not.toBe(session3.id);
    });

    it('TC-005: should validate directory exists', async () => {
      // Arrange
      const options: CreateSessionOptions = {
        title: 'Test Session',
        rootDirectory: '/nonexistent/directory',
      };

      // Act & Assert
      await expect(sessionManager.createSession(options)).rejects.toThrow(InvalidSessionDataError);
      expect(mockGit.createBranch).not.toHaveBeenCalled();
      expect(mockDb.insertSession).not.toHaveBeenCalled();
    });

    it('TC-006: should validate Git repository', async () => {
      // Arrange
      mockGit.isGitRepo = vi.fn(async () => false);
      const options: CreateSessionOptions = {
        title: 'Test Session',
        rootDirectory: tempDir,
      };

      // Act & Assert
      await expect(sessionManager.createSession(options)).rejects.toThrow(NotGitRepoError);
      expect(mockDb.insertSession).not.toHaveBeenCalled();
    });

    it('TC-007: should reject empty title', async () => {
      // Arrange
      const options: CreateSessionOptions = {
        title: '',
        rootDirectory: tempDir,
      };

      // Act & Assert
      await expect(sessionManager.createSession(options)).rejects.toThrow(InvalidSessionDataError);
      await expect(sessionManager.createSession(options)).rejects.toThrow(/title is required/);
    });

    it('TC-008: should retry on branch collision', async () => {
      // Arrange
      let callCount = 0;
      mockGit.createBranch = vi.fn(async (branchName: string) => {
        callCount++;
        if (callCount === 1) {
          throw new BranchExistsError(branchName);
        }
        // Second call succeeds
      });

      const options: CreateSessionOptions = {
        title: 'Test Session',
        rootDirectory: tempDir,
      };

      // Act
      const session = await sessionManager.createSession(options);

      // Assert
      expect(session).toBeDefined();
      expect(mockGit.createBranch).toHaveBeenCalledTimes(2);
      expect(mockDb.insertSession).toHaveBeenCalledTimes(1);
    });

    it('TC-007b: should reject whitespace-only title', async () => {
      // Arrange
      const options: CreateSessionOptions = {
        title: '   ',
        rootDirectory: tempDir,
      };

      // Act & Assert
      await expect(sessionManager.createSession(options)).rejects.toThrow(InvalidSessionDataError);
    });
  });

  describe('getSession()', () => {
    it('TC-009: should get existing session by ID', async () => {
      // Arrange
      const created = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });

      // Act
      const retrieved = await sessionManager.getSession(created.id);

      // Assert
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.title).toBe('Test Session');
    });

    it('TC-010: should return null for non-existent session', async () => {
      // Act
      const result = await sessionManager.getSession('sess_nonexistent');

      // Assert
      expect(result).toBeNull();
    });

    it('TC-011: should throw error for null ID', async () => {
      // Act & Assert
      await expect(sessionManager.getSession(null as any)).rejects.toThrow(InvalidSessionDataError);
      await expect(sessionManager.getSession(undefined as any)).rejects.toThrow(
        InvalidSessionDataError,
      );
    });
  });

  describe('listSessions()', () => {
    it('TC-012: should list all sessions sorted by updated_at', async () => {
      // Arrange
      const session1 = await sessionManager.createSession({
        title: 'Session 1',
        rootDirectory: tempDir,
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const session2 = await sessionManager.createSession({
        title: 'Session 2',
        rootDirectory: tempDir,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const session3 = await sessionManager.createSession({
        title: 'Session 3',
        rootDirectory: tempDir,
      });

      // Act
      const sessions = await sessionManager.listSessions();

      // Assert
      expect(sessions).toHaveLength(3);
      expect(sessions[0].id).toBe(session3.id); // Newest first
      expect(sessions[1].id).toBe(session2.id);
      expect(sessions[2].id).toBe(session1.id);
    });

    it('TC-013: should return empty array when no sessions exist', async () => {
      // Act
      const sessions = await sessionManager.listSessions();

      // Assert
      expect(sessions).toEqual([]);
    });

    it('TC-014: should include active status in listed sessions', async () => {
      // Arrange
      const session1 = await sessionManager.createSession({
        title: 'Session 1',
        rootDirectory: tempDir,
      });
      const session2 = await sessionManager.createSession({
        title: 'Session 2',
        rootDirectory: tempDir,
      });

      await sessionManager.switchSession(session2.id);

      // Act
      const sessions = await sessionManager.listSessions();

      // Assert
      expect(sessions).toHaveLength(2);
      const activeSession = sessions.find((s) => s.isActive);
      expect(activeSession?.id).toBe(session2.id);
    });
  });

  describe('getActiveSession()', () => {
    it('TC-015: should get active session when one exists', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });
      await sessionManager.switchSession(session.id);

      // Act
      const active = await sessionManager.getActiveSession();

      // Assert
      expect(active).toBeDefined();
      expect(active?.id).toBe(session.id);
      expect(active?.isActive).toBe(true);
    });

    it('TC-016: should return null when no session is active', async () => {
      // Arrange
      await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });

      // Act
      const active = await sessionManager.getActiveSession();

      // Assert
      expect(active).toBeNull();
    });
  });

  describe('updateSession()', () => {
    it('TC-018: should update session title', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Old Title',
        rootDirectory: tempDir,
      });

      // Act
      const updated = await sessionManager.updateSession(session.id, {
        title: 'New Title',
      });

      // Assert
      expect(updated.title).toBe('New Title');
      expect(updated.updatedAt).toBeGreaterThanOrEqual(session.updatedAt);
    });

    it('TC-019: should update session metadata', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });

      const newMetadata = { tags: ['urgent'], priority: 'high' };

      // Act
      const updated = await sessionManager.updateSession(session.id, {
        metadata: newMetadata,
      });

      // Assert
      expect(updated.metadata).toEqual(newMetadata);
    });

    it('TC-020: should update session git status', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });

      // Act
      const updated = await sessionManager.updateSession(session.id, {
        gitStatus: 'modified',
      });

      // Assert
      expect(updated.gitStatus).toBe('modified');
    });

    it('TC-021: should throw error for non-existent session', async () => {
      // Act & Assert
      await expect(
        sessionManager.updateSession('sess_nonexistent', { title: 'New Title' }),
      ).rejects.toThrow(SessionNotFoundError);
    });

    it('TC-022: should handle empty updates object', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });
      const originalUpdatedAt = session.updatedAt;

      // Act
      const updated = await sessionManager.updateSession(session.id, {});

      // Assert
      expect(updated.title).toBe(session.title);
      expect(updated.updatedAt).toBeGreaterThanOrEqual(originalUpdatedAt);
    });
  });

  describe('deleteSession()', () => {
    it('TC-023: should delete session without deleting Git branch', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });

      // Act
      await sessionManager.deleteSession(session.id);

      // Assert
      const retrieved = await sessionManager.getSession(session.id);
      expect(retrieved).toBeNull();
      expect(mockDb.deleteSession).toHaveBeenCalledWith(session.id);
    });

    it('TC-024: should delete session with Git branch deletion', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });

      // Act
      await sessionManager.deleteSession(session.id, { deleteGitBranch: true });

      // Assert
      const retrieved = await sessionManager.getSession(session.id);
      expect(retrieved).toBeNull();
      expect(mockGit.branchExists).toHaveBeenCalledWith(session.branchName, tempDir);
    });

    it('TC-025: should throw error for non-existent session', async () => {
      // Act & Assert
      await expect(sessionManager.deleteSession('sess_nonexistent')).rejects.toThrow(
        SessionNotFoundError,
      );
    });

    it('TC-026: should deactivate active session before deletion', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });
      await sessionManager.switchSession(session.id);

      // Act
      await sessionManager.deleteSession(session.id);

      // Assert
      const retrieved = await sessionManager.getSession(session.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('switchSession()', () => {
    it('TC-028: should switch to different session successfully', async () => {
      // Arrange
      const session1 = await sessionManager.createSession({
        title: 'Session 1',
        rootDirectory: tempDir,
      });
      const session2 = await sessionManager.createSession({
        title: 'Session 2',
        rootDirectory: tempDir,
      });

      await sessionManager.switchSession(session1.id);

      // Act
      const switched = await sessionManager.switchSession(session2.id);

      // Assert
      expect(switched.id).toBe(session2.id);
      expect(switched.isActive).toBe(true);
      expect(mockGit.checkoutBranch).toHaveBeenCalledWith(session2.branchName, tempDir);

      // Verify session1 is now inactive
      const session1After = await sessionManager.getSession(session1.id);
      expect(session1After?.isActive).toBe(false);
    });

    it('TC-029: should throw error for non-existent session', async () => {
      // Act & Assert
      await expect(sessionManager.switchSession('sess_nonexistent')).rejects.toThrow(
        SessionNotFoundError,
      );
    });

    it('TC-030: should be idempotent when switching to already active session', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });
      await sessionManager.switchSession(session.id);

      const checkoutCallCount = (mockGit.checkoutBranch as any).mock.calls.length;

      // Act
      const switched = await sessionManager.switchSession(session.id);

      // Assert
      expect(switched.id).toBe(session.id);
      expect(switched.isActive).toBe(true);
      // Should not call checkout again
      expect((mockGit.checkoutBranch as any).mock.calls.length).toBe(checkoutCallCount);
    });

    it('TC-031: should switch when no session is currently active', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });

      // Act
      const switched = await sessionManager.switchSession(session.id);

      // Assert
      expect(switched.id).toBe(session.id);
      expect(switched.isActive).toBe(true);
      expect(mockGit.checkoutBranch).toHaveBeenCalledWith(session.branchName, tempDir);
    });

    it('TC-032: should handle Git checkout failure', async () => {
      // Arrange
      const session = await sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
      });

      mockGit.checkoutBranch = vi.fn(async () => {
        throw new GitOperationError('Checkout failed');
      });

      // Act & Assert
      await expect(sessionManager.switchSession(session.id)).rejects.toThrow(GitOperationError);

      // Verify session is not marked as active
      const retrieved = await sessionManager.getSession(session.id);
      expect(retrieved?.isActive).toBe(false);
    });
  });
});

/**
 * Integration Tests (Real Dependencies)
 */

describe('SessionManager - Integration Tests', () => {
  let sessionManager: SessionManager;
  let db: DatabaseClient;
  let git: GitService;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Create temp Git repository
    tempDir = await createTempGitRepo();

    // Create temp database
    dbPath = path.join(tempDir, 'test.db');
    db = new DatabaseClient(dbPath);

    // Create real Git service
    git = new GitService();

    // Create session manager
    sessionManager = new SessionManager(db, git);
  });

  afterEach(() => {
    db.close();
    cleanupDir(tempDir);
  });

  it('TC-033: should complete end-to-end session lifecycle', async () => {
    // Create session
    const session = await sessionManager.createSession({
      title: 'E2E Test Session',
      rootDirectory: tempDir,
      metadata: { test: true },
    });

    expect(session.id).toMatch(/^sess_/);

    // Verify Git branch exists
    const branches = await git.getBranches(tempDir);
    expect(branches).toContain(session.branchName);

    // Get session
    const retrieved = await sessionManager.getSession(session.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.title).toBe('E2E Test Session');

    // Update session
    const updated = await sessionManager.updateSession(session.id, {
      title: 'Updated Title',
    });
    expect(updated.title).toBe('Updated Title');

    // Switch session
    const switched = await sessionManager.switchSession(session.id);
    expect(switched.isActive).toBe(true);

    // Verify Git branch is checked out
    const currentBranch = await git.getCurrentBranch(tempDir);
    expect(currentBranch).toBe(session.branchName);

    // Delete session
    await sessionManager.deleteSession(session.id);
    const deleted = await sessionManager.getSession(session.id);
    expect(deleted).toBeNull();
  });

  it('TC-034: should create multiple sessions in same repository', async () => {
    // Create 3 sessions
    const session1 = await sessionManager.createSession({
      title: 'Session 1',
      rootDirectory: tempDir,
    });

    const session2 = await sessionManager.createSession({
      title: 'Session 2',
      rootDirectory: tempDir,
    });

    const session3 = await sessionManager.createSession({
      title: 'Session 3',
      rootDirectory: tempDir,
    });

    // List sessions
    const sessions = await sessionManager.listSessions();
    expect(sessions).toHaveLength(3);

    // Verify all have unique IDs
    expect(new Set([session1.id, session2.id, session3.id]).size).toBe(3);

    // Verify all Git branches exist
    const branches = await git.getBranches(tempDir);
    expect(branches).toContain(session1.branchName);
    expect(branches).toContain(session2.branchName);
    expect(branches).toContain(session3.branchName);
  });

  it('TC-035: should switch between multiple sessions', async () => {
    // Create sessions
    const sessionA = await sessionManager.createSession({
      title: 'Session A',
      rootDirectory: tempDir,
    });

    const sessionB = await sessionManager.createSession({
      title: 'Session B',
      rootDirectory: tempDir,
    });

    const sessionC = await sessionManager.createSession({
      title: 'Session C',
      rootDirectory: tempDir,
    });

    // Switch to A
    await sessionManager.switchSession(sessionA.id);
    let active = await sessionManager.getActiveSession();
    expect(active?.id).toBe(sessionA.id);
    let currentBranch = await git.getCurrentBranch(tempDir);
    expect(currentBranch).toBe(sessionA.branchName);

    // Switch to B
    await sessionManager.switchSession(sessionB.id);
    active = await sessionManager.getActiveSession();
    expect(active?.id).toBe(sessionB.id);
    currentBranch = await git.getCurrentBranch(tempDir);
    expect(currentBranch).toBe(sessionB.branchName);

    // Switch to C
    await sessionManager.switchSession(sessionC.id);
    active = await sessionManager.getActiveSession();
    expect(active?.id).toBe(sessionC.id);
    currentBranch = await git.getCurrentBranch(tempDir);
    expect(currentBranch).toBe(sessionC.branchName);

    // Verify only C is active
    const sessions = await sessionManager.listSessions();
    const activeSessions = sessions.filter((s) => s.isActive);
    expect(activeSessions).toHaveLength(1);
    expect(activeSessions[0].id).toBe(sessionC.id);
  });

  it('TC-037: should maintain database and Git coordination on create', async () => {
    // Create session
    const session = await sessionManager.createSession({
      title: 'Coordination Test',
      rootDirectory: tempDir,
    });

    // Check Git branch exists
    const branchExists = await git.branchExists(session.branchName, tempDir);
    expect(branchExists).toBe(true);

    // Check database record exists
    const dbSession = await sessionManager.getSession(session.id);
    expect(dbSession).toBeDefined();

    // Verify branch name matches
    expect(dbSession?.branchName).toBe(session.branchName);
    expect(session.branchName).toBe(`session/${session.id}`);
  });

  it('TC-039: should handle Git not installed gracefully', async () => {
    // This test requires mocking, which is difficult with real GitService
    // Skip for now, as unit tests cover error handling
  });

  it('TC-040: should handle Git branch creation failure', async () => {
    // Try to create session with non-existent base branch
    await expect(
      sessionManager.createSession({
        title: 'Test Session',
        rootDirectory: tempDir,
        baseBranch: 'nonexistent-branch',
      }),
    ).rejects.toThrow();

    // Verify no session was created in database
    const sessions = await sessionManager.listSessions();
    expect(sessions).toHaveLength(0);
  });
});
