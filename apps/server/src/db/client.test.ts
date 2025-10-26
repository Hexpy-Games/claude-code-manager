import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseClient } from './client.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('DatabaseClient', () => {
  describe('constructor', () => {
    it('should create database file at specified path', () => {
      // Arrange
      const dbPath = path.join(os.tmpdir(), `test-db-${Date.now()}.sqlite`);

      // Act
      const db = new DatabaseClient(dbPath);

      // Assert
      expect(fs.existsSync(dbPath)).toBe(true);

      // Cleanup
      db.close();
      fs.unlinkSync(dbPath);
    });

    it('should create parent directories if they do not exist', () => {
      // Arrange
      const dbPath = path.join(os.tmpdir(), `nested-${Date.now()}`, 'dirs', 'test.sqlite');

      // Act
      const db = new DatabaseClient(dbPath);

      // Assert
      expect(fs.existsSync(dbPath)).toBe(true);

      // Cleanup
      db.close();
      fs.rmSync(path.dirname(path.dirname(dbPath)), { recursive: true });
    });

    it('should initialize database schema with all tables', () => {
      // Arrange & Act
      const db = new DatabaseClient(':memory:');

      // Assert
      const tables = db.raw
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as any[];

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain('sessions');
      expect(tableNames).toContain('messages');
      expect(tableNames).toContain('session_git_state');
      expect(tableNames).toContain('settings');

      // Cleanup
      db.close();
    });

    it('should enable WAL mode for better concurrency', () => {
      // Arrange - WAL mode doesn't work with :memory:, use temp file
      const dbPath = path.join(os.tmpdir(), `test-wal-${Date.now()}.sqlite`);
      const db = new DatabaseClient(dbPath);

      // Assert
      const result = db.raw.pragma('journal_mode');
      expect(result).toEqual([{ journal_mode: 'wal' }]);

      // Cleanup
      db.close();
      fs.unlinkSync(dbPath);
    });

    it('should enable foreign key constraints', () => {
      // Arrange & Act
      const db = new DatabaseClient(':memory:');

      // Assert
      const result = db.raw.pragma('foreign_keys');
      expect(result).toEqual([{ foreign_keys: 1 }]);

      // Cleanup
      db.close();
    });
  });

  describe('insertSession', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('should insert session and return it with ID', () => {
      // Arrange
      const session = {
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
        baseBranch: 'main',
      };

      // Act
      const result = db.insertSession(session);

      // Assert
      expect(result.id).toBe('sess_test123');
      expect(result.title).toBe('Test Session');
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should throw error when inserting session with duplicate ID', () => {
      // Arrange
      const session = {
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      };
      db.insertSession(session);

      // Act & Assert
      expect(() => db.insertSession(session)).toThrow();
    });

    it('should insert session with default values for optional fields', () => {
      // Arrange
      const session = {
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      };

      // Act
      const result = db.insertSession(session);

      // Assert
      expect(result.baseBranch).toBe('main');
      expect(result.isActive).toBe(false);
      expect(result.gitStatus).toBeNull();
    });
  });

  describe('getSession', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('should return session when it exists', () => {
      // Arrange
      const session = {
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      };
      db.insertSession(session);

      // Act
      const result = db.getSession('sess_test123');

      // Assert
      expect(result).not.toBeNull();
      expect(result?.id).toBe('sess_test123');
      expect(result?.title).toBe('Test Session');
    });

    it('should return null when session does not exist', () => {
      // Act
      const result = db.getSession('nonexistent');

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getSessions', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('should return all sessions ordered by updated_at DESC', async () => {
      // Arrange
      db.insertSession({
        id: 'sess_1',
        title: 'Session 1',
        rootDirectory: '/path1',
        workspacePath: '/tmp/claude-sessions/sess_1/path1',
        branchName: 'session/sess_1',
      });

      // Wait a bit to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      db.insertSession({
        id: 'sess_2',
        title: 'Session 2',
        rootDirectory: '/path2',
        workspacePath: '/tmp/claude-sessions/sess_2/path2',
        branchName: 'session/sess_2',
      });

      // Act
      const result = db.getSessions();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('sess_2'); // Most recent first
    });

    it('should return empty array when no sessions exist', () => {
      // Act
      const result = db.getSessions();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('updateSession', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('should update session and return updated record', async () => {
      // Arrange
      const session = db.insertSession({
        id: 'sess_test123',
        title: 'Original Title',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      });

      // Wait to ensure different timestamp
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Act
      const result = db.updateSession('sess_test123', {
        title: 'Updated Title',
        gitStatus: 'modified',
      });

      // Assert
      expect(result.title).toBe('Updated Title');
      expect(result.gitStatus).toBe('modified');
      expect(result.updatedAt).toBeGreaterThan(session.updatedAt);
    });

    it('should throw error when updating nonexistent session', () => {
      // Act & Assert
      expect(() => db.updateSession('nonexistent', { title: 'New' })).toThrow('Session not found');
    });
  });

  describe('deleteSession', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('should delete session successfully', () => {
      // Arrange
      db.insertSession({
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      });

      // Act
      db.deleteSession('sess_test123');

      // Assert
      const result = db.getSession('sess_test123');
      expect(result).toBeNull();
    });

    it('should cascade delete to messages', () => {
      // Arrange
      db.insertSession({
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      });
      db.insertMessage({
        id: 'msg_1',
        sessionId: 'sess_test123',
        role: 'user',
        content: 'Hello',
      });

      // Act
      db.deleteSession('sess_test123');

      // Assert
      const messages = db.getMessages('sess_test123');
      expect(messages).toHaveLength(0);
    });
  });

  describe('insertMessage', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('should insert message and return it with timestamp', () => {
      // Arrange
      db.insertSession({
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      });

      const message = {
        id: 'msg_1',
        sessionId: 'sess_test123',
        role: 'user' as const,
        content: 'Hello, Claude!',
      };

      // Act
      const result = db.insertMessage(message);

      // Assert
      expect(result.id).toBe('msg_1');
      expect(result.content).toBe('Hello, Claude!');
      expect(result.timestamp).toBeDefined();
    });

    it('should throw error when session does not exist', () => {
      // Arrange
      const message = {
        id: 'msg_1',
        sessionId: 'nonexistent',
        role: 'user' as const,
        content: 'Hello',
      };

      // Act & Assert
      expect(() => db.insertMessage(message)).toThrow();
    });

    it('should store and retrieve tool calls as JSON', () => {
      // Arrange
      db.insertSession({
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      });

      const toolCalls = [{ tool: 'write_file', args: { path: 'test.ts' } }];

      const message = {
        id: 'msg_1',
        sessionId: 'sess_test123',
        role: 'assistant' as const,
        content: 'Creating file...',
        toolCalls,
      };

      // Act
      const result = db.insertMessage(message);

      // Assert
      expect(result.toolCalls).toEqual(toolCalls);
    });
  });

  describe('getMessages', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('should return messages ordered by timestamp ASC', async () => {
      // Arrange
      db.insertSession({
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      });

      db.insertMessage({
        id: 'msg_1',
        sessionId: 'sess_test123',
        role: 'user',
        content: 'First',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      db.insertMessage({
        id: 'msg_2',
        sessionId: 'sess_test123',
        role: 'assistant',
        content: 'Second',
      });

      // Act
      const result = db.getMessages('sess_test123');

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('First');
      expect(result[1].content).toBe('Second');
    });

    it('should limit number of messages returned', () => {
      // Arrange
      db.insertSession({
        id: 'sess_test123',
        title: 'Test Session',
        rootDirectory: '/test/path',
        workspacePath: '/tmp/claude-sessions/sess_test123/test',
        branchName: 'session/sess_test123',
      });

      for (let i = 0; i < 10; i++) {
        db.insertMessage({
          id: `msg_${i}`,
          sessionId: 'sess_test123',
          role: 'user',
          content: `Message ${i}`,
        });
      }

      // Act
      const result = db.getMessages('sess_test123', 5);

      // Assert
      expect(result).toHaveLength(5);
    });
  });

  describe('Settings Operations', () => {
    let db: DatabaseClient;

    beforeEach(() => {
      db = new DatabaseClient(':memory:');
    });

    afterEach(() => {
      db.close();
    });

    it('should set and get setting', () => {
      // Act
      db.setSetting('apiKey', 'sk-test123');
      const result = db.getSetting('apiKey');

      // Assert
      expect(result?.value).toBe('sk-test123');
    });

    it('should update existing setting', () => {
      // Arrange
      db.setSetting('model', 'claude-sonnet-4');

      // Act
      db.setSetting('model', 'claude-sonnet-4.5');
      const result = db.getSetting('model');

      // Assert
      expect(result?.value).toBe('claude-sonnet-4.5');
    });

    it('should handle global and workspace-scoped settings', () => {
      // Act
      db.setSetting('theme', 'dark', 'global');
      db.setSetting('theme', 'light', 'workspace:/test/path');

      const globalSetting = db.getSetting('theme', 'global');
      const workspaceSetting = db.getSetting('theme', 'workspace:/test/path');

      // Assert
      expect(globalSetting?.value).toBe('dark');
      expect(workspaceSetting?.value).toBe('light');
    });
  });

  describe('close', () => {
    it('should close database connection', () => {
      // Arrange
      const db = new DatabaseClient(':memory:');

      // Act
      db.close();

      // Assert
      expect(() => db.getSessions()).toThrow();
    });
  });

  describe('Integration: Full Lifecycle', () => {
    let dbPath: string;
    let db: DatabaseClient;

    beforeEach(() => {
      dbPath = path.join(os.tmpdir(), `test-integration-${Date.now()}.sqlite`);
      db = new DatabaseClient(dbPath);
    });

    afterEach(() => {
      db.close();
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    });

    it('should handle complete session workflow', () => {
      // Create session
      const session = db.insertSession({
        id: 'sess_integration',
        title: 'Integration Test Session',
        rootDirectory: '/test/integration',
        workspacePath: '/tmp/claude-sessions/sess_integration/integration',
        branchName: 'session/sess_integration',
      });

      expect(session.id).toBe('sess_integration');

      // Add messages
      db.insertMessage({
        id: 'msg_1',
        sessionId: 'sess_integration',
        role: 'user',
        content: 'Test message',
      });

      // Query messages
      const messages = db.getMessages('sess_integration');
      expect(messages).toHaveLength(1);

      // Update session
      db.updateSession('sess_integration', {
        title: 'Updated Title',
        gitStatus: 'modified',
      });

      // Verify update
      const updated = db.getSession('sess_integration');
      expect(updated?.title).toBe('Updated Title');

      // Delete session
      db.deleteSession('sess_integration');

      // Verify deletion
      const deleted = db.getSession('sess_integration');
      expect(deleted).toBeNull();
    });
  });
});
