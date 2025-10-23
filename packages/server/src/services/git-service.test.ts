/**
 * Git Service Tests
 *
 * Comprehensive unit and integration tests for Git service operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import simpleGit from 'simple-git';
import {
  GitService,
  GitNotInstalledError,
  NotGitRepoError,
  BranchExistsError,
  GitOperationError,
  type GitStatus,
} from './git-service';

/**
 * Test helper functions
 */

async function createTempDir(): Promise<string> {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'git-test-'));
}

async function createTempGitRepo(): Promise<string> {
  const tempDir = await createTempDir();
  const git = simpleGit(tempDir);
  await git.init();
  return tempDir;
}

async function createTempGitRepoWithCommit(): Promise<string> {
  const tempDir = await createTempGitRepo();
  const git = simpleGit(tempDir);

  // Configure git
  await git.addConfig('user.name', 'Test User');
  await git.addConfig('user.email', 'test@example.com');

  // Create initial commit
  fs.writeFileSync(path.join(tempDir, 'test.txt'), 'initial content');
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
 * Unit Tests
 */

describe('GitService', () => {
  let gitService: GitService;

  beforeEach(() => {
    gitService = new GitService();
  });

  describe('checkGitInstalled()', () => {
    it('should return true when Git is installed', async () => {
      // Act
      const result = await gitService.checkGitInstalled();

      // Assert
      expect(result).toBe(true);
    });

    // Note: Testing Git not installed requires mocking, which is harder with simple-git
    // We focus on real Git operations in integration tests
  });

  describe('isGitRepo()', () => {
    let tempDir: string;

    afterEach(() => {
      cleanupDir(tempDir);
    });

    it('should return true for a valid Git repository', async () => {
      // Arrange
      tempDir = await createTempGitRepo();

      // Act
      const result = await gitService.isGitRepo(tempDir);

      // Assert
      expect(result).toBe(true);
    });

    it('should return false for a non-Git directory', async () => {
      // Arrange
      tempDir = await createTempDir();

      // Act
      const result = await gitService.isGitRepo(tempDir);

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for nonexistent directory', async () => {
      // Arrange
      const nonexistentPath = '/path/that/does/not/exist/12345';

      // Act
      const result = await gitService.isGitRepo(nonexistentPath);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('initRepo()', () => {
    let tempDir: string;

    afterEach(() => {
      cleanupDir(tempDir);
    });

    it('should initialize a Git repository', async () => {
      // Arrange
      tempDir = await createTempDir();

      // Act
      await gitService.initRepo(tempDir);

      // Assert
      const isRepo = await gitService.isGitRepo(tempDir);
      expect(isRepo).toBe(true);
    });

    it('should throw error when directory does not exist', async () => {
      // Arrange
      const nonexistentPath = '/path/that/does/not/exist/12345';

      // Act & Assert
      await expect(gitService.initRepo(nonexistentPath)).rejects.toThrow(
        GitOperationError,
      );
    });

    it('should not fail if already a Git repo', async () => {
      // Arrange
      tempDir = await createTempGitRepo();

      // Act & Assert
      await expect(gitService.initRepo(tempDir)).resolves.not.toThrow();
    });
  });

  describe('createBranch()', () => {
    let tempDir: string;

    afterEach(() => {
      cleanupDir(tempDir);
    });

    it('should create a new branch from base branch', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Act
      await gitService.createBranch('feature/test', 'main', tempDir);

      // Assert
      const branches = await gitService.getBranches(tempDir);
      expect(branches).toContain('feature/test');
    });

    it('should throw BranchExistsError when branch already exists', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();
      await gitService.createBranch('feature/test', 'main', tempDir);

      // Act & Assert
      await expect(
        gitService.createBranch('feature/test', 'main', tempDir),
      ).rejects.toThrow(BranchExistsError);
    });

    it('should throw error when base branch does not exist', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Act & Assert
      await expect(
        gitService.createBranch('feature/test', 'nonexistent', tempDir),
      ).rejects.toThrow(GitOperationError);
    });

    it('should throw NotGitRepoError when directory is not a Git repo', async () => {
      // Arrange
      tempDir = await createTempDir();

      // Act & Assert
      await expect(
        gitService.createBranch('feature/test', 'main', tempDir),
      ).rejects.toThrow(NotGitRepoError);
    });

    it('should throw error for empty repository with no commits', async () => {
      // Arrange
      tempDir = await createTempGitRepo();

      // Act & Assert
      await expect(
        gitService.createBranch('feature/test', 'main', tempDir),
      ).rejects.toThrow(GitOperationError);
      await expect(
        gitService.createBranch('feature/test', 'main', tempDir),
      ).rejects.toThrow(/no commits yet|is not a commit/);
    });
  });

  describe('checkoutBranch()', () => {
    let tempDir: string;

    afterEach(() => {
      cleanupDir(tempDir);
    });

    it('should checkout an existing branch', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();
      await gitService.createBranch('feature/test', 'main', tempDir);

      // Act
      await gitService.checkoutBranch('feature/test', tempDir);

      // Assert
      const currentBranch = await gitService.getCurrentBranch(tempDir);
      expect(currentBranch).toBe('feature/test');
    });

    it('should throw error when branch does not exist', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Act & Assert
      await expect(
        gitService.checkoutBranch('nonexistent', tempDir),
      ).rejects.toThrow(GitOperationError);
    });

    it('should handle checkout with uncommitted changes', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();
      await gitService.createBranch('feature/test', 'main', tempDir);
      await gitService.checkoutBranch('main', tempDir);

      // Create uncommitted change (new file, won't conflict)
      fs.writeFileSync(path.join(tempDir, 'new-file.txt'), 'new content');

      // Act
      await gitService.checkoutBranch('feature/test', tempDir);

      // Assert
      const currentBranch = await gitService.getCurrentBranch(tempDir);
      expect(currentBranch).toBe('feature/test');
    });

    it('should throw NotGitRepoError for non-Git directory', async () => {
      // Arrange
      tempDir = await createTempDir();

      // Act & Assert
      await expect(
        gitService.checkoutBranch('main', tempDir),
      ).rejects.toThrow(NotGitRepoError);
    });
  });

  describe('getCurrentBranch()', () => {
    let tempDir: string;

    afterEach(() => {
      cleanupDir(tempDir);
    });

    it('should return the current branch name', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Act
      const branch = await gitService.getCurrentBranch(tempDir);

      // Assert
      expect(branch).toBe('main');
    });

    it('should throw NotGitRepoError for non-Git directory', async () => {
      // Arrange
      tempDir = await createTempDir();

      // Act & Assert
      await expect(gitService.getCurrentBranch(tempDir)).rejects.toThrow(
        NotGitRepoError,
      );
    });

    it('should return current branch after checkout', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();
      await gitService.createBranch('feature/test', 'main', tempDir);
      await gitService.checkoutBranch('feature/test', tempDir);

      // Act
      const branch = await gitService.getCurrentBranch(tempDir);

      // Assert
      expect(branch).toBe('feature/test');
    });
  });

  describe('getBranches()', () => {
    let tempDir: string;

    afterEach(() => {
      cleanupDir(tempDir);
    });

    it('should return all branches in the repository', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();
      await gitService.createBranch('feature/test1', 'main', tempDir);
      await gitService.checkoutBranch('main', tempDir);
      await gitService.createBranch('feature/test2', 'main', tempDir);

      // Act
      const branches = await gitService.getBranches(tempDir);

      // Assert
      expect(branches).toContain('main');
      expect(branches).toContain('feature/test1');
      expect(branches).toContain('feature/test2');
      expect(branches.length).toBeGreaterThanOrEqual(3);
    });

    it('should return empty array for new repo with no commits', async () => {
      // Arrange
      tempDir = await createTempGitRepo();

      // Act
      const branches = await gitService.getBranches(tempDir);

      // Assert
      expect(branches).toEqual([]);
    });

    it('should throw NotGitRepoError for non-Git directory', async () => {
      // Arrange
      tempDir = await createTempDir();

      // Act & Assert
      await expect(gitService.getBranches(tempDir)).rejects.toThrow(
        NotGitRepoError,
      );
    });

    it('should return only main branch for new repo with one commit', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Act
      const branches = await gitService.getBranches(tempDir);

      // Assert
      expect(branches).toContain('main');
      expect(branches.length).toBe(1);
    });
  });

  describe('branchExists()', () => {
    let tempDir: string;

    afterEach(() => {
      cleanupDir(tempDir);
    });

    it('should return true for existing branch', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Act
      const exists = await gitService.branchExists('main', tempDir);

      // Assert
      expect(exists).toBe(true);
    });

    it('should return false for non-existing branch', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Act
      const exists = await gitService.branchExists('nonexistent', tempDir);

      // Assert
      expect(exists).toBe(false);
    });

    it('should return false for empty repository', async () => {
      // Arrange
      tempDir = await createTempGitRepo();

      // Act
      const exists = await gitService.branchExists('main', tempDir);

      // Assert
      expect(exists).toBe(false);
    });

    it('should return true after creating branch', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();
      await gitService.createBranch('feature/new', 'main', tempDir);

      // Act
      const exists = await gitService.branchExists('feature/new', tempDir);

      // Assert
      expect(exists).toBe(true);
    });
  });

  describe('getStatus()', () => {
    let tempDir: string;

    afterEach(() => {
      cleanupDir(tempDir);
    });

    it('should return clean status for clean repository', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Act
      const status = await gitService.getStatus(tempDir);

      // Assert
      expect(status.isClean).toBe(true);
      expect(status.branch).toBe('main');
      expect(status.modified).toEqual([]);
      expect(status.created).toEqual([]);
      expect(status.deleted).toEqual([]);
    });

    it('should detect modified files', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();
      const testFile = path.join(tempDir, 'test.txt');

      // Modify file
      fs.writeFileSync(testFile, 'modified content');

      // Act
      const status = await gitService.getStatus(tempDir);

      // Assert
      expect(status.isClean).toBe(false);
      expect(status.modified).toContain('test.txt');
    });

    it('should detect created (untracked) files', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Create new file
      fs.writeFileSync(path.join(tempDir, 'new-file.txt'), 'new content');

      // Act
      const status = await gitService.getStatus(tempDir);

      // Assert
      expect(status.isClean).toBe(false);
      expect(status.created).toContain('new-file.txt');
    });

    it('should detect deleted files', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();
      const testFile = path.join(tempDir, 'test.txt');

      // Delete file
      fs.unlinkSync(testFile);

      // Act
      const status = await gitService.getStatus(tempDir);

      // Assert
      expect(status.isClean).toBe(false);
      expect(status.deleted).toContain('test.txt');
    });

    it('should detect renamed files', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Rename file using git mv
      const git = simpleGit(tempDir);
      await git.mv('test.txt', 'renamed.txt');

      // Act
      const status = await gitService.getStatus(tempDir);

      // Assert
      expect(status.isClean).toBe(false);
      expect(status.renamed.length).toBeGreaterThan(0);
      expect(status.renamed[0]).toContain('test.txt');
      expect(status.renamed[0]).toContain('renamed.txt');
    });

    it('should return ahead/behind counts', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();

      // Act
      const status = await gitService.getStatus(tempDir);

      // Assert
      expect(status.ahead).toBeDefined();
      expect(status.behind).toBeDefined();
      expect(typeof status.ahead).toBe('number');
      expect(typeof status.behind).toBe('number');
    });

    it('should throw NotGitRepoError for non-Git directory', async () => {
      // Arrange
      tempDir = await createTempDir();

      // Act & Assert
      await expect(gitService.getStatus(tempDir)).rejects.toThrow(
        NotGitRepoError,
      );
    });

    it('should return correct branch name', async () => {
      // Arrange
      tempDir = await createTempGitRepoWithCommit();
      await gitService.createBranch('feature/status-test', 'main', tempDir);
      await gitService.checkoutBranch('feature/status-test', tempDir);

      // Act
      const status = await gitService.getStatus(tempDir);

      // Assert
      expect(status.branch).toBe('feature/status-test');
    });
  });
});

/**
 * Integration Tests
 */

describe('GitService Integration', () => {
  let tempDir: string;
  let gitService: GitService;

  beforeEach(() => {
    gitService = new GitService();
  });

  afterEach(() => {
    cleanupDir(tempDir);
  });

  it('should handle complete Git workflow', async () => {
    // Check Git is installed
    const isInstalled = await gitService.checkGitInstalled();
    expect(isInstalled).toBe(true);

    // Create temp directory
    tempDir = await createTempDir();

    // Verify not a repo yet
    let isRepo = await gitService.isGitRepo(tempDir);
    expect(isRepo).toBe(false);

    // Initialize repository
    await gitService.initRepo(tempDir);
    isRepo = await gitService.isGitRepo(tempDir);
    expect(isRepo).toBe(true);

    // Create initial commit
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test Repo');
    const git = simpleGit(tempDir);
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    await git.add('.');
    await git.commit('Initial commit');

    // Get current branch
    let currentBranch = await gitService.getCurrentBranch(tempDir);
    expect(currentBranch).toBe('main');

    // Create new branch
    await gitService.createBranch('session/test', 'main', tempDir);

    // Verify branch exists
    const branchExists = await gitService.branchExists('session/test', tempDir);
    expect(branchExists).toBe(true);

    // Checkout new branch
    await gitService.checkoutBranch('session/test', tempDir);
    currentBranch = await gitService.getCurrentBranch(tempDir);
    expect(currentBranch).toBe('session/test');

    // Check status
    let status = await gitService.getStatus(tempDir);
    expect(status.isClean).toBe(true);
    expect(status.branch).toBe('session/test');

    // Make changes
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'test content');

    // Check status again
    status = await gitService.getStatus(tempDir);
    expect(status.isClean).toBe(false);
    expect(status.created).toContain('test.txt');

    // Get all branches
    const branches = await gitService.getBranches(tempDir);
    expect(branches).toContain('main');
    expect(branches).toContain('session/test');
    expect(branches.length).toBe(2);
  });

  it('should properly handle and propagate errors', async () => {
    // Create temp directory
    tempDir = await createTempDir();

    // NotGitRepoError
    await expect(gitService.getCurrentBranch(tempDir)).rejects.toThrow(
      NotGitRepoError,
    );

    // Initialize repo
    await gitService.initRepo(tempDir);

    // GitOperationError for empty repo
    await expect(
      gitService.createBranch('test', 'main', tempDir),
    ).rejects.toThrow(GitOperationError);

    // Create initial commit
    fs.writeFileSync(path.join(tempDir, 'README.md'), '# Test');
    const git = simpleGit(tempDir);
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    await git.add('.');
    await git.commit('Initial commit');

    // BranchExistsError
    await gitService.createBranch('test', 'main', tempDir);
    await expect(
      gitService.createBranch('test', 'main', tempDir),
    ).rejects.toThrow(BranchExistsError);
  });

  it('should handle multiple branches and switches', async () => {
    // Create repo with initial commit
    tempDir = await createTempGitRepoWithCommit();

    // Create multiple branches
    await gitService.createBranch('session/sess_1', 'main', tempDir);
    await gitService.createBranch('session/sess_2', 'main', tempDir);
    await gitService.createBranch('session/sess_3', 'main', tempDir);

    // Verify all branches exist
    const branches = await gitService.getBranches(tempDir);
    expect(branches).toHaveLength(4); // main + 3 session branches
    expect(branches).toContain('main');
    expect(branches).toContain('session/sess_1');
    expect(branches).toContain('session/sess_2');
    expect(branches).toContain('session/sess_3');

    // Switch between branches
    await gitService.checkoutBranch('session/sess_1', tempDir);
    expect(await gitService.getCurrentBranch(tempDir)).toBe('session/sess_1');

    await gitService.checkoutBranch('session/sess_2', tempDir);
    expect(await gitService.getCurrentBranch(tempDir)).toBe('session/sess_2');

    await gitService.checkoutBranch('main', tempDir);
    expect(await gitService.getCurrentBranch(tempDir)).toBe('main');
  });

  it('should handle complex status scenarios', async () => {
    // Create repo with initial commit
    tempDir = await createTempGitRepoWithCommit();

    // Create multiple types of changes
    // 1. Modified file
    fs.writeFileSync(path.join(tempDir, 'test.txt'), 'modified');

    // 2. New file
    fs.writeFileSync(path.join(tempDir, 'new.txt'), 'new content');

    // 3. Stage a file
    const git = simpleGit(tempDir);
    fs.writeFileSync(path.join(tempDir, 'staged.txt'), 'staged content');
    await git.add('staged.txt');

    // Get status
    const status = await gitService.getStatus(tempDir);

    // Verify status
    expect(status.isClean).toBe(false);
    expect(status.modified).toContain('test.txt');
    expect(status.created).toContain('new.txt');
    // staged.txt should appear in created since it's a new file
    expect(status.created).toContain('staged.txt');
  });
});

/**
 * Error Classes Tests
 */

describe('Error Classes', () => {
  it('should create GitNotInstalledError with default message', () => {
    const error = new GitNotInstalledError();
    expect(error.name).toBe('GitNotInstalledError');
    expect(error.message).toContain('Git is not installed');
  });

  it('should create GitNotInstalledError with custom message', () => {
    const error = new GitNotInstalledError('Custom message');
    expect(error.message).toBe('Custom message');
  });

  it('should create NotGitRepoError with directory path', () => {
    const error = new NotGitRepoError('/test/path');
    expect(error.name).toBe('NotGitRepoError');
    expect(error.message).toContain('/test/path');
  });

  it('should create BranchExistsError with branch name', () => {
    const error = new BranchExistsError('feature/test');
    expect(error.name).toBe('BranchExistsError');
    expect(error.message).toContain('feature/test');
  });

  it('should create GitOperationError with message and original error', () => {
    const originalError = new Error('Original error');
    const error = new GitOperationError('Operation failed', originalError);
    expect(error.name).toBe('GitOperationError');
    expect(error.message).toBe('Operation failed');
    expect(error.originalError).toBe(originalError);
  });
});
